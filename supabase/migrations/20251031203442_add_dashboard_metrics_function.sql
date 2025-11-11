/*
  # Add Dashboard Metrics Function
  
  Creates a database function to efficiently retrieve dashboard metrics including:
  - Revenue (12 months current vs previous year)
  - Active Quotes (12 months current vs previous year)
  - Win Rate (12 months current vs previous year)
  - Active Customers (12 months current vs previous year)
  
  This function calculates year-over-year comparisons for the dashboard.
*/

CREATE OR REPLACE FUNCTION get_dashboard_metrics()
RETURNS TABLE (
  revenue_12m numeric,
  revenue_prev_12m numeric,
  active_quotes_12m bigint,
  active_quotes_prev_12m bigint,
  win_rate_12m numeric,
  win_rate_prev_12m numeric,
  active_customers_12m bigint,
  active_customers_prev_12m bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Revenue (Approved quotes in last 12 months)
    COALESCE(SUM(CASE WHEN q.status = 'Approved' AND q.created_at >= CURRENT_DATE - INTERVAL '12 months' THEN q.total ELSE 0 END), 0) as revenue_12m,
    
    -- Previous year revenue
    COALESCE(SUM(CASE WHEN q.status = 'Approved' AND q.created_at >= CURRENT_DATE - INTERVAL '24 months' AND q.created_at < CURRENT_DATE - INTERVAL '12 months' THEN q.total ELSE 0 END), 0) as revenue_prev_12m,
    
    -- Active quotes (all quotes in last 12 months)
    COUNT(CASE WHEN q.created_at >= CURRENT_DATE - INTERVAL '12 months' THEN 1 END) as active_quotes_12m,
    
    -- Previous year active quotes
    COUNT(CASE WHEN q.created_at >= CURRENT_DATE - INTERVAL '24 months' AND q.created_at < CURRENT_DATE - INTERVAL '12 months' THEN 1 END) as active_quotes_prev_12m,
    
    -- Win rate (Approved / (Approved + Rejected) for last 12 months)
    CASE
      WHEN COUNT(CASE WHEN q.status IN ('Approved', 'Rejected') AND q.created_at >= CURRENT_DATE - INTERVAL '12 months' THEN 1 END) > 0
      THEN ROUND((COUNT(CASE WHEN q.status = 'Approved' AND q.created_at >= CURRENT_DATE - INTERVAL '12 months' THEN 1 END)::numeric / 
            COUNT(CASE WHEN q.status IN ('Approved', 'Rejected') AND q.created_at >= CURRENT_DATE - INTERVAL '12 months' THEN 1 END)::numeric * 100)::numeric, 1)
      ELSE 0
    END as win_rate_12m,
    
    -- Previous year win rate
    CASE
      WHEN COUNT(CASE WHEN q.status IN ('Approved', 'Rejected') AND q.created_at >= CURRENT_DATE - INTERVAL '24 months' AND q.created_at < CURRENT_DATE - INTERVAL '12 months' THEN 1 END) > 0
      THEN ROUND((COUNT(CASE WHEN q.status = 'Approved' AND q.created_at >= CURRENT_DATE - INTERVAL '24 months' AND q.created_at < CURRENT_DATE - INTERVAL '12 months' THEN 1 END)::numeric / 
            COUNT(CASE WHEN q.status IN ('Approved', 'Rejected') AND q.created_at >= CURRENT_DATE - INTERVAL '24 months' AND q.created_at < CURRENT_DATE - INTERVAL '12 months' THEN 1 END)::numeric * 100)::numeric, 1)
      ELSE 0
    END as win_rate_prev_12m,
    
    -- Active customers (distinct customers with quotes in last 12 months)
    COUNT(DISTINCT CASE WHEN q.created_at >= CURRENT_DATE - INTERVAL '12 months' THEN q.customer_id END) as active_customers_12m,
    
    -- Previous year active customers
    COUNT(DISTINCT CASE WHEN q.created_at >= CURRENT_DATE - INTERVAL '24 months' AND q.created_at < CURRENT_DATE - INTERVAL '12 months' THEN q.customer_id END) as active_customers_prev_12m
    
  FROM quotes q;
END;
$$;
