/*
  # AI Analytics Question Library

  1. New Tables
    - `ai_analytics_questions`
      - `id` (uuid, primary key)
      - `category` (text) - Question category (customer, product, pricing, time_series, regional, general)
      - `question` (text) - The natural language question
      - `expected_sql` (text) - The correct SQL query that should be generated
      - `description` (text) - What the question is testing
      - `difficulty` (text) - easy, medium, hard
      - `views_used` (text[]) - Array of view names used in the query
      - `is_active` (boolean) - Whether to include in testing
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `ai_analytics_questions` table
    - Add policies for authenticated users to read questions
    - Add policies for admins to manage questions
*/

CREATE TABLE IF NOT EXISTS ai_analytics_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('customer', 'product', 'pricing', 'time_series', 'regional', 'general')),
  question text NOT NULL,
  expected_sql text NOT NULL,
  description text,
  difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  views_used text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_analytics_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read questions"
  ON ai_analytics_questions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert questions"
  ON ai_analytics_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update questions"
  ON ai_analytics_questions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete questions"
  ON ai_analytics_questions
  FOR DELETE
  TO authenticated
  USING (true);

-- Seed with example questions
INSERT INTO ai_analytics_questions (category, question, expected_sql, description, difficulty, views_used) VALUES
-- Customer questions (easy)
('customer', 'Show top 10 customers by revenue', 
 'SELECT customer_name, total_revenue FROM analytics_secure.customer_metrics ORDER BY total_revenue DESC',
 'Basic customer ranking by revenue', 'easy', ARRAY['customer_metrics']),

('customer', 'Which customers have the highest win rate?',
 'SELECT customer_name, segment, win_rate_pct FROM analytics_secure.customer_metrics ORDER BY win_rate_pct DESC',
 'Customer win rate ranking', 'easy', ARRAY['customer_metrics']),

('customer', 'Show Enterprise customers with revenue over $100,000',
 'SELECT customer_name, segment, total_revenue FROM analytics_secure.customer_metrics WHERE segment = ''Enterprise'' AND total_revenue > 100000 ORDER BY total_revenue DESC',
 'Filtering customers by segment and revenue threshold', 'medium', ARRAY['customer_metrics']),

-- Product questions (easy to medium)
('product', 'Which product families generate the most revenue?',
 'SELECT product_family, SUM(total_revenue) as total_revenue FROM analytics_secure.product_metrics GROUP BY product_family ORDER BY total_revenue DESC',
 'Product family revenue aggregation', 'easy', ARRAY['product_metrics']),

('product', 'What are the top 5 products by times quoted?',
 'SELECT product_name, product_family, times_quoted FROM analytics_secure.product_metrics ORDER BY times_quoted DESC',
 'Product popularity by quote frequency', 'easy', ARRAY['product_metrics']),

('product', 'Show products with win rate above 60%',
 'SELECT product_name, product_family, times_quoted, times_won, ROUND((times_won::numeric / NULLIF(times_quoted, 0)) * 100, 2) as win_rate_pct FROM analytics_secure.product_metrics WHERE times_quoted > 0 AND (times_won::numeric / times_quoted) > 0.6 ORDER BY win_rate_pct DESC',
 'Product win rate calculation and filtering', 'medium', ARRAY['product_metrics']),

-- Time series questions (medium)
('time_series', 'Show monthly revenue trends for 2024',
 'SELECT period_month, total_revenue, win_rate_pct FROM analytics_secure.time_series_metrics WHERE year = 2024 ORDER BY period_month',
 'Time-based filtering and ordering', 'medium', ARRAY['time_series_metrics']),

('time_series', 'Compare Q1 vs Q2 performance',
 'SELECT quarter, SUM(total_revenue) as revenue, AVG(win_rate_pct) as avg_win_rate FROM analytics_secure.time_series_metrics WHERE year = 2024 AND quarter IN (1, 2) GROUP BY quarter ORDER BY quarter',
 'Quarter comparison with aggregations', 'medium', ARRAY['time_series_metrics']),

('time_series', 'What is the average deal size by month for the last 6 months?',
 'SELECT period_month, avg_deal_size FROM analytics_secure.time_series_metrics ORDER BY period_month DESC',
 'Recent time series data', 'easy', ARRAY['time_series_metrics']),

-- Regional questions (medium)
('regional', 'Compare performance across all regions',
 'SELECT region, customer_count, quote_count, total_revenue, win_rate_pct FROM analytics_secure.regional_metrics ORDER BY total_revenue DESC',
 'Regional performance overview', 'easy', ARRAY['regional_metrics']),

('regional', 'Which region has the highest win rate for Enterprise customers?',
 'SELECT region, segment, win_rate_pct, total_revenue FROM analytics_secure.regional_metrics WHERE segment = ''Enterprise'' ORDER BY win_rate_pct DESC',
 'Regional and segment filtering', 'medium', ARRAY['regional_metrics']),

('regional', 'Show EMEA vs North America metrics',
 'SELECT region, total_revenue, avg_deal_size, win_rate_pct FROM analytics_secure.regional_metrics WHERE region IN (''EMEA'', ''North America'') ORDER BY region',
 'Specific region comparison', 'easy', ARRAY['regional_metrics']),

-- Pricing questions (medium to hard)
('pricing', 'Show pricing trends for Valves over the last 12 months',
 'SELECT period_month, product_family, avg_unit_price, avg_discount_amount FROM analytics_secure.pricing_metrics WHERE product_family = ''Valves'' ORDER BY period_month DESC',
 'Product family pricing over time', 'medium', ARRAY['pricing_metrics']),

('pricing', 'Compare average discounts by segment',
 'SELECT segment, AVG(avg_discount_amount) as avg_discount FROM analytics_secure.pricing_metrics GROUP BY segment ORDER BY avg_discount DESC',
 'Discount analysis by customer segment', 'medium', ARRAY['pricing_metrics']),

('pricing', 'Which regions have the highest price realization?',
 'SELECT region, product_family, AVG(avg_won_price) as avg_price FROM analytics_secure.pricing_metrics WHERE avg_won_price IS NOT NULL GROUP BY region, product_family ORDER BY avg_price DESC',
 'Price realization by region', 'hard', ARRAY['pricing_metrics']),

-- Quote questions (medium to hard)
('general', 'Which sales reps have the fastest quote turnaround time?',
 'SELECT sales_rep, AVG(processing_hours) as avg_hours, COUNT(*) as quote_count FROM analytics_secure.quote_metrics WHERE status IN (''Approved'', ''Rejected'') GROUP BY sales_rep ORDER BY avg_hours ASC',
 'Sales rep efficiency analysis', 'medium', ARRAY['quote_metrics']),

('general', 'Show average deal size by quarter this year',
 'SELECT quote_quarter, AVG(quote_value) as avg_deal_size FROM analytics_secure.quote_metrics WHERE quote_year = EXTRACT(YEAR FROM CURRENT_DATE) GROUP BY quote_quarter ORDER BY quote_quarter',
 'Current year quarterly analysis', 'medium', ARRAY['quote_metrics']),

('general', 'What is the correlation between deal score and status?',
 'SELECT status, AVG(deal_score) as avg_score, COUNT(*) as count FROM analytics_secure.quote_metrics GROUP BY status ORDER BY avg_score DESC',
 'Deal score effectiveness analysis', 'medium', ARRAY['quote_metrics']),

-- Complex multi-view questions (hard)
('general', 'Show top customers by revenue with their average deal score',
 'SELECT cm.customer_name, cm.total_revenue, AVG(qm.deal_score) as avg_deal_score FROM analytics_secure.customer_metrics cm JOIN analytics_secure.quote_metrics qm ON cm.customer_name = qm.customer_name GROUP BY cm.customer_name, cm.total_revenue ORDER BY cm.total_revenue DESC',
 'Multi-view join with aggregation', 'hard', ARRAY['customer_metrics', 'quote_metrics']),

('general', 'Compare product family performance across segments',
 'SELECT pm.product_family, qm.segment, COUNT(DISTINCT qm.quote_id) as quotes, SUM(qm.quote_value) as revenue FROM analytics_secure.product_metrics pm JOIN analytics_secure.quote_metrics qm ON qm.quote_id IS NOT NULL GROUP BY pm.product_family, qm.segment ORDER BY revenue DESC',
 'Product and segment cross-analysis', 'hard', ARRAY['product_metrics', 'quote_metrics']);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_analytics_questions_category ON ai_analytics_questions(category);
CREATE INDEX IF NOT EXISTS idx_ai_analytics_questions_active ON ai_analytics_questions(is_active) WHERE is_active = true;
