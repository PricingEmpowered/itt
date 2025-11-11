/*
  # Fix Function Search Paths for Security

  Sets stable search_path for security-critical functions to prevent
  search_path manipulation attacks.
  
  ## Security Impact
  - Prevents malicious search_path changes
  - Ensures functions use correct schema
  - Hardens security for SECURITY DEFINER functions
  
  ## Functions Fixed
  - determine_approval_level
  - calculate_quote_turnaround_time
  - get_dashboard_metrics
  - calculate_deal_score_accuracy
  - analytics_secure.anonymize_id
*/

-- Drop existing functions to recreate with proper search_path
DROP FUNCTION IF EXISTS determine_approval_level(numeric, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS get_dashboard_metrics(integer) CASCADE;
DROP FUNCTION IF EXISTS calculate_deal_score_accuracy() CASCADE;
DROP FUNCTION IF EXISTS analytics_secure.anonymize_id(text) CASCADE;

-- Drop triggers before dropping function
DROP TRIGGER IF EXISTS trigger_calculate_turnaround_time ON quotes;
DROP TRIGGER IF EXISTS trg_calculate_quote_turnaround ON quotes;
DROP FUNCTION IF EXISTS calculate_quote_turnaround_time() CASCADE;

-- Recreate determine_approval_level with fixed search_path
CREATE FUNCTION determine_approval_level(
  p_discount_percent numeric,
  p_quote_total numeric,
  p_margin_percent numeric
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_required_level text;
BEGIN
  SELECT COALESCE(
    (
      SELECT MIN(required_approval_level) 
      FROM approval_workflow_rules
      WHERE is_active = true
        AND (max_discount_percent IS NULL OR p_discount_percent <= max_discount_percent)
        AND (max_quote_value IS NULL OR p_quote_total <= max_quote_value)
        AND (min_margin_percent IS NULL OR p_margin_percent >= min_margin_percent)
    ),
    'none'
  ) INTO v_required_level;
  
  RETURN v_required_level;
END;
$$;

-- Recreate calculate_quote_turnaround_time with fixed search_path
CREATE FUNCTION calculate_quote_turnaround_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_turnaround_hours numeric;
BEGIN
  IF NEW.status IN ('Sent', 'Won', 'Lost') AND OLD.status = 'Draft' THEN
    v_turnaround_hours := EXTRACT(EPOCH FROM (NEW.updated_at - NEW.created_at)) / 3600;
    
    INSERT INTO quote_speed_metrics (
      quote_id,
      turnaround_time_hours,
      complexity_score,
      num_line_items,
      required_approval,
      approval_delay_hours
    )
    VALUES (
      NEW.id,
      v_turnaround_hours,
      NEW.deal_score,
      (SELECT COUNT(*) FROM quote_lines WHERE quote_id = NEW.id),
      EXISTS(SELECT 1 FROM approval_requests WHERE quote_id = NEW.id),
      CASE 
        WHEN EXISTS(SELECT 1 FROM approval_requests WHERE quote_id = NEW.id) 
        THEN (
          SELECT EXTRACT(EPOCH FROM (MAX(approved_at) - MIN(requested_at))) / 3600
          FROM approval_requests
          WHERE quote_id = NEW.id AND status = 'Approved'
        )
        ELSE 0
      END
    )
    ON CONFLICT (quote_id) DO UPDATE
    SET turnaround_time_hours = EXCLUDED.turnaround_time_hours,
        complexity_score = EXCLUDED.complexity_score,
        num_line_items = EXCLUDED.num_line_items,
        required_approval = EXCLUDED.required_approval,
        approval_delay_hours = EXCLUDED.approval_delay_hours;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate get_dashboard_metrics with fixed search_path
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
BEGIN
  WITH period_quotes AS (
    SELECT *
    FROM quotes
    WHERE created_at >= NOW() - (p_period_days || ' days')::interval
  ),
  metrics AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'Won') as won_deals,
      COUNT(*) FILTER (WHERE status IN ('Draft', 'Sent')) as active_quotes,
      COALESCE(SUM(total_price) FILTER (WHERE status = 'Won'), 0) as pipeline_value,
      COALESCE(AVG(deal_score) FILTER (WHERE status = 'Won'), 0) as avg_deal_score,
      COALESCE(AVG(discount_applied), 0) as avg_discount,
      COALESCE(
        COUNT(*) FILTER (WHERE status = 'Won')::numeric / 
        NULLIF(COUNT(*) FILTER (WHERE status IN ('Won', 'Lost')), 0),
        0
      ) * 100 as win_rate
    FROM period_quotes
  )
  SELECT jsonb_build_object(
    'won_deals', won_deals,
    'active_quotes', active_quotes,
    'pipeline_value', pipeline_value,
    'avg_deal_score', ROUND(avg_deal_score, 1),
    'avg_discount', ROUND(avg_discount, 1),
    'win_rate', ROUND(win_rate, 1)
  )
  INTO v_metrics
  FROM metrics;
  
  RETURN v_metrics;
END;
$$;

-- Recreate calculate_deal_score_accuracy with fixed search_path
CREATE FUNCTION calculate_deal_score_accuracy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO deal_score_accuracy_metrics (
    time_period,
    segment_type,
    segment_value,
    total_deals,
    predicted_wins,
    actual_wins,
    accuracy_rate,
    avg_score_won,
    avg_score_lost,
    score_discrimination
  )
  SELECT
    date_trunc('month', q.created_at)::date,
    'overall',
    'all',
    COUNT(*),
    SUM(CASE WHEN q.deal_score >= 70 THEN 1 ELSE 0 END),
    SUM(CASE WHEN q.status = 'Won' THEN 1 ELSE 0 END),
    CASE 
      WHEN SUM(CASE WHEN q.deal_score >= 70 THEN 1 ELSE 0 END) > 0 THEN
        (SUM(CASE WHEN q.deal_score >= 70 AND q.status = 'Won' THEN 1 ELSE 0 END)::numeric / 
         SUM(CASE WHEN q.deal_score >= 70 THEN 1 ELSE 0 END)) * 100
      ELSE 0
    END,
    AVG(CASE WHEN q.status = 'Won' THEN q.deal_score ELSE NULL END),
    AVG(CASE WHEN q.status = 'Lost' THEN q.deal_score ELSE NULL END),
    AVG(CASE WHEN q.status = 'Won' THEN q.deal_score ELSE NULL END) - 
    AVG(CASE WHEN q.status = 'Lost' THEN q.deal_score ELSE NULL END)
  FROM quotes q
  WHERE q.status IN ('Won', 'Lost')
    AND q.created_at >= date_trunc('month', CURRENT_DATE - interval '12 months')
  GROUP BY date_trunc('month', q.created_at)
  ON CONFLICT (time_period, segment_type, segment_value) 
  DO UPDATE SET
    total_deals = EXCLUDED.total_deals,
    predicted_wins = EXCLUDED.predicted_wins,
    actual_wins = EXCLUDED.actual_wins,
    accuracy_rate = EXCLUDED.accuracy_rate,
    avg_score_won = EXCLUDED.avg_score_won,
    avg_score_lost = EXCLUDED.avg_score_lost,
    score_discrimination = EXCLUDED.score_discrimination,
    updated_at = NOW();
END;
$$;

-- Recreate analytics_secure.anonymize_id with fixed search_path
CREATE FUNCTION analytics_secure.anonymize_id(id_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = analytics_secure, pg_temp
AS $$
BEGIN
  RETURN SUBSTRING(MD5(id_value) FROM 1 FOR 8);
END;
$$;

-- Recreate trigger
CREATE TRIGGER trigger_calculate_turnaround_time
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION calculate_quote_turnaround_time();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION determine_approval_level(numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_quote_turnaround_time() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_metrics(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_deal_score_accuracy() TO authenticated;
GRANT EXECUTE ON FUNCTION analytics_secure.anonymize_id(text) TO authenticated;
