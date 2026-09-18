/*
  # Give analytics_price_performance the period it requires

  `period_start` and `period_end` are NOT NULL on that table and the refresh
  did not supply them, so the insert aborted. The window it summarises is the
  whole of the data it read, and the family and category it already had to
  hand were being dropped as well - both are on `products`, and the screen
  filters on them.
*/

CREATE OR REPLACE FUNCTION refresh_price_performance()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows  bigint;
  v_from  date;
  v_to    date;
BEGIN
  SELECT min(month), max((month + interval '1 month - 1 day')::date)
    INTO v_from, v_to
    FROM mv_product_monthly;

  IF v_from IS NULL THEN
    DELETE FROM analytics_price_performance;
    RETURN 0;
  END IF;

  DELETE FROM analytics_price_performance;

  INSERT INTO analytics_price_performance
    (period_start, period_end, product_id, product_family, product_category,
     part_number, sales, margin_at_list_pct, average_discount_pct,
     pareto_category, pareto_cumulative_pct)
  WITH totals AS (
    SELECT pm.product_id,
           p.name      AS part_number,
           p.family_id AS product_family,
           p.category  AS product_category,
           sum(pm.revenue)      AS sales,
           sum(pm.margin_value) AS margin_value,
           avg(pm.avg_discount) AS avg_discount
      FROM mv_product_monthly pm
      JOIN products p ON p.id = pm.product_id
     GROUP BY pm.product_id, p.name, p.family_id, p.category
    HAVING sum(pm.revenue) > 0
  ),
  ranked AS (
    SELECT t.*,
           sum(sales) OVER (ORDER BY sales DESC, product_id ROWS UNBOUNDED PRECEDING)
             / NULLIF(sum(sales) OVER (), 0) * 100 AS cumulative_pct
      FROM totals t
  )
  SELECT v_from, v_to, product_id, product_family, product_category, part_number,
         sales,
         /* Margin on revenue. Named _at_list by the original schema, but no
            list price is available for most parts, so this is margin on what
            was actually quoted. */
         LEAST(999.99, GREATEST(-999.99,
           COALESCE(margin_value / NULLIF(sales, 0) * 100, 0))),
         LEAST(999.99, GREATEST(-999.99, COALESCE(avg_discount, 0))),
         CASE WHEN cumulative_pct <= 80 THEN 'A'
              WHEN cumulative_pct <= 95 THEN 'B'
              WHEN cumulative_pct <= 99 THEN 'C'
              ELSE 'D' END,
         LEAST(999.99, cumulative_pct)
    FROM ranked;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_price_performance() TO authenticated;

/* Rebuild the driver to delegate, rather than carry the insert twice. */
CREATE OR REPLACE FUNCTION refresh_pricing_aggregates()
RETURNS TABLE (view_name text, rows_written bigint, duration_ms integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started timestamptz := clock_timestamp();
  v_step    timestamptz;
  v_rows    bigint;
  v_total   bigint := 0;
  v_name    text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['mv_pricing_monthly','mv_product_monthly',
                                'mv_customer_monthly','mv_deal_score_monthly']
  LOOP
    v_step := clock_timestamp();
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', v_name);
    EXECUTE format('SELECT count(*) FROM %I', v_name) INTO v_rows;
    v_total := v_total + v_rows;
    view_name := v_name; rows_written := v_rows;
    duration_ms := (extract(epoch FROM clock_timestamp() - v_step) * 1000)::int;
    RETURN NEXT;
  END LOOP;

  v_step := clock_timestamp();
  DELETE FROM analytics_business_performance WHERE period_type = 'month';
  INSERT INTO analytics_business_performance
    (period_start, period_end, period_type, revenue, active_quotes, win_rate,
     active_customers, price_index, cost_index, value_gap_pct, margin_total)
  WITH monthly AS (
    SELECT month,
           sum(revenue) AS revenue, sum(quotes) AS quotes, sum(customers) AS customers,
           sum(approved_lines) AS approved,
           sum(approved_lines + rejected_lines) AS finalised,
           sum(margin_value) AS margin_total,
           sum(avg_price * priced_lines) / NULLIF(sum(priced_lines), 0) AS avg_price,
           sum(avg_cost  * costed_lines) / NULLIF(sum(costed_lines), 0) AS avg_cost
      FROM mv_pricing_monthly GROUP BY month
  ), base AS (
    SELECT avg_price AS base_price, avg_cost AS base_cost FROM monthly
     WHERE avg_price > 0 AND avg_cost > 0 ORDER BY month LIMIT 1
  )
  SELECT m.month, (m.month + interval '1 month - 1 day')::date, 'month',
         COALESCE(m.revenue, 0), COALESCE(m.quotes, 0),
         LEAST(999.99, COALESCE(m.approved::numeric / NULLIF(m.finalised, 0) * 100, 0)),
         COALESCE(m.customers, 0),
         LEAST(99999999.99, COALESCE(m.avg_price / NULLIF(b.base_price, 0) * 100, 100)),
         LEAST(99999999.99, COALESCE(m.avg_cost  / NULLIF(b.base_cost,  0) * 100, 100)),
         LEAST(999.99, GREATEST(-999.99,
           COALESCE(m.avg_price / NULLIF(b.base_price,0) * 100
                  - m.avg_cost  / NULLIF(b.base_cost, 0) * 100, 0))),
         m.margin_total
    FROM monthly m CROSS JOIN base b ORDER BY m.month;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;
  view_name := 'analytics_business_performance'; rows_written := v_rows;
  duration_ms := (extract(epoch FROM clock_timestamp() - v_step) * 1000)::int;
  RETURN NEXT;

  v_step := clock_timestamp();
  v_rows := refresh_price_performance();
  v_total := v_total + v_rows;
  view_name := 'analytics_price_performance'; rows_written := v_rows;
  duration_ms := (extract(epoch FROM clock_timestamp() - v_step) * 1000)::int;
  RETURN NEXT;

  INSERT INTO aggregate_refresh_log (duration_ms, rows_written)
  VALUES ((extract(epoch FROM clock_timestamp() - v_started) * 1000)::int, v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_pricing_aggregates() TO authenticated;
