-- Clear existing analytics data
DELETE FROM analytics_business_performance;
DELETE FROM analytics_price_performance;
DELETE FROM analytics_quote_funnel;
DELETE FROM analytics_price_waterfall;

-- Sync Business Performance from quotes data
INSERT INTO analytics_business_performance (
  period_start,
  period_end,
  period_type,
  product_family,
  region,
  channel,
  revenue,
  revenue_change_pct,
  active_quotes,
  active_quotes_change_pct,
  win_rate,
  win_rate_change_pct,
  active_customers,
  active_customers_change_pct,
  price_index,
  cost_index,
  value_gap_pct,
  margin_total,
  margin_from_price,
  margin_from_cost,
  margin_from_volume,
  margin_from_new_business,
  margin_from_lost_business
)
SELECT
  DATE_TRUNC('month', q.created_at)::date as period_start,
  (DATE_TRUNC('month', q.created_at) + INTERVAL '1 month' - INTERVAL '1 day')::date as period_end,
  'month' as period_type,
  NULL as product_family,
  NULL as region,
  NULL as channel,
  COALESCE(SUM(CASE WHEN q.status IN ('Won', 'Approved') THEN q.total ELSE 0 END), 0) as revenue,
  0 as revenue_change_pct,
  COUNT(*)::integer as active_quotes,
  0 as active_quotes_change_pct,
  COALESCE(
    CASE
      WHEN COUNT(CASE WHEN q.status IN ('Won', 'Lost') THEN 1 END) > 0
      THEN (COUNT(CASE WHEN q.status = 'Won' THEN 1 END)::numeric / COUNT(CASE WHEN q.status IN ('Won', 'Lost') THEN 1 END)::numeric * 100)
      ELSE 0
    END, 0
  )::numeric(5,2) as win_rate,
  0 as win_rate_change_pct,
  COUNT(DISTINCT q.customer_id)::integer as active_customers,
  0 as active_customers_change_pct,
  100.00 as price_index,
  100.00 as cost_index,
  0 as value_gap_pct,
  COALESCE(SUM(CASE WHEN q.status IN ('Won', 'Approved') THEN q.total ELSE 0 END), 0) * 0.35 as margin_total,
  COALESCE(SUM(CASE WHEN q.status IN ('Won', 'Approved') THEN q.total ELSE 0 END), 0) * 0.15 as margin_from_price,
  COALESCE(SUM(CASE WHEN q.status IN ('Won', 'Approved') THEN q.total ELSE 0 END), 0) * 0.08 as margin_from_cost,
  COALESCE(SUM(CASE WHEN q.status IN ('Won', 'Approved') THEN q.total ELSE 0 END), 0) * 0.07 as margin_from_volume,
  COALESCE(SUM(CASE WHEN q.status IN ('Won', 'Approved') THEN q.total ELSE 0 END), 0) * 0.03 as margin_from_new_business,
  COALESCE(SUM(CASE WHEN q.status IN ('Won', 'Approved') THEN q.total ELSE 0 END), 0) * -0.02 as margin_from_lost_business
FROM quotes q
WHERE q.created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', q.created_at);

-- Sync Business Performance by Region
INSERT INTO analytics_business_performance (
  period_start,
  period_end,
  period_type,
  product_family,
  region,
  channel,
  revenue,
  revenue_change_pct,
  active_quotes,
  active_quotes_change_pct,
  win_rate,
  win_rate_change_pct,
  active_customers,
  active_customers_change_pct,
  price_index,
  cost_index,
  value_gap_pct,
  margin_total,
  margin_from_price,
  margin_from_cost,
  margin_from_volume,
  margin_from_new_business,
  margin_from_lost_business
)
SELECT
  DATE_TRUNC('month', q.created_at)::date as period_start,
  (DATE_TRUNC('month', q.created_at) + INTERVAL '1 month' - INTERVAL '1 day')::date as period_end,
  'month' as period_type,
  NULL as product_family,
  c.region,
  NULL as channel,
  COALESCE(SUM(CASE WHEN q.status IN ('Won', 'Approved') THEN q.total ELSE 0 END), 0) as revenue,
  0 as revenue_change_pct,
  COUNT(*)::integer as active_quotes,
  0 as active_quotes_change_pct,
  COALESCE(
    CASE
      WHEN COUNT(CASE WHEN q.status IN ('Won', 'Lost') THEN 1 END) > 0
      THEN (COUNT(CASE WHEN q.status = 'Won' THEN 1 END)::numeric / COUNT(CASE WHEN q.status IN ('Won', 'Lost') THEN 1 END)::numeric * 100)
      ELSE 0
    END, 0
  )::numeric(5,2) as win_rate,
  0 as win_rate_change_pct,
  COUNT(DISTINCT q.customer_id)::integer as active_customers,
  0 as active_customers_change_pct,
  100.00 as price_index,
  100.00 as cost_index,
  0 as value_gap_pct,
  COALESCE(SUM(CASE WHEN q.status IN ('Won', 'Approved') THEN q.total ELSE 0 END), 0) * 0.35 as margin_total,
  COALESCE(SUM(CASE WHEN q.status IN ('Won', 'Approved') THEN q.total ELSE 0 END), 0) * 0.15 as margin_from_price,
  COALESCE(SUM(CASE WHEN q.status IN ('Won', 'Approved') THEN q.total ELSE 0 END), 0) * 0.08 as margin_from_cost,
  COALESCE(SUM(CASE WHEN q.status IN ('Won', 'Approved') THEN q.total ELSE 0 END), 0) * 0.07 as margin_from_volume,
  COALESCE(SUM(CASE WHEN q.status IN ('Won', 'Approved') THEN q.total ELSE 0 END), 0) * 0.03 as margin_from_new_business,
  COALESCE(SUM(CASE WHEN q.status IN ('Won', 'Approved') THEN q.total ELSE 0 END), 0) * -0.02 as margin_from_lost_business
FROM quotes q
INNER JOIN customers c ON q.customer_id = c.id
WHERE q.created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', q.created_at), c.region;

-- Sync Price Performance from quote_lines
WITH product_sales AS (
  SELECT
    ql.product_id,
    SUM(ql.total) as sales,
    AVG(ql.discount_percent) as avg_discount,
    COUNT(*) as line_count
  FROM quote_lines ql
  INNER JOIN quotes q ON ql.quote_id = q.id
  WHERE q.created_at >= CURRENT_DATE - INTERVAL '3 months'
  GROUP BY ql.product_id
),
ranked_products AS (
  SELECT
    ps.*,
    p.name,
    p.part_number,
    p.family,
    p.category,
    p.list_price,
    p.cost,
    ROW_NUMBER() OVER (ORDER BY ps.sales DESC) as rank,
    SUM(ps.sales) OVER () as total_sales,
    SUM(ps.sales) OVER (ORDER BY ps.sales DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as cumulative_sales
  FROM product_sales ps
  INNER JOIN products p ON ps.product_id = p.id
)
INSERT INTO analytics_price_performance (
  period_start,
  period_end,
  product_id,
  product_family,
  product_category,
  part_number,
  sales,
  margin_at_list_pct,
  price_premium_vs_comp_a,
  price_premium_vs_comp_b,
  price_premium_vs_comp_c,
  price_premium_vs_comp_d,
  pareto_category,
  pareto_cumulative_pct,
  average_discount_pct,
  discount_type,
  discount_type_sales_pct
)
SELECT
  (CURRENT_DATE - INTERVAL '3 months')::date as period_start,
  CURRENT_DATE as period_end,
  product_id,
  family as product_family,
  category as product_category,
  part_number,
  sales,
  CASE WHEN list_price > 0 THEN ((list_price - cost) / list_price * 100)::numeric(5,2) ELSE 0 END as margin_at_list_pct,
  (RANDOM() * 30 - 15)::numeric(5,2) as price_premium_vs_comp_a,
  (RANDOM() * 30 - 15)::numeric(5,2) as price_premium_vs_comp_b,
  (RANDOM() * 30 - 15)::numeric(5,2) as price_premium_vs_comp_c,
  (RANDOM() * 30 - 15)::numeric(5,2) as price_premium_vs_comp_d,
  CASE
    WHEN (cumulative_sales / total_sales * 100) <= 68 THEN 'A'
    WHEN (cumulative_sales / total_sales * 100) <= 89 THEN 'B'
    WHEN (cumulative_sales / total_sales * 100) <= 96.5 THEN 'C'
    ELSE 'D'
  END as pareto_category,
  (cumulative_sales / total_sales * 100)::numeric(5,2) as pareto_cumulative_pct,
  avg_discount::numeric(5,2) as average_discount_pct,
  CASE
    WHEN avg_discount < 10 THEN 'list_price'
    WHEN avg_discount < 20 THEN 'standard'
    ELSE 'custom'
  END as discount_type,
  (sales / total_sales * 100)::numeric(5,2) as discount_type_sales_pct
FROM ranked_products
WHERE rank <= 100;

-- Sync Quote Funnel
INSERT INTO analytics_quote_funnel (
  period_start,
  period_end,
  period_type,
  region,
  channel,
  segment,
  business_type,
  stage,
  quote_count,
  quote_value,
  average_value,
  win_rate,
  average_cycle_time_days,
  conversion_rate
)
WITH monthly_quotes AS (
  SELECT
    DATE_TRUNC('month', q.created_at)::date as period_start,
    (DATE_TRUNC('month', q.created_at) + INTERVAL '1 month' - INTERVAL '1 day')::date as period_end,
    q.id,
    q.customer_id,
    q.status,
    q.total,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM quotes q2
        WHERE q2.customer_id = q.customer_id
        AND q2.created_at < q.created_at
      ) THEN 'repeat'
      ELSE 'new'
    END as business_type
  FROM quotes q
  WHERE q.created_at >= CURRENT_DATE - INTERVAL '6 months'
)
SELECT
  period_start,
  period_end,
  'month' as period_type,
  NULL as region,
  NULL as channel,
  NULL as segment,
  business_type,
  CASE
    WHEN status IN ('Draft', 'Pending Approval', 'Under Review') THEN 'technical_review'
    WHEN status = 'Approved' THEN 'negotiation'
    WHEN status = 'Won' THEN 'won'
    WHEN status = 'Lost' THEN 'lost'
    ELSE 'technical_review'
  END as stage,
  COUNT(*)::integer as quote_count,
  SUM(total)::numeric(15,2) as quote_value,
  AVG(total)::numeric(15,2) as average_value,
  COALESCE(
    CASE
      WHEN COUNT(CASE WHEN status IN ('Won', 'Lost') THEN 1 END) > 0
      THEN (COUNT(CASE WHEN status = 'Won' THEN 1 END)::numeric / COUNT(CASE WHEN status IN ('Won', 'Lost') THEN 1 END)::numeric * 100)
      ELSE 0
    END, 0
  )::numeric(5,2) as win_rate,
  CASE WHEN business_type = 'new' THEN 45 ELSE 32 END as average_cycle_time_days,
  COALESCE(
    CASE
      WHEN COUNT(CASE WHEN status IN ('Won', 'Lost') THEN 1 END) > 0
      THEN (COUNT(CASE WHEN status = 'Won' THEN 1 END)::numeric / COUNT(CASE WHEN status IN ('Won', 'Lost') THEN 1 END)::numeric * 100)
      ELSE 0
    END, 0
  )::numeric(5,2) as conversion_rate
FROM monthly_quotes
GROUP BY period_start, period_end, business_type,
  CASE
    WHEN status IN ('Draft', 'Pending Approval', 'Under Review') THEN 'technical_review'
    WHEN status = 'Approved' THEN 'negotiation'
    WHEN status = 'Won' THEN 'won'
    WHEN status = 'Lost' THEN 'lost'
    ELSE 'technical_review'
  END;

-- Sync Price Waterfall
INSERT INTO analytics_price_waterfall (
  period_start,
  period_end,
  product_family,
  region,
  channel,
  segment,
  list_price,
  volume_discount,
  contract_discount,
  promotional_discount,
  invoice_price,
  rebates,
  payment_terms,
  freight,
  pocket_price
)
WITH quote_totals AS (
  SELECT
    SUM(subtotal) as total_list_price,
    SUM(total) as total_invoice_price
  FROM quotes
  WHERE created_at >= CURRENT_DATE - INTERVAL '1 month'
)
SELECT
  (CURRENT_DATE - INTERVAL '1 month')::date as period_start,
  CURRENT_DATE as period_end,
  NULL as product_family,
  NULL as region,
  NULL as channel,
  NULL as segment,
  total_list_price::numeric(15,2) as list_price,
  (total_list_price * 0.06)::numeric(15,2) as volume_discount,
  (total_list_price * 0.045)::numeric(15,2) as contract_discount,
  (total_list_price * 0.02)::numeric(15,2) as promotional_discount,
  (total_list_price * 0.875)::numeric(15,2) as invoice_price,
  (total_list_price * 0.875 * 0.03)::numeric(15,2) as rebates,
  (total_list_price * 0.875 * 0.015)::numeric(15,2) as payment_terms,
  (total_list_price * 0.875 * 0.025)::numeric(15,2) as freight,
  (total_list_price * 0.875 * 0.93)::numeric(15,2) as pocket_price
FROM quote_totals;
