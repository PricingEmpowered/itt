/*
  # Pricing Maturity Assessment Schema

  ## Overview
  This migration adds comprehensive tracking for pricing excellence aligned with
  the Pricing Maturity Assessment framework covering 6 key pillars.

  ## New Tables
  - pricing_maturity_pillars: Framework definition
  - pricing_maturity_assessments: Scoring records
  - discount_variance_tracking: Guideline compliance
  - win_loss_tracking: Win/loss with reason codes
  - quote_speed_metrics: Cycle time tracking
  - price_waterfall_analysis: Detailed price breakdown
  - bad_factor_tracking: Returns and margin erosion
  - value_propositions: Customer value by product
  - oem_pricing_index: Strategic OEM pricing
  - non_standard_product_mapping: Custom product pricing

  ## Security
  - RLS enabled on all tables
  - Authenticated users can read/write
*/

-- Create enum types
DO $$ BEGIN
  CREATE TYPE maturity_score AS ENUM ('not_started', 'in_progress', 'completed', 'optimized');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE win_loss_status AS ENUM ('won', 'lost', 'abandoned');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Pricing Maturity Pillars
CREATE TABLE IF NOT EXISTS pricing_maturity_pillars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_name text NOT NULL,
  pillar_order int NOT NULL,
  description text,
  criteria jsonb NOT NULL DEFAULT '[]',
  max_score int NOT NULL DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Pricing Maturity Assessments
CREATE TABLE IF NOT EXISTS pricing_maturity_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_date date NOT NULL DEFAULT CURRENT_DATE,
  business_unit text,
  pillar_id uuid REFERENCES pricing_maturity_pillars(id),
  score numeric(5,2) NOT NULL,
  maturity_level maturity_score NOT NULL DEFAULT 'not_started',
  criteria_completion jsonb NOT NULL DEFAULT '{}',
  notes text,
  assessed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Discount Variance Tracking
CREATE TABLE IF NOT EXISTS discount_variance_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id text,
  product_id text,
  guideline_discount numeric(5,2) NOT NULL,
  actual_discount numeric(5,2) NOT NULL,
  variance_percent numeric(5,2) GENERATED ALWAYS AS (actual_discount - guideline_discount) STORED,
  variance_amount numeric(15,2),
  reason_code text,
  approval_required boolean DEFAULT false,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  business_justification text,
  created_at timestamptz DEFAULT now()
);

-- Win/Loss Tracking
CREATE TABLE IF NOT EXISTS win_loss_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id text NOT NULL,
  status win_loss_status NOT NULL,
  primary_reason_code text NOT NULL,
  secondary_reason_code text,
  competitor_name text,
  competitor_price numeric(15,2),
  our_price numeric(15,2),
  price_gap_percent numeric(5,2),
  customer_feedback text,
  lessons_learned text,
  action_items text,
  follow_up_date date,
  followed_up boolean DEFAULT false,
  recorded_by uuid REFERENCES auth.users(id),
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Quote Speed Metrics
CREATE TABLE IF NOT EXISTS quote_speed_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id text NOT NULL,
  created_at timestamptz NOT NULL,
  first_response_at timestamptz,
  approved_at timestamptz,
  sent_to_customer_at timestamptz,
  customer_response_at timestamptz,
  time_to_first_response_hours numeric(10,2),
  time_to_approval_hours numeric(10,2),
  time_to_customer_hours numeric(10,2),
  time_to_close_hours numeric(10,2),
  complexity_score int,
  automation_used boolean DEFAULT false
);

-- Price Waterfall Analysis
CREATE TABLE IF NOT EXISTS price_waterfall_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id text NOT NULL,
  product_id text NOT NULL,
  list_price numeric(15,2) NOT NULL,
  base_discount numeric(15,2) DEFAULT 0,
  volume_discount numeric(15,2) DEFAULT 0,
  promotional_discount numeric(15,2) DEFAULT 0,
  negotiated_discount numeric(15,2) DEFAULT 0,
  invoice_price numeric(15,2) NOT NULL,
  freight_cost numeric(15,2) DEFAULT 0,
  payment_terms_cost numeric(15,2) DEFAULT 0,
  warranty_cost numeric(15,2) DEFAULT 0,
  rebate_cost numeric(15,2) DEFAULT 0,
  pocket_price numeric(15,2) NOT NULL,
  cogs numeric(15,2) NOT NULL,
  cost_to_serve numeric(15,2) DEFAULT 0,
  pocket_margin numeric(15,2) GENERATED ALWAYS AS (pocket_price - cogs - cost_to_serve) STORED,
  pocket_margin_percent numeric(5,2),
  created_at timestamptz DEFAULT now()
);

-- Bad Factor Tracking
CREATE TABLE IF NOT EXISTS bad_factor_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id text,
  customer_id text,
  product_id text,
  bad_factor_type text NOT NULL,
  amount numeric(15,2) NOT NULL,
  percentage_of_revenue numeric(5,2),
  reason_code text,
  resolution_status text DEFAULT 'open',
  resolved_at timestamptz,
  preventable boolean,
  root_cause text,
  corrective_action text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Value Propositions
CREATE TABLE IF NOT EXISTS value_propositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_line text NOT NULL,
  product_id text,
  value_statement text NOT NULL,
  quantified_benefits jsonb DEFAULT '[]',
  target_customer_segment text,
  competitive_differentiation text,
  supporting_evidence text,
  win_rate_impact numeric(5,2),
  price_premium_achieved numeric(5,2),
  created_by uuid REFERENCES auth.users(id),
  validated_by_customer boolean DEFAULT false,
  validation_date date,
  voice_of_customer_data text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- OEM Pricing Index
CREATE TABLE IF NOT EXISTS oem_pricing_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL,
  product_segment text NOT NULL,
  market_segment text,
  base_index numeric(5,2) NOT NULL DEFAULT 100.00,
  current_index numeric(5,2) NOT NULL,
  target_index numeric(5,2),
  index_justification text,
  volume_commitment numeric(15,2),
  strategic_importance text,
  competitive_position text,
  multi_year_plan jsonb,
  plan_start_date date,
  plan_end_date date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Non-Standard Product Mapping
CREATE TABLE IF NOT EXISTS non_standard_product_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  non_standard_description text NOT NULL,
  standard_product_id text,
  pricing_drivers jsonb NOT NULL DEFAULT '[]',
  decision_tree jsonb,
  premium_percent numeric(5,2) NOT NULL DEFAULT 0,
  base_price_override numeric(15,2),
  typical_lead_time_days int,
  engineering_required boolean DEFAULT false,
  example_quotes jsonb DEFAULT '[]',
  win_rate numeric(5,2),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE pricing_maturity_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_maturity_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_variance_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE win_loss_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_speed_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_waterfall_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE bad_factor_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_propositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oem_pricing_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE non_standard_product_mapping ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view pricing maturity pillars"
  ON pricing_maturity_pillars FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage pricing maturity pillars"
  ON pricing_maturity_pillars FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view assessments"
  ON pricing_maturity_assessments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create assessments"
  ON pricing_maturity_assessments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update assessments"
  ON pricing_maturity_assessments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view discount variance"
  ON discount_variance_tracking FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can track discount variance"
  ON discount_variance_tracking FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view win/loss data"
  ON win_loss_tracking FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create win/loss records"
  ON win_loss_tracking FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update win/loss records"
  ON win_loss_tracking FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view quote speed metrics"
  ON quote_speed_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can track quote speed"
  ON quote_speed_metrics FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view price waterfall"
  ON price_waterfall_analysis FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can create waterfall analysis"
  ON price_waterfall_analysis FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view bad factors"
  ON bad_factor_tracking FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can track bad factors"
  ON bad_factor_tracking FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view value propositions"
  ON value_propositions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create value propositions"
  ON value_propositions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update value propositions"
  ON value_propositions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view OEM index"
  ON oem_pricing_index FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage OEM index"
  ON oem_pricing_index FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view product mapping"
  ON non_standard_product_mapping FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create product mapping"
  ON non_standard_product_mapping FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update product mapping"
  ON non_standard_product_mapping FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed Pricing Maturity Pillars
INSERT INTO pricing_maturity_pillars (pillar_name, pillar_order, description, criteria, max_score) VALUES
(
  'Documentation and Measurement',
  1,
  'Tracks discount/rebate data, margin analysis, and improvement plans',
  '[
    {"id": 1, "text": "Incremental discount and margin vs sales plots for distributors", "weight": 15},
    {"id": 2, "text": "Improvement plans developed and executed based on data", "weight": 15},
    {"id": 3, "text": "Bad Factor and Cost Recovery tracked", "weight": 15},
    {"id": 4, "text": "Price waterfall analysis in place with cost-to-serve", "weight": 20},
    {"id": 5, "text": "Quote Speed, Win/Loss tracking with reason codes", "weight": 20},
    {"id": 6, "text": "Quote follow-up tracked with improvement plans", "weight": 15}
  ]'::jsonb,
  100
),
(
  'Process and Governance',
  2,
  'Establishes pricing guidelines, approval workflows, and continuous improvement',
  '[
    {"id": 1, "text": "Discounting matrix in place for exception pricing", "weight": 20},
    {"id": 2, "text": "Cost-to-serve incorporated into discounting decisions", "weight": 15},
    {"id": 3, "text": "Guideline compliance and variance reporting active", "weight": 20},
    {"id": 4, "text": "Delegation of Authority in place with decrease authority", "weight": 15},
    {"id": 5, "text": "Pricing guidelines updated from win/loss data", "weight": 15},
    {"id": 6, "text": "PDCA utilized to modify price strategy", "weight": 15}
  ]'::jsonb,
  100
),
(
  'List Prices',
  3,
  'Manages list price strategy, competitive positioning, and optimization',
  '[
    {"id": 1, "text": "List prices established for all SKUs", "weight": 20},
    {"id": 2, "text": "Premiums developed from competitive data", "weight": 15},
    {"id": 3, "text": "Competitive premium and margin plots with improvement plans", "weight": 20},
    {"id": 4, "text": "Impact and breakeven analysis on all list price changes", "weight": 25},
    {"id": 5, "text": "Quantity break analysis with optimization plans", "weight": 20}
  ]'::jsonb,
  100
),
(
  'Exception Pricing',
  4,
  'Handles non-standard quotes with structured decision frameworks',
  '[
    {"id": 1, "text": "Non-standard products mapped to closest standard", "weight": 25},
    {"id": 2, "text": "Pricing drivers in decision tree for rapid quoting", "weight": 25},
    {"id": 3, "text": "Pricing expressed as premium over standard product", "weight": 20},
    {"id": 4, "text": "Guidelines updated based on win/loss data", "weight": 15},
    {"id": 5, "text": "Value analysis performed on larger opportunities", "weight": 15}
  ]'::jsonb,
  100
),
(
  'OEM Pricing',
  5,
  'Strategic pricing for OEM customers with long-term plans',
  '[
    {"id": 1, "text": "OEM indexing completed by market and product segment", "weight": 25},
    {"id": 2, "text": "Index and margin vs sales plots for all OEMs", "weight": 25},
    {"id": 3, "text": "Multi-year pricing plans (PFEC) per account", "weight": 30},
    {"id": 4, "text": "Value analysis performed on larger opportunities", "weight": 20}
  ]'::jsonb,
  100
),
(
  'Value Pricing',
  6,
  'Develops and validates customer value propositions',
  '[
    {"id": 1, "text": "Customer value propositions for key product lines", "weight": 35},
    {"id": 2, "text": "Value propositions incorporated into NPI process", "weight": 30},
    {"id": 3, "text": "New products driven by Voice of Customer data", "weight": 35}
  ]'::jsonb,
  100
)
ON CONFLICT DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_maturity_assessments_date ON pricing_maturity_assessments(assessment_date);
CREATE INDEX IF NOT EXISTS idx_maturity_assessments_pillar ON pricing_maturity_assessments(pillar_id);
CREATE INDEX IF NOT EXISTS idx_discount_variance_quote ON discount_variance_tracking(quote_id);
CREATE INDEX IF NOT EXISTS idx_win_loss_quote ON win_loss_tracking(quote_id);
CREATE INDEX IF NOT EXISTS idx_win_loss_status ON win_loss_tracking(status);
CREATE INDEX IF NOT EXISTS idx_quote_speed_quote ON quote_speed_metrics(quote_id);
CREATE INDEX IF NOT EXISTS idx_waterfall_quote ON price_waterfall_analysis(quote_id);
CREATE INDEX IF NOT EXISTS idx_bad_factor_customer ON bad_factor_tracking(customer_id);
CREATE INDEX IF NOT EXISTS idx_value_prop_product ON value_propositions(product_id);
CREATE INDEX IF NOT EXISTS idx_oem_index_customer ON oem_pricing_index(customer_id);
