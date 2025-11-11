/*
  # Fix Dashboard Metrics Function

  Updates the get_dashboard_metrics function to use correct column names
  and return proper data structure for the dashboard.
  
  ## Changes
  - Use 'total' instead of 'total_price'
  - Calculate discount from quote_lines instead of quotes table
  - Return correct structure for frontend consumption
*/

DROP FUNCTION IF EXISTS get_dashboard_metrics(integer);

CREATE FUNCTION get_dashboard_metrics(
  p_period_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_metrics jsonb;
  v_revenue_12m numeric;
  v_revenue_prev_12m numeric;
  v_active_quotes_12m integer;
  v_active_quotes_prev_12m integer;
  v_win_rate_12m numeric;
  v_win_rate_prev_12m numeric;
  v_active_customers_12m integer;
  v_active_customers_prev_12m integer;
  v_avg_discount numeric;
  v_avg_deal_score numeric;
BEGIN
  -- Revenue for last 12 months
  SELECT COALESCE(SUM(total), 0)
  INTO v_revenue_12m
  FROM quotes
  WHERE status = 'Won'
    AND created_at >= NOW() - interval '12 months';

  -- Revenue for previous 12 months
  SELECT COALESCE(SUM(total), 0)
  INTO v_revenue_prev_12m
  FROM quotes
  WHERE status = 'Won'
    AND created_at >= NOW() - interval '24 months'
    AND created_at < NOW() - interval '12 months';

  -- Active quotes (Draft + Sent) last 12 months
  SELECT COUNT(*)
  INTO v_active_quotes_12m
  FROM quotes
  WHERE status IN ('Draft', 'Sent')
    AND created_at >= NOW() - interval '12 months';

  -- Active quotes previous 12 months
  SELECT COUNT(*)
  INTO v_active_quotes_prev_12m
  FROM quotes
  WHERE status IN ('Draft', 'Sent')
    AND created_at >= NOW() - interval '24 months'
    AND created_at < NOW() - interval '12 months';

  -- Win rate last 12 months
  SELECT COALESCE(
    COUNT(*) FILTER (WHERE status = 'Won')::numeric / 
    NULLIF(COUNT(*) FILTER (WHERE status IN ('Won', 'Lost')), 0) * 100,
    0
  )
  INTO v_win_rate_12m
  FROM quotes
  WHERE created_at >= NOW() - interval '12 months';

  -- Win rate previous 12 months
  SELECT COALESCE(
    COUNT(*) FILTER (WHERE status = 'Won')::numeric / 
    NULLIF(COUNT(*) FILTER (WHERE status IN ('Won', 'Lost')), 0) * 100,
    0
  )
  INTO v_win_rate_prev_12m
  FROM quotes
  WHERE created_at >= NOW() - interval '24 months'
    AND created_at < NOW() - interval '12 months';

  -- Active customers last 12 months
  SELECT COUNT(DISTINCT customer_id)
  INTO v_active_customers_12m
  FROM quotes
  WHERE created_at >= NOW() - interval '12 months';

  -- Active customers previous 12 months
  SELECT COUNT(DISTINCT customer_id)
  INTO v_active_customers_prev_12m
  FROM quotes
  WHERE created_at >= NOW() - interval '24 months'
    AND created_at < NOW() - interval '12 months';

  -- Average discount from quote lines
  SELECT COALESCE(AVG(discount_applied), 0)
  INTO v_avg_discount
  FROM quote_lines ql
  JOIN quotes q ON q.id = ql.quote_id
  WHERE q.created_at >= NOW() - interval '12 months';

  -- Average deal score
  SELECT COALESCE(AVG(deal_score), 0)
  INTO v_avg_deal_score
  FROM quotes
  WHERE status = 'Won'
    AND created_at >= NOW() - interval '12 months'
    AND deal_score IS NOT NULL;

  -- Build JSON response
  SELECT jsonb_build_object(
    'revenue_12m', ROUND(v_revenue_12m, 2),
    'revenue_prev_12m', ROUND(v_revenue_prev_12m, 2),
    'active_quotes_12m', v_active_quotes_12m,
    'active_quotes_prev_12m', v_active_quotes_prev_12m,
    'win_rate_12m', ROUND(v_win_rate_12m, 1),
    'win_rate_prev_12m', ROUND(v_win_rate_prev_12m, 1),
    'active_customers_12m', v_active_customers_12m,
    'active_customers_prev_12m', v_active_customers_prev_12m,
    'avg_discount', ROUND(v_avg_discount, 1),
    'avg_deal_score', ROUND(v_avg_deal_score, 1)
  )
  INTO v_metrics;
  
  RETURN v_metrics;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_metrics(integer) TO authenticated;
