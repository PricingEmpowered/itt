/*
  # Add Pricing Analytics Tables

  1. New Tables
    - `analytics_business_performance`
      - Stores aggregated business metrics over time
      - KPIs: revenue, quotes, win rate, active customers
      - Time series data for charts
    
    - `analytics_price_performance`
      - Price vs cost index tracking
      - Product-level margin and sales data
      - Competitive positioning data
      - Pareto analysis data
    
    - `analytics_quote_funnel`
      - Quote progression through stages
      - New vs repeat business tracking
      - Win/loss and cycle time metrics
    
    - `analytics_price_waterfall`
      - Price breakdown components
      - Discounts, rebates, and adjustments
      - Aggregated by product family, region, channel

  2. Security
    - Enable RLS on all analytics tables
    - Authenticated users can read analytics data
*/

-- Business Performance Analytics
CREATE TABLE IF NOT EXISTS analytics_business_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('month', 'quarter', 'year')),
  product_family text,
  region text,
  channel text,
  revenue numeric(15,2) NOT NULL DEFAULT 0,
  revenue_change_pct numeric(5,2),
  active_quotes integer NOT NULL DEFAULT 0,
  active_quotes_change_pct numeric(5,2),
  win_rate numeric(5,2) NOT NULL DEFAULT 0,
  win_rate_change_pct numeric(5,2),
  active_customers integer NOT NULL DEFAULT 0,
  active_customers_change_pct numeric(5,2),
  price_index numeric(10,2) NOT NULL DEFAULT 100,
  cost_index numeric(10,2) NOT NULL DEFAULT 100,
  value_gap_pct numeric(5,2),
  margin_total numeric(15,2),
  margin_from_price numeric(15,2),
  margin_from_cost numeric(15,2),
  margin_from_volume numeric(15,2),
  margin_from_new_business numeric(15,2),
  margin_from_lost_business numeric(15,2),
  created_at timestamptz DEFAULT now()
);

-- Price Performance Analytics
CREATE TABLE IF NOT EXISTS analytics_price_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  product_id text REFERENCES products(id) ON DELETE CASCADE,
  product_family text,
  product_category text,
  part_number text,
  sales numeric(15,2) NOT NULL DEFAULT 0,
  margin_at_list_pct numeric(5,2),
  price_premium_vs_comp_a numeric(5,2),
  price_premium_vs_comp_b numeric(5,2),
  price_premium_vs_comp_c numeric(5,2),
  price_premium_vs_comp_d numeric(5,2),
  pareto_category text CHECK (pareto_category IN ('A', 'B', 'C', 'D')),
  pareto_cumulative_pct numeric(5,2),
  average_discount_pct numeric(5,2),
  discount_type text CHECK (discount_type IN ('list_price', 'standard', 'custom')),
  discount_type_sales_pct numeric(5,2),
  created_at timestamptz DEFAULT now()
);

-- Quote Funnel Analytics
CREATE TABLE IF NOT EXISTS analytics_quote_funnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('month', 'quarter', 'year')),
  region text,
  channel text,
  segment text,
  business_type text NOT NULL CHECK (business_type IN ('new', 'repeat')),
  stage text NOT NULL CHECK (stage IN ('technical_review', 'negotiation', 'won', 'lost')),
  quote_count integer NOT NULL DEFAULT 0,
  quote_value numeric(15,2) NOT NULL DEFAULT 0,
  average_value numeric(15,2),
  win_rate numeric(5,2),
  average_cycle_time_days integer,
  conversion_rate numeric(5,2),
  created_at timestamptz DEFAULT now()
);

-- Price Waterfall Analytics
CREATE TABLE IF NOT EXISTS analytics_price_waterfall (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  product_family text,
  region text,
  channel text,
  segment text,
  list_price numeric(15,2) NOT NULL DEFAULT 0,
  volume_discount numeric(15,2) NOT NULL DEFAULT 0,
  contract_discount numeric(15,2) NOT NULL DEFAULT 0,
  promotional_discount numeric(15,2) NOT NULL DEFAULT 0,
  invoice_price numeric(15,2) NOT NULL DEFAULT 0,
  rebates numeric(15,2) NOT NULL DEFAULT 0,
  payment_terms numeric(15,2) NOT NULL DEFAULT 0,
  freight numeric(15,2) NOT NULL DEFAULT 0,
  pocket_price numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE analytics_business_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_price_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_quote_funnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_price_waterfall ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view business performance"
  ON analytics_business_performance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view price performance"
  ON analytics_price_performance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view quote funnel"
  ON analytics_quote_funnel FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view price waterfall"
  ON analytics_price_waterfall FOR SELECT
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_perf_period ON analytics_business_performance(period_start, period_type);
CREATE INDEX IF NOT EXISTS idx_business_perf_filters ON analytics_business_performance(product_family, region, channel);
CREATE INDEX IF NOT EXISTS idx_price_perf_period ON analytics_price_performance(period_start, product_family);
CREATE INDEX IF NOT EXISTS idx_price_perf_product ON analytics_price_performance(product_id);
CREATE INDEX IF NOT EXISTS idx_quote_funnel_period ON analytics_quote_funnel(period_start, period_type);
CREATE INDEX IF NOT EXISTS idx_quote_funnel_filters ON analytics_quote_funnel(region, channel, segment);
CREATE INDEX IF NOT EXISTS idx_price_waterfall_period ON analytics_price_waterfall(period_start);
CREATE INDEX IF NOT EXISTS idx_price_waterfall_filters ON analytics_price_waterfall(product_family, region, channel);