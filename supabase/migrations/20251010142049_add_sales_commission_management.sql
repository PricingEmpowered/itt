/*
  # Add Sales Commission Management

  1. New Tables
    - `commission_tiers`
      - `id` (uuid, primary key)
      - `name` (text) - Name of the tier (e.g., "Standard", "High Value", "Strategic")
      - `min_deal_size` (decimal) - Minimum deal size for this tier
      - `max_deal_size` (decimal) - Maximum deal size for this tier (null = unlimited)
      - `min_deal_score` (integer) - Minimum deal score for bonus
      - `base_commission_percent` (decimal) - Base commission percentage
      - `deal_score_bonus_percent` (decimal) - Bonus % for high deal scores
      - `is_active` (boolean) - Whether this tier is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `sales_commissions`
      - `id` (uuid, primary key)
      - `quote_id` (text, foreign key) - Associated quote
      - `sales_rep_id` (uuid, foreign key) - Sales rep who owns the deal
      - `sales_rep_email` (text) - Email for reference
      - `deal_size` (decimal) - Total quote value
      - `deal_score` (integer) - Deal score at time of calculation
      - `commission_tier_id` (uuid, foreign key) - Tier used for calculation
      - `base_commission_percent` (decimal) - Base % applied
      - `deal_score_bonus_percent` (decimal) - Bonus % applied
      - `total_commission_percent` (decimal) - Total % (base + bonus)
      - `commission_amount` (decimal) - Dollar amount of commission
      - `status` (text) - pending, won, paid, cancelled
      - `won_date` (date) - Date deal was won
      - `paid_date` (date) - Date commission was paid
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `commission_payments`
      - `id` (uuid, primary key)
      - `payment_date` (date)
      - `payment_period_start` (date)
      - `payment_period_end` (date)
      - `total_amount` (decimal)
      - `commission_count` (integer)
      - `notes` (text)
      - `created_by` (uuid, foreign key)
      - `created_at` (timestamptz)

    - `commission_payment_items`
      - `id` (uuid, primary key)
      - `payment_id` (uuid, foreign key) - Links to commission_payments
      - `commission_id` (uuid, foreign key) - Links to sales_commissions
      - `amount` (decimal)
      - `created_at` (timestamptz)

  2. Views
    - `commission_summary_by_rep` - Summarizes commissions by sales rep
    - `commission_summary_by_period` - Summarizes commissions by time period

  3. Security
    - Enable RLS on all commission tables
    - Add policies for authenticated users

  4. Indexes
    - Index on quote_id for fast lookups
    - Index on sales_rep_id for rep-specific queries
    - Index on status for filtering
    - Index on won_date for date-range queries

  ## Notes
  - Commission calculated when quote is created/updated
  - Status changes from pending → won when deal closes
  - Deal score bonus only applies if deal score >= min threshold
  - Tiers are evaluated in order of deal size
*/

-- Create commission_tiers table
CREATE TABLE IF NOT EXISTS commission_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_deal_size decimal(12,2) NOT NULL DEFAULT 0,
  max_deal_size decimal(12,2),
  min_deal_score integer NOT NULL DEFAULT 0,
  base_commission_percent decimal(5,2) NOT NULL,
  deal_score_bonus_percent decimal(5,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_deal_size_range CHECK (max_deal_size IS NULL OR max_deal_size > min_deal_size),
  CONSTRAINT valid_base_commission CHECK (base_commission_percent >= 0 AND base_commission_percent <= 100),
  CONSTRAINT valid_bonus CHECK (deal_score_bonus_percent >= 0 AND deal_score_bonus_percent <= 100)
);

-- Create sales_commissions table
CREATE TABLE IF NOT EXISTS sales_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id text NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  sales_rep_id uuid REFERENCES auth.users(id),
  sales_rep_email text NOT NULL,
  deal_size decimal(12,2) NOT NULL,
  deal_score integer,
  commission_tier_id uuid REFERENCES commission_tiers(id),
  base_commission_percent decimal(5,2) NOT NULL,
  deal_score_bonus_percent decimal(5,2) NOT NULL DEFAULT 0,
  total_commission_percent decimal(5,2) NOT NULL,
  commission_amount decimal(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  won_date date,
  paid_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_commission_status CHECK (status IN ('pending', 'won', 'paid', 'cancelled')),
  CONSTRAINT valid_commission_amount CHECK (commission_amount >= 0)
);

-- Create commission_payments table
CREATE TABLE IF NOT EXISTS commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_date date NOT NULL,
  payment_period_start date NOT NULL,
  payment_period_end date NOT NULL,
  total_amount decimal(12,2) NOT NULL DEFAULT 0,
  commission_count integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_payment_period CHECK (payment_period_end >= payment_period_start)
);

-- Create commission_payment_items table
CREATE TABLE IF NOT EXISTS commission_payment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES commission_payments(id) ON DELETE CASCADE,
  commission_id uuid NOT NULL REFERENCES sales_commissions(id) ON DELETE CASCADE,
  amount decimal(12,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_payment_amount CHECK (amount >= 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sales_commissions_quote ON sales_commissions(quote_id);
CREATE INDEX IF NOT EXISTS idx_sales_commissions_rep ON sales_commissions(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_sales_commissions_status ON sales_commissions(status);
CREATE INDEX IF NOT EXISTS idx_sales_commissions_won_date ON sales_commissions(won_date);
CREATE INDEX IF NOT EXISTS idx_commission_payment_items_payment ON commission_payment_items(payment_id);
CREATE INDEX IF NOT EXISTS idx_commission_payment_items_commission ON commission_payment_items(commission_id);

-- Create view for commission summary by rep
CREATE OR REPLACE VIEW commission_summary_by_rep AS
SELECT
  sc.sales_rep_id,
  sc.sales_rep_email,
  COUNT(*) as total_deals,
  COUNT(*) FILTER (WHERE sc.status = 'pending') as pending_deals,
  COUNT(*) FILTER (WHERE sc.status = 'won') as won_deals,
  COUNT(*) FILTER (WHERE sc.status = 'paid') as paid_deals,
  SUM(sc.deal_size) FILTER (WHERE sc.status = 'won' OR sc.status = 'paid') as total_won_revenue,
  SUM(sc.commission_amount) FILTER (WHERE sc.status = 'pending') as pending_commission,
  SUM(sc.commission_amount) FILTER (WHERE sc.status = 'won') as won_unpaid_commission,
  SUM(sc.commission_amount) FILTER (WHERE sc.status = 'paid') as paid_commission,
  AVG(sc.deal_score) as avg_deal_score,
  AVG(sc.total_commission_percent) as avg_commission_percent
FROM sales_commissions sc
GROUP BY sc.sales_rep_id, sc.sales_rep_email;

-- Create view for commission summary by period
CREATE OR REPLACE VIEW commission_summary_by_period AS
SELECT
  DATE_TRUNC('month', sc.won_date) as period_month,
  COUNT(*) as deals_won,
  SUM(sc.deal_size) as total_revenue,
  SUM(sc.commission_amount) as total_commission,
  AVG(sc.total_commission_percent) as avg_commission_percent,
  AVG(sc.deal_score) as avg_deal_score,
  COUNT(DISTINCT sc.sales_rep_id) as active_reps
FROM sales_commissions sc
WHERE sc.status IN ('won', 'paid') AND sc.won_date IS NOT NULL
GROUP BY DATE_TRUNC('month', sc.won_date)
ORDER BY period_month DESC;

-- Insert default commission tiers
INSERT INTO commission_tiers (name, min_deal_size, max_deal_size, min_deal_score, base_commission_percent, deal_score_bonus_percent, is_active)
VALUES
  ('Small Deal', 0, 10000, 70, 3.0, 0.5, true),
  ('Standard Deal', 10000, 50000, 70, 4.0, 1.0, true),
  ('Large Deal', 50000, 150000, 70, 5.0, 1.5, true),
  ('Enterprise Deal', 150000, NULL, 70, 6.0, 2.0, true)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE commission_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payment_items ENABLE ROW LEVEL SECURITY;

-- Policies for commission_tiers
CREATE POLICY "Authenticated users can read commission tiers"
  ON commission_tiers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage commission tiers"
  ON commission_tiers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for sales_commissions
CREATE POLICY "Authenticated users can read sales commissions"
  ON sales_commissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sales commissions"
  ON sales_commissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales commissions"
  ON sales_commissions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete sales commissions"
  ON sales_commissions FOR DELETE
  TO authenticated
  USING (true);

-- Policies for commission_payments
CREATE POLICY "Authenticated users can read commission payments"
  ON commission_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage commission payments"
  ON commission_payments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for commission_payment_items
CREATE POLICY "Authenticated users can read commission payment items"
  ON commission_payment_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage commission payment items"
  ON commission_payment_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
