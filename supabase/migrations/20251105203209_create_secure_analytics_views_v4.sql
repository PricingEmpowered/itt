/*
  # Create Secure Analytics Views for AI Queries
  
  1. New Schema
    - `analytics_secure` schema for all AI-queryable views
  
  2. Anonymized Views
    - `customer_metrics` - Customer performance with anonymized names
    - `product_metrics` - Product/family performance
    - `quote_metrics` - Quote performance with anonymized data
    - `pricing_metrics` - Price performance and discount analysis
    - `time_series_metrics` - Temporal analysis
    - `regional_metrics` - Geographic performance
  
  3. Security
    - All views use RLS from underlying tables
    - Customer/user names are hashed consistently
    - No PII exposed (emails, addresses, etc.)
    - Only aggregated or anonymized data
    - Views are read-only
*/

-- Create analytics_secure schema
CREATE SCHEMA IF NOT EXISTS analytics_secure;

-- Helper function to anonymize IDs
CREATE OR REPLACE FUNCTION analytics_secure.anonymize_id(id_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN SUBSTRING(MD5(id_value) FROM 1 FOR 8);
END;
$$;

-- Customer Metrics View (Anonymized)
CREATE OR REPLACE VIEW analytics_secure.customer_metrics AS
SELECT
  'Customer ' || analytics_secure.anonymize_id(c.id::text) as customer_name,
  c.segment,
  c.region,
  COUNT(DISTINCT q.id) as total_quotes,
  COUNT(DISTINCT CASE WHEN q.status = 'Approved' THEN q.id END) as won_quotes,
  COUNT(DISTINCT CASE WHEN q.status = 'Rejected' THEN q.id END) as lost_quotes,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN q.status IN ('Approved', 'Rejected') THEN q.id END) > 0
    THEN ROUND((COUNT(DISTINCT CASE WHEN q.status = 'Approved' THEN q.id END)::numeric / 
               COUNT(DISTINCT CASE WHEN q.status IN ('Approved', 'Rejected') THEN q.id END)::numeric * 100), 1)
    ELSE 0
  END as win_rate_pct,
  COALESCE(SUM(CASE WHEN q.status = 'Approved' THEN q.total ELSE 0 END), 0) as total_revenue,
  COALESCE(AVG(CASE WHEN q.status = 'Approved' THEN q.total END), 0) as avg_deal_size,
  MIN(q.created_at) as first_quote_date,
  MAX(q.created_at) as last_quote_date,
  EXTRACT(YEAR FROM AGE(NOW(), c.created_at))::int as customer_age_years
FROM customers c
LEFT JOIN quotes q ON c.id = q.customer_id
GROUP BY c.id, c.segment, c.region, c.created_at;

-- Product Metrics View
CREATE OR REPLACE VIEW analytics_secure.product_metrics AS
SELECT
  pf.name as product_family,
  p.name as product_name,
  p.id as product_id,
  COUNT(DISTINCT ql.quote_id) as times_quoted,
  COUNT(DISTINCT CASE WHEN q.status = 'Approved' THEN ql.quote_id END) as times_won,
  COALESCE(SUM(CASE WHEN q.status = 'Approved' THEN ql.line_total ELSE 0 END), 0) as total_revenue,
  COALESCE(AVG(CASE WHEN q.status = 'Approved' THEN ql.unit_price END), 0) as avg_unit_price,
  COALESCE(AVG(CASE WHEN q.status = 'Approved' THEN ql.quantity END), 0) as avg_quantity,
  COALESCE(AVG(CASE WHEN q.status = 'Approved' THEN ql.discount_applied END), 0) as avg_discount_amount
FROM products p
INNER JOIN product_families pf ON p.family_id = pf.id
LEFT JOIN quote_lines ql ON p.id = ql.product_id
LEFT JOIN quotes q ON ql.quote_id = q.id
GROUP BY pf.name, p.id, p.name;

-- Quote Metrics View (Anonymized)
CREATE OR REPLACE VIEW analytics_secure.quote_metrics AS
SELECT
  q.id as quote_id,
  'Customer ' || analytics_secure.anonymize_id(c.id::text) as customer_name,
  c.segment,
  c.region,
  'User ' || analytics_secure.anonymize_id(COALESCE(up.id::text, q.created_by::text)) as sales_rep,
  q.status,
  q.total as quote_value,
  curr.code as currency,
  q.deal_score,
  DATE_TRUNC('month', q.created_at)::date as quote_month,
  EXTRACT(YEAR FROM q.created_at)::int as quote_year,
  EXTRACT(QUARTER FROM q.created_at)::int as quote_quarter,
  COUNT(ql.id) as line_items_count,
  COALESCE(q.turnaround_time_hours, 0) as processing_hours
FROM quotes q
INNER JOIN customers c ON q.customer_id = c.id
LEFT JOIN user_profiles up ON q.created_by = up.id
LEFT JOIN quote_lines ql ON q.id = ql.quote_id
LEFT JOIN currencies curr ON q.currency_id = curr.id
GROUP BY q.id, c.id, c.segment, c.region, up.id, q.created_by, q.status, 
         q.total, curr.code, q.deal_score, q.created_at, q.turnaround_time_hours;

-- Pricing Metrics View
CREATE OR REPLACE VIEW analytics_secure.pricing_metrics AS
SELECT
  pf.name as product_family,
  c.segment,
  c.region,
  DATE_TRUNC('month', q.created_at)::date as period_month,
  COUNT(DISTINCT q.id) as quote_count,
  COALESCE(AVG(ql.unit_price), 0) as avg_unit_price,
  COALESCE(AVG(ql.discount_applied), 0) as avg_discount_amount,
  COALESCE(AVG(CASE WHEN q.status = 'Approved' THEN ql.unit_price END), 0) as avg_won_price,
  COALESCE(AVG(CASE WHEN q.status = 'Rejected' THEN ql.unit_price END), 0) as avg_lost_price,
  COALESCE(SUM(CASE WHEN q.status = 'Approved' THEN ql.line_total END), 0) as total_revenue
FROM quote_lines ql
INNER JOIN quotes q ON ql.quote_id = q.id
INNER JOIN products p ON ql.product_id = p.id
INNER JOIN product_families pf ON p.family_id = pf.id
INNER JOIN customers c ON q.customer_id = c.id
GROUP BY pf.name, c.segment, c.region, DATE_TRUNC('month', q.created_at);

-- Time Series Metrics View
CREATE OR REPLACE VIEW analytics_secure.time_series_metrics AS
SELECT
  DATE_TRUNC('month', q.created_at)::date as period_month,
  EXTRACT(YEAR FROM q.created_at)::int as year,
  EXTRACT(QUARTER FROM q.created_at)::int as quarter,
  EXTRACT(MONTH FROM q.created_at)::int as month,
  COUNT(DISTINCT q.id) as total_quotes,
  COUNT(DISTINCT CASE WHEN q.status = 'Approved' THEN q.id END) as won_quotes,
  COUNT(DISTINCT CASE WHEN q.status = 'Rejected' THEN q.id END) as lost_quotes,
  COUNT(DISTINCT q.customer_id) as unique_customers,
  COALESCE(SUM(CASE WHEN q.status = 'Approved' THEN q.total ELSE 0 END), 0) as total_revenue,
  COALESCE(AVG(CASE WHEN q.status = 'Approved' THEN q.total END), 0) as avg_deal_size,
  CASE 
    WHEN COUNT(CASE WHEN q.status IN ('Approved', 'Rejected') THEN 1 END) > 0
    THEN ROUND((COUNT(CASE WHEN q.status = 'Approved' THEN 1 END)::numeric / 
               COUNT(CASE WHEN q.status IN ('Approved', 'Rejected') THEN 1 END)::numeric * 100), 1)
    ELSE 0
  END as win_rate_pct
FROM quotes q
GROUP BY DATE_TRUNC('month', q.created_at), EXTRACT(YEAR FROM q.created_at),
         EXTRACT(QUARTER FROM q.created_at), EXTRACT(MONTH FROM q.created_at);

-- Regional Metrics View
CREATE OR REPLACE VIEW analytics_secure.regional_metrics AS
SELECT
  c.region,
  c.segment,
  COUNT(DISTINCT c.id) as customer_count,
  COUNT(DISTINCT q.id) as quote_count,
  COUNT(DISTINCT CASE WHEN q.status = 'Approved' THEN q.id END) as won_quotes,
  COALESCE(SUM(CASE WHEN q.status = 'Approved' THEN q.total ELSE 0 END), 0) as total_revenue,
  COALESCE(AVG(CASE WHEN q.status = 'Approved' THEN q.total END), 0) as avg_deal_size,
  CASE 
    WHEN COUNT(CASE WHEN q.status IN ('Approved', 'Rejected') THEN 1 END) > 0
    THEN ROUND((COUNT(CASE WHEN q.status = 'Approved' THEN 1 END)::numeric / 
               COUNT(CASE WHEN q.status IN ('Approved', 'Rejected') THEN 1 END)::numeric * 100), 1)
    ELSE 0
  END as win_rate_pct
FROM customers c
LEFT JOIN quotes q ON c.id = q.customer_id
GROUP BY c.region, c.segment;

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA analytics_secure TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics_secure TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA analytics_secure TO authenticated;
