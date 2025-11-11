/*
  # Enhanced Approval Workflow System

  1. Changes to Tables
    - Add `approval_level_required` to approval_requests
    - Add `approval_sequence` to track multi-level approvals
    - Add `current_approval_level` to quotes
    - Create `approval_workflow_rules` table for configurable rules
    - Create `approval_history` table for audit trail

  2. New Tables
    - `approval_workflow_rules`
      - Defines rules for when approvals are required
      - Maps quote characteristics to required approval levels
    - `approval_history`
      - Complete audit trail of all approval actions
      - Tracks which level approved/rejected and when

  3. Security
    - Enable RLS on all new tables
    - Add policies for appropriate access control
*/

-- Add columns to approval_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_requests' AND column_name = 'approval_level_required'
  ) THEN
    ALTER TABLE approval_requests ADD COLUMN approval_level_required integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_requests' AND column_name = 'approval_sequence'
  ) THEN
    ALTER TABLE approval_requests ADD COLUMN approval_sequence integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_requests' AND column_name = 'quote_total'
  ) THEN
    ALTER TABLE approval_requests ADD COLUMN quote_total numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_requests' AND column_name = 'quote_discount_percent'
  ) THEN
    ALTER TABLE approval_requests ADD COLUMN quote_discount_percent numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_requests' AND column_name = 'quote_margin_percent'
  ) THEN
    ALTER TABLE approval_requests ADD COLUMN quote_margin_percent numeric;
  END IF;
END $$;

-- Add columns to quotes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'current_approval_level'
  ) THEN
    ALTER TABLE quotes ADD COLUMN current_approval_level integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'max_approval_level_required'
  ) THEN
    ALTER TABLE quotes ADD COLUMN max_approval_level_required integer DEFAULT 0;
  END IF;
END $$;

-- Create approval workflow rules table
CREATE TABLE IF NOT EXISTS approval_workflow_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL,
  approval_level integer NOT NULL,
  min_discount_percent numeric,
  max_discount_percent numeric,
  min_margin_percent numeric,
  max_margin_percent numeric,
  min_quote_size numeric,
  max_quote_size numeric,
  approval_role text NOT NULL,
  priority integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE approval_workflow_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approval rules"
  ON approval_workflow_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage approval rules"
  ON approval_workflow_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('Admin', 'Sales Director')
    )
  );

-- Create approval history table
CREATE TABLE IF NOT EXISTS approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id text NOT NULL REFERENCES quotes(id),
  approval_request_id text REFERENCES approval_requests(id),
  approval_level integer NOT NULL,
  action text NOT NULL CHECK (action IN ('approved', 'rejected', 'requested', 'escalated')),
  actioned_by uuid REFERENCES user_profiles(id),
  actioned_by_role text,
  actioned_by_level integer,
  comments text,
  quote_total numeric,
  quote_discount_percent numeric,
  quote_margin_percent numeric,
  actioned_at timestamptz DEFAULT now()
);

ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approval history"
  ON approval_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert approval history"
  ON approval_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actioned_by);

-- Insert default approval workflow rules
INSERT INTO approval_workflow_rules (rule_name, approval_level, min_discount_percent, max_discount_percent, approval_role, priority) VALUES
  ('Level 1: Standard Discount (0-15%)', 1, 0, 15, 'Sales Manager', 1),
  ('Level 2: Moderate Discount (15-25%)', 2, 15, 25, 'Regional Manager', 2),
  ('Level 3: High Discount (25-35%)', 3, 25, 35, 'Sales Director', 3),
  ('Level 4: Exception Discount (35%+)', 4, 35, 100, 'VP Sales', 4)
ON CONFLICT DO NOTHING;

INSERT INTO approval_workflow_rules (rule_name, approval_level, min_quote_size, approval_role, priority) VALUES
  ('Level 2: Large Deal ($100K+)', 2, 100000, 'Regional Manager', 2),
  ('Level 3: Major Deal ($500K+)', 3, 500000, 'Sales Director', 3),
  ('Level 4: Strategic Deal ($1M+)', 4, 1000000, 'VP Sales', 4)
ON CONFLICT DO NOTHING;

INSERT INTO approval_workflow_rules (rule_name, approval_level, max_margin_percent, approval_role, priority) VALUES
  ('Level 2: Low Margin (< 20%)', 2, NULL, 'Regional Manager', 2),
  ('Level 3: Critical Margin (< 15%)', 3, NULL, 'Sales Director', 3),
  ('Level 4: Below Cost (< 10%)', 4, NULL, 'VP Sales', 4)
ON CONFLICT DO NOTHING;

-- Create function to determine required approval level
CREATE OR REPLACE FUNCTION determine_approval_level(
  p_discount_percent numeric,
  p_margin_percent numeric,
  p_quote_size numeric
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_level integer := 0;
  v_rule_level integer;
BEGIN
  -- Check discount-based rules
  SELECT COALESCE(MAX(approval_level), 0) INTO v_rule_level
  FROM approval_workflow_rules
  WHERE is_active = true
    AND min_discount_percent IS NOT NULL
    AND p_discount_percent >= COALESCE(min_discount_percent, 0)
    AND p_discount_percent < COALESCE(max_discount_percent, 100);
  
  v_max_level := GREATEST(v_max_level, COALESCE(v_rule_level, 0));

  -- Check size-based rules
  SELECT COALESCE(MAX(approval_level), 0) INTO v_rule_level
  FROM approval_workflow_rules
  WHERE is_active = true
    AND min_quote_size IS NOT NULL
    AND p_quote_size >= min_quote_size
    AND (max_quote_size IS NULL OR p_quote_size <= max_quote_size);
  
  v_max_level := GREATEST(v_max_level, COALESCE(v_rule_level, 0));

  -- Check margin-based rules
  IF p_margin_percent < 20 THEN
    v_max_level := GREATEST(v_max_level, 2);
  END IF;
  
  IF p_margin_percent < 15 THEN
    v_max_level := GREATEST(v_max_level, 3);
  END IF;
  
  IF p_margin_percent < 10 THEN
    v_max_level := GREATEST(v_max_level, 4);
  END IF;

  RETURN v_max_level;
END;
$$;
