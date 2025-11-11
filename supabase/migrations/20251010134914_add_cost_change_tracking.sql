/*
  # Add Cost Change Tracking

  1. New Tables
    - `expected_cost_changes`
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key) - Product affected by cost change
      - `current_cost` (decimal) - Current base cost
      - `expected_new_cost` (decimal) - Expected new cost
      - `expected_cost_change_percent` (decimal) - Percentage change
      - `effective_date` (date) - When the cost change takes effect
      - `reason` (text) - Reason for cost change (supplier increase, material costs, etc.)
      - `status` (text) - pending, acknowledged, price_updated, cancelled
      - `recommended_price_increase` (decimal) - System-recommended new list price
      - `recommended_price_increase_percent` (decimal) - Percentage increase recommendation
      - `notes` (text) - Additional notes
      - `created_at` (timestamptz)
      - `created_by` (uuid, foreign key)
      - `acknowledged_at` (timestamptz)
      - `acknowledged_by` (uuid, foreign key)
      - `price_updated_at` (timestamptz)
      - `price_updated_by` (uuid, foreign key)

    - `price_change_alerts`
      - View that joins expected_cost_changes with products to show alerts
      - Calculates current margin, expected margin, and recommended actions

  2. Security
    - Enable RLS on `expected_cost_changes` table
    - Add policies for authenticated users to manage cost changes

  3. Indexes
    - Index on product_id for fast lookups
    - Index on effective_date for date-based queries
    - Index on status for filtering active alerts

  ## Notes
  - Cost changes can be flagged in advance to allow proactive price adjustments
  - System calculates recommended price increases to maintain target margins
  - Alerts shown when effective date is within 90 days
  - Status workflow: pending → acknowledged → price_updated or cancelled
*/

-- Create expected_cost_changes table
CREATE TABLE IF NOT EXISTS expected_cost_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  current_cost decimal(10,2) NOT NULL,
  expected_new_cost decimal(10,2) NOT NULL,
  expected_cost_change_percent decimal(5,2) NOT NULL,
  effective_date date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  recommended_price_increase decimal(10,2),
  recommended_price_increase_percent decimal(5,2),
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id),
  price_updated_at timestamptz,
  price_updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'acknowledged', 'price_updated', 'cancelled')),
  CONSTRAINT valid_costs CHECK (expected_new_cost > 0 AND current_cost > 0),
  CONSTRAINT valid_effective_date CHECK (effective_date >= CURRENT_DATE)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cost_changes_product ON expected_cost_changes(product_id);
CREATE INDEX IF NOT EXISTS idx_cost_changes_effective_date ON expected_cost_changes(effective_date);
CREATE INDEX IF NOT EXISTS idx_cost_changes_status ON expected_cost_changes(status);

-- Create view for price change alerts with calculated fields
CREATE OR REPLACE VIEW price_change_alerts AS
SELECT
  ecc.id,
  ecc.product_id,
  p.name as product_name,
  p.category as product_category,
  p.base_cost as current_base_cost,
  COALESCE(pli.list_price, 0) as current_list_price,
  ecc.expected_new_cost,
  ecc.expected_cost_change_percent,
  ecc.effective_date,
  ecc.reason,
  ecc.status,
  ecc.recommended_price_increase,
  ecc.recommended_price_increase_percent,
  ecc.notes,
  ecc.created_at,
  ecc.acknowledged_at,
  ecc.price_updated_at,
  -- Calculate current margin
  CASE
    WHEN COALESCE(pli.list_price, 0) > 0
    THEN ((COALESCE(pli.list_price, 0) - p.base_cost) / COALESCE(pli.list_price, 1) * 100)
    ELSE 0
  END as current_margin_percent,
  -- Calculate expected margin with new cost (if price stays same)
  CASE
    WHEN COALESCE(pli.list_price, 0) > 0
    THEN ((COALESCE(pli.list_price, 0) - ecc.expected_new_cost) / COALESCE(pli.list_price, 1) * 100)
    ELSE 0
  END as expected_margin_percent,
  -- Calculate days until effective
  (ecc.effective_date - CURRENT_DATE) as days_until_effective,
  -- Calculate urgency level
  CASE
    WHEN (ecc.effective_date - CURRENT_DATE) <= 30 THEN 'critical'
    WHEN (ecc.effective_date - CURRENT_DATE) <= 60 THEN 'high'
    WHEN (ecc.effective_date - CURRENT_DATE) <= 90 THEN 'medium'
    ELSE 'low'
  END as urgency
FROM expected_cost_changes ecc
JOIN products p ON p.id = ecc.product_id
LEFT JOIN price_list_items pli ON pli.product_id = p.id
  AND pli.price_list_id = 'master'
WHERE ecc.status IN ('pending', 'acknowledged');

-- Enable RLS
ALTER TABLE expected_cost_changes ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all cost changes
CREATE POLICY "Authenticated users can read cost changes"
  ON expected_cost_changes
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert cost changes
CREATE POLICY "Authenticated users can insert cost changes"
  ON expected_cost_changes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update cost changes
CREATE POLICY "Authenticated users can update cost changes"
  ON expected_cost_changes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete cost changes
CREATE POLICY "Authenticated users can delete cost changes"
  ON expected_cost_changes
  FOR DELETE
  TO authenticated
  USING (true);
