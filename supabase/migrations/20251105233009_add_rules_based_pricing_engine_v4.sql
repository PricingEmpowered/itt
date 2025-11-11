/*
  # Rules-Based Pricing Engine

  1. New Tables
    - `pricing_rules_config`
      - Configuration for rule-based pricing by product family
      - Base standard products and complexity definitions
    
    - `pricing_multipliers`
      - Multiplier tables based on customer size, product existence, competition, complexity
    
    - `pricing_margin_adders`
      - Margin factor additives for cost-plus pricing
      - Based on customer size, product existence, competition, complexity, market segments
    
    - `pricing_rule_decisions`
      - Log of pricing decisions made using rules
      - Tracks which rule path was taken and the resulting price
    
    - `product_complexity_attributes`
      - Define what makes a product low/medium/high complexity
      - Link products to complexity levels

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Features
    - Support for decision tree logic
    - Multiplier-based pricing (for variations of standard products)
    - Cost-plus with margin adders (for non-standard products)
    - Customer size segmentation (Large, Med, Small)
    - Competition and complexity factors
    - Market-specific adders
*/

-- Pricing rules configuration
CREATE TABLE IF NOT EXISTS pricing_rules_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_family_id text REFERENCES product_families(id),
  name text NOT NULL,
  description text,
  decision_tree_logic jsonb NOT NULL,
  opportunity_threshold numeric DEFAULT 100000,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Pricing multipliers (for variations of standard products)
CREATE TABLE IF NOT EXISTS pricing_multipliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rules_config_id uuid REFERENCES pricing_rules_config(id) ON DELETE CASCADE,
  customer_segment text NOT NULL CHECK (customer_segment IN ('Large Customer', 'Med Customer', 'Small Customer')),
  has_existing_product boolean NOT NULL DEFAULT false,
  has_competition boolean NOT NULL DEFAULT false,
  complexity_level text NOT NULL CHECK (complexity_level IN ('Low', 'Med', 'High')),
  multiplier numeric NOT NULL CHECK (multiplier >= 0),
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(rules_config_id, customer_segment, has_existing_product, has_competition, complexity_level)
);

-- Pricing margin adders (for cost-plus pricing of non-standard products)
CREATE TABLE IF NOT EXISTS pricing_margin_adders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rules_config_id uuid REFERENCES pricing_rules_config(id) ON DELETE CASCADE,
  customer_segment text NOT NULL CHECK (customer_segment IN ('Large Customer', 'Med Customer', 'Small Customer')),
  has_existing_product boolean NOT NULL DEFAULT false,
  has_competition boolean NOT NULL DEFAULT false,
  complexity_level text NOT NULL CHECK (complexity_level IN ('Low', 'Med', 'High')),
  margin_adder numeric NOT NULL CHECK (margin_adder >= 0),
  market_segment text,
  market_adder numeric DEFAULT 0 CHECK (market_adder >= 0),
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(rules_config_id, customer_segment, has_existing_product, has_competition, complexity_level, market_segment)
);

-- Product complexity attributes (define what makes products complex)
CREATE TABLE IF NOT EXISTS product_complexity_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text REFERENCES products(id) ON DELETE CASCADE,
  complexity_level text NOT NULL CHECK (complexity_level IN ('Low', 'Med', 'High')),
  complexity_factors jsonb,
  requires_custom_design boolean DEFAULT false,
  engineering_hours numeric DEFAULT 0,
  manufacturing_complexity text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Pricing rule decisions (audit log)
CREATE TABLE IF NOT EXISTS pricing_rule_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id text REFERENCES quotes(id) ON DELETE CASCADE,
  quote_line_id uuid,
  rules_config_id uuid REFERENCES pricing_rules_config(id),
  decision_path text NOT NULL,
  is_variation_of_standard boolean,
  opportunity_size numeric,
  requires_strategic_review boolean DEFAULT false,
  
  customer_segment text,
  has_existing_product boolean,
  has_competition boolean,
  complexity_level text,
  market_segment text,
  
  base_price numeric,
  standard_product_id text REFERENCES products(id),
  multiplier_applied numeric,
  margin_adder_applied numeric,
  market_adder_applied numeric,
  calculated_price numeric,
  
  product_cost numeric,
  standard_margin numeric,
  
  decision_made_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- RLS Policies
ALTER TABLE pricing_rules_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_multipliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_margin_adders ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_complexity_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rule_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pricing rules config"
  ON pricing_rules_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage pricing rules config"
  ON pricing_rules_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read pricing multipliers"
  ON pricing_multipliers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage pricing multipliers"
  ON pricing_multipliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read pricing margin adders"
  ON pricing_margin_adders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage pricing margin adders"
  ON pricing_margin_adders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read product complexity"
  ON product_complexity_attributes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage product complexity"
  ON product_complexity_attributes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read pricing decisions"
  ON pricing_rule_decisions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create pricing decisions"
  ON pricing_rule_decisions FOR INSERT TO authenticated WITH CHECK (true);

-- Seed example data based on the GPD decision tree
DO $$
DECLARE
  v_config_id uuid;
  v_product_family_id text;
BEGIN
  SELECT id INTO v_product_family_id FROM product_families LIMIT 1;
  
  INSERT INTO pricing_rules_config (
    product_family_id,
    name,
    description,
    decision_tree_logic,
    opportunity_threshold
  ) VALUES (
    v_product_family_id,
    'GPD Non-Standard Pricing',
    'Decision tree for 300 Series/Roller Bearing variations and non-standard assemblies',
    '{
      "type": "decision_tree",
      "root": {
        "question": "Is opportunity over $100K?",
        "yes": "strategic_review",
        "no": {
          "question": "Is this a variation of a standard part?",
          "yes": "multiplier_pricing",
          "no": "cost_plus_pricing"
        }
      },
      "multiplier_pricing": {
        "method": "list_price_of_closest_standard * multiplier",
        "factors": ["customer_segment", "has_existing_product", "has_competition", "complexity"]
      },
      "cost_plus_pricing": {
        "method": "cost * standard_margin + adder",
        "factors": ["customer_segment", "has_existing_product", "has_competition", "complexity", "market_segment"]
      }
    }'::jsonb,
    100000
  ) RETURNING id INTO v_config_id;

  -- Insert multipliers for variations of standard products
  INSERT INTO pricing_multipliers (rules_config_id, customer_segment, has_existing_product, has_competition, complexity_level, multiplier, description) VALUES
  -- Large Customer
  (v_config_id, 'Large Customer', false, false, 'Low', 1.08, 'Large customer, no existing product, no competition, low complexity'),
  (v_config_id, 'Large Customer', false, false, 'Med', 1.30, 'Large customer, no existing product, no competition, medium complexity'),
  (v_config_id, 'Large Customer', false, false, 'High', 1.85, 'Large customer, no existing product, no competition, high complexity'),
  (v_config_id, 'Large Customer', true, false, 'Low', 1.05, 'Large customer, existing product, no competition, low complexity'),
  (v_config_id, 'Large Customer', true, false, 'Med', 1.05, 'Large customer, existing product, no competition, medium complexity'),
  (v_config_id, 'Large Customer', true, false, 'High', 1.05, 'Large customer, existing product, no competition, high complexity'),
  (v_config_id, 'Large Customer', false, true, 'Low', 1.00, 'Large customer, no existing product, has competition, low complexity'),
  (v_config_id, 'Large Customer', false, true, 'Med', 1.00, 'Large customer, no existing product, has competition, medium complexity'),
  (v_config_id, 'Large Customer', false, true, 'High', 1.00, 'Large customer, no existing product, has competition, high complexity'),
  (v_config_id, 'Large Customer', true, true, 'Low', 1.00, 'Large customer, existing product, has competition, low complexity'),
  (v_config_id, 'Large Customer', true, true, 'Med', 1.00, 'Large customer, existing product, has competition, medium complexity'),
  (v_config_id, 'Large Customer', true, true, 'High', 1.00, 'Large customer, existing product, has competition, high complexity'),
  -- Med Customer
  (v_config_id, 'Med Customer', false, false, 'Low', 1.10, 'Medium customer, no existing product, no competition, low complexity'),
  (v_config_id, 'Med Customer', false, false, 'Med', 1.35, 'Medium customer, no existing product, no competition, medium complexity'),
  (v_config_id, 'Med Customer', false, false, 'High', 2.00, 'Medium customer, no existing product, no competition, high complexity'),
  (v_config_id, 'Med Customer', true, false, 'Low', 1.07, 'Medium customer, existing product, no competition, low complexity'),
  (v_config_id, 'Med Customer', true, false, 'Med', 1.07, 'Medium customer, existing product, no competition, medium complexity'),
  (v_config_id, 'Med Customer', true, false, 'High', 1.07, 'Medium customer, existing product, no competition, high complexity'),
  (v_config_id, 'Med Customer', false, true, 'Low', 1.00, 'Medium customer, no existing product, has competition, low complexity'),
  (v_config_id, 'Med Customer', false, true, 'Med', 1.00, 'Medium customer, no existing product, has competition, medium complexity'),
  (v_config_id, 'Med Customer', false, true, 'High', 1.00, 'Medium customer, no existing product, has competition, high complexity'),
  (v_config_id, 'Med Customer', true, true, 'Low', 1.00, 'Medium customer, existing product, has competition, low complexity'),
  (v_config_id, 'Med Customer', true, true, 'Med', 1.00, 'Medium customer, existing product, has competition, medium complexity'),
  (v_config_id, 'Med Customer', true, true, 'High', 1.00, 'Medium customer, existing product, has competition, high complexity'),
  -- Small Customer
  (v_config_id, 'Small Customer', false, false, 'Low', 1.10, 'Small customer, no existing product, no competition, low complexity'),
  (v_config_id, 'Small Customer', false, false, 'Med', 1.35, 'Small customer, no existing product, no competition, medium complexity'),
  (v_config_id, 'Small Customer', false, false, 'High', 2.00, 'Small customer, no existing product, no competition, high complexity'),
  (v_config_id, 'Small Customer', true, false, 'Low', 1.10, 'Small customer, existing product, no competition, low complexity'),
  (v_config_id, 'Small Customer', true, false, 'Med', 1.10, 'Small customer, existing product, no competition, medium complexity'),
  (v_config_id, 'Small Customer', true, false, 'High', 1.10, 'Small customer, existing product, no competition, high complexity'),
  (v_config_id, 'Small Customer', false, true, 'Low', 1.00, 'Small customer, no existing product, has competition, low complexity'),
  (v_config_id, 'Small Customer', false, true, 'Med', 1.00, 'Small customer, no existing product, has competition, medium complexity'),
  (v_config_id, 'Small Customer', false, true, 'High', 1.00, 'Small customer, no existing product, has competition, high complexity'),
  (v_config_id, 'Small Customer', true, true, 'Low', 1.00, 'Small customer, existing product, has competition, low complexity'),
  (v_config_id, 'Small Customer', true, true, 'Med', 1.00, 'Small customer, existing product, has competition, medium complexity'),
  (v_config_id, 'Small Customer', true, true, 'High', 1.00, 'Small customer, existing product, has competition, high complexity');

  -- Insert margin adders for non-standard products (base adders without market segment)
  INSERT INTO pricing_margin_adders (rules_config_id, customer_segment, has_existing_product, has_competition, complexity_level, margin_adder, market_segment, market_adder, description) VALUES
  -- Large Customer
  (v_config_id, 'Large Customer', false, false, 'Low', 0.03, NULL, 0, 'Large customer, no existing product, no competition, low complexity'),
  (v_config_id, 'Large Customer', false, false, 'Med', 0.05, NULL, 0, 'Large customer, no existing product, no competition, medium complexity'),
  (v_config_id, 'Large Customer', false, false, 'High', 0.08, NULL, 0, 'Large customer, no existing product, no competition, high complexity'),
  (v_config_id, 'Large Customer', true, false, 'Low', 0.00, NULL, 0, 'Large customer, existing product, no competition, low complexity'),
  (v_config_id, 'Large Customer', false, true, 'Low', 0.00, NULL, 0, 'Large customer, no existing product, has competition, low complexity'),
  (v_config_id, 'Large Customer', true, true, 'Low', 0.00, NULL, 0, 'Large customer, existing product, has competition, low complexity'),
  -- Med Customer
  (v_config_id, 'Med Customer', false, false, 'Low', 0.07, NULL, 0, 'Medium customer, no existing product, no competition, low complexity'),
  (v_config_id, 'Med Customer', false, false, 'Med', 0.07, NULL, 0, 'Medium customer, no existing product, no competition, medium complexity'),
  (v_config_id, 'Med Customer', false, false, 'High', 0.10, NULL, 0, 'Medium customer, no existing product, no competition, high complexity'),
  (v_config_id, 'Med Customer', true, false, 'Low', 0.00, NULL, 0, 'Medium customer, existing product, no competition, low complexity'),
  (v_config_id, 'Med Customer', false, true, 'Low', 0.00, NULL, 0, 'Medium customer, no existing product, has competition, low complexity'),
  (v_config_id, 'Med Customer', true, true, 'Low', 0.00, NULL, 0, 'Medium customer, existing product, has competition, low complexity'),
  -- Small Customer
  (v_config_id, 'Small Customer', false, false, 'Low', 0.07, NULL, 0, 'Small customer, no existing product, no competition, low complexity'),
  (v_config_id, 'Small Customer', false, false, 'Med', 0.10, NULL, 0, 'Small customer, no existing product, no competition, medium complexity'),
  (v_config_id, 'Small Customer', false, false, 'High', 0.15, NULL, 0, 'Small customer, no existing product, no competition, high complexity'),
  (v_config_id, 'Small Customer', true, false, 'Low', 0.00, NULL, 0, 'Small customer, existing product, no competition, low complexity'),
  (v_config_id, 'Small Customer', false, true, 'Low', 0.00, NULL, 0, 'Small customer, no existing product, has competition, low complexity'),
  (v_config_id, 'Small Customer', true, true, 'Low', 0.00, NULL, 0, 'Small customer, existing product, has competition, low complexity');

  -- Market segment adders (combined with base scenario)
  INSERT INTO pricing_margin_adders (rules_config_id, customer_segment, has_existing_product, has_competition, complexity_level, margin_adder, market_segment, market_adder, description) VALUES
  (v_config_id, 'Large Customer', false, false, 'Low', 0.03, 'Construction', 0.03, 'Construction market adder'),
  (v_config_id, 'Large Customer', false, false, 'Low', 0.03, 'Crane', 0.02, 'Crane market adder'),
  (v_config_id, 'Large Customer', false, false, 'Low', 0.03, 'Energy/Oil', 0.07, 'Energy/Oil market adder'),
  (v_config_id, 'Large Customer', false, false, 'Low', 0.03, 'Military', 0.07, 'Military market adder');

END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pricing_multipliers_lookup ON pricing_multipliers(rules_config_id, customer_segment, has_existing_product, has_competition, complexity_level);
CREATE INDEX IF NOT EXISTS idx_pricing_margin_adders_lookup ON pricing_margin_adders(rules_config_id, customer_segment, has_existing_product, has_competition, complexity_level);
CREATE INDEX IF NOT EXISTS idx_product_complexity_product ON product_complexity_attributes(product_id);
CREATE INDEX IF NOT EXISTS idx_pricing_decisions_quote ON pricing_rule_decisions(quote_id);
