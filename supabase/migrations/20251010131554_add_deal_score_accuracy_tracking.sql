/*
  # Deal Score Accuracy Tracking System

  1. New Tables
    - `deal_outcomes` - Tracks final outcome and escalation data
    - `deal_score_accuracy_metrics` - Aggregated metrics by segment
    - `deal_score_recommendations` - Auto-generated recommendations

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
*/

-- Deal Outcomes Table
CREATE TABLE IF NOT EXISTS deal_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id text REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  outcome text CHECK (outcome IN ('won', 'lost', 'cancelled', 'pending')) DEFAULT 'pending',
  win_date date,
  loss_reason text,
  actual_close_value decimal(15,2),
  approval_levels_reached integer DEFAULT 0,
  was_escalated boolean DEFAULT false,
  escalation_reason text,
  deal_score_at_creation integer,
  deal_score_at_close integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE deal_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view deal outcomes"
  ON deal_outcomes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert deal outcomes"
  ON deal_outcomes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update deal outcomes"
  ON deal_outcomes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Deal Score Accuracy Metrics Table
CREATE TABLE IF NOT EXISTS deal_score_accuracy_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_type text CHECK (segment_type IN ('product_family', 'product_category', 'customer_segment', 'customer_region', 'overall')) NOT NULL,
  segment_value text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_deals integer DEFAULT 0,
  won_deals integer DEFAULT 0,
  lost_deals integer DEFAULT 0,
  escalated_deals integer DEFAULT 0,
  avg_deal_score decimal(5,2),
  win_rate decimal(5,4),
  escalation_rate decimal(5,4),
  accuracy_score decimal(5,4),
  avg_discount_percent decimal(5,2),
  recommendations_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(segment_type, segment_value, period_start, period_end)
);

ALTER TABLE deal_score_accuracy_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accuracy metrics"
  ON deal_score_accuracy_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert accuracy metrics"
  ON deal_score_accuracy_metrics FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update accuracy metrics"
  ON deal_score_accuracy_metrics FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Deal Score Recommendations Table
CREATE TABLE IF NOT EXISTS deal_score_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_type text NOT NULL,
  segment_value text NOT NULL,
  issue_type text CHECK (issue_type IN ('high_escalation', 'low_win_rate', 'score_drift', 'discount_pattern')) NOT NULL,
  severity text CHECK (severity IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
  current_metric_value decimal(10,4),
  threshold_value decimal(10,4),
  recommendation_text text NOT NULL,
  suggested_action text,
  status text CHECK (status IN ('active', 'acknowledged', 'implemented', 'dismissed')) DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id),
  implemented_at timestamptz,
  notes text
);

ALTER TABLE deal_score_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recommendations"
  ON deal_score_recommendations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert recommendations"
  ON deal_score_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update recommendations"
  ON deal_score_recommendations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_deal_outcomes_quote_id ON deal_outcomes(quote_id);
CREATE INDEX IF NOT EXISTS idx_deal_outcomes_outcome ON deal_outcomes(outcome);
CREATE INDEX IF NOT EXISTS idx_deal_outcomes_was_escalated ON deal_outcomes(was_escalated);
CREATE INDEX IF NOT EXISTS idx_accuracy_metrics_segment ON deal_score_accuracy_metrics(segment_type, segment_value);
CREATE INDEX IF NOT EXISTS idx_accuracy_metrics_period ON deal_score_accuracy_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON deal_score_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_severity ON deal_score_recommendations(severity);

-- Function to calculate accuracy score
CREATE OR REPLACE FUNCTION calculate_deal_score_accuracy(
  p_escalation_rate decimal,
  p_win_rate decimal,
  p_avg_discount decimal
) RETURNS decimal AS $$
BEGIN
  RETURN ROUND(
    (1 - LEAST(p_escalation_rate, 1.0)) * 
    p_win_rate * 
    (1 - LEAST(p_avg_discount / 100.0, 1.0)) * 100,
    2
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- View for deal score analysis by product family
CREATE OR REPLACE VIEW deal_score_analysis_by_product_family AS
SELECT 
  pf.name as segment_value,
  COUNT(DISTINCT q.id) as total_deals,
  COUNT(DISTINCT CASE WHEN outcome.outcome = 'won' THEN q.id END) as won_deals,
  COUNT(DISTINCT CASE WHEN outcome.outcome = 'lost' THEN q.id END) as lost_deals,
  COUNT(DISTINCT CASE WHEN outcome.was_escalated = true THEN q.id END) as escalated_deals,
  ROUND(AVG(q.deal_score), 2) as avg_deal_score,
  ROUND(
    COUNT(DISTINCT CASE WHEN outcome.outcome = 'won' THEN q.id END)::decimal / 
    NULLIF(COUNT(DISTINCT CASE WHEN outcome.outcome IN ('won', 'lost') THEN q.id END), 0),
    4
  ) as win_rate,
  ROUND(
    COUNT(DISTINCT CASE WHEN outcome.was_escalated = true THEN q.id END)::decimal / 
    NULLIF(COUNT(DISTINCT q.id), 0),
    4
  ) as escalation_rate,
  ROUND(AVG(
    CASE WHEN ql.unit_price > 0 
    THEN (ql.discount_applied / ql.unit_price) * 100 
    ELSE 0 END
  ), 2) as avg_discount_percent
FROM quotes q
LEFT JOIN deal_outcomes outcome ON q.id = outcome.quote_id
LEFT JOIN quote_lines ql ON q.id = ql.quote_id
LEFT JOIN products p ON ql.product_id = p.id
LEFT JOIN product_families pf ON p.family_id = pf.id
WHERE q.created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY pf.name;

-- View for deal score analysis by customer segment
CREATE OR REPLACE VIEW deal_score_analysis_by_customer_segment AS
SELECT 
  c.segment as segment_value,
  COUNT(DISTINCT q.id) as total_deals,
  COUNT(DISTINCT CASE WHEN outcome.outcome = 'won' THEN q.id END) as won_deals,
  COUNT(DISTINCT CASE WHEN outcome.outcome = 'lost' THEN q.id END) as lost_deals,
  COUNT(DISTINCT CASE WHEN outcome.was_escalated = true THEN q.id END) as escalated_deals,
  ROUND(AVG(q.deal_score), 2) as avg_deal_score,
  ROUND(
    COUNT(DISTINCT CASE WHEN outcome.outcome = 'won' THEN q.id END)::decimal / 
    NULLIF(COUNT(DISTINCT CASE WHEN outcome.outcome IN ('won', 'lost') THEN q.id END), 0),
    4
  ) as win_rate,
  ROUND(
    COUNT(DISTINCT CASE WHEN outcome.was_escalated = true THEN q.id END)::decimal / 
    NULLIF(COUNT(DISTINCT q.id), 0),
    4
  ) as escalation_rate,
  ROUND(AVG(
    CASE WHEN ql.unit_price > 0 
    THEN (ql.discount_applied / ql.unit_price) * 100 
    ELSE 0 END
  ), 2) as avg_discount_percent
FROM quotes q
LEFT JOIN deal_outcomes outcome ON q.id = outcome.quote_id
LEFT JOIN customers c ON q.customer_id = c.id
LEFT JOIN quote_lines ql ON q.id = ql.quote_id
WHERE q.created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY c.segment;
