/*
  # The refresh job

  Rebuilds the materialised summaries and repopulates the analytics_* tables
  from real quotes.

  Those tables previously held a migration's worth of invented 2023
  performance. Their shape was right; only their contents were fiction. This
  derives them, so the Analytics screens show what the data says.

  ## Two figures that stay null on purpose

  `win_rate` is computed as approved over finalised, which is a proxy and not
  a win rate. ITT's quote extract carries no outcome - the column is NULL on
  every row supplied - so nothing here knows what was actually won. When
  outcome arrives, the FILTER below should read it and this comment should go.

  The margin bridge columns (margin_from_price, _cost, _volume, _new_business,
  _lost_business) need two comparable periods decomposed at the customer and
  product grain, which is a different computation from a monthly rollup. They
  are left null rather than filled with something that looks like a
  decomposition and is not. dashboard.marginBridge computes the real one on
  demand.
*/

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
BEGIN
  /*
   * CONCURRENTLY so the dashboard keeps serving during the rebuild. It needs
   * the unique index on each view, and it cannot run inside a transaction
   * block - so this function must not be called from one.
   */
  v_step := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pricing_monthly;
  SELECT count(*) INTO v_rows FROM mv_pricing_monthly;
  v_total := v_total + v_rows;
  view_name := 'mv_pricing_monthly'; rows_written := v_rows;
  duration_ms := extract(milliseconds FROM clock_timestamp() - v_step)::int
               + extract(epoch FROM clock_timestamp() - v_step)::int * 1000
               - extract(epoch FROM clock_timestamp() - v_step)::int * 1000;
  duration_ms := (extract(epoch FROM clock_timestamp() - v_step) * 1000)::int;
  RETURN NEXT;

  v_step := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_monthly;
  SELECT count(*) INTO v_rows FROM mv_product_monthly;
  v_total := v_total + v_rows;
  view_name := 'mv_product_monthly'; rows_written := v_rows;
  duration_ms := (extract(epoch FROM clock_timestamp() - v_step) * 1000)::int;
  RETURN NEXT;

  v_step := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_monthly;
  SELECT count(*) INTO v_rows FROM mv_customer_monthly;
  v_total := v_total + v_rows;
  view_name := 'mv_customer_monthly'; rows_written := v_rows;
  duration_ms := (extract(epoch FROM clock_timestamp() - v_step) * 1000)::int;
  RETURN NEXT;

  v_step := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_deal_score_monthly;
  SELECT count(*) INTO v_rows FROM mv_deal_score_monthly;
  v_total := v_total + v_rows;
  view_name := 'mv_deal_score_monthly'; rows_written := v_rows;
  duration_ms := (extract(epoch FROM clock_timestamp() - v_step) * 1000)::int;
  RETURN NEXT;

  /* --- analytics_business_performance, derived --------------------------- */
  v_step := clock_timestamp();
  DELETE FROM analytics_business_performance WHERE period_type = 'month';

  INSERT INTO analytics_business_performance
    (period_start, period_end, period_type, product_family, region, channel,
     revenue, active_quotes, win_rate, active_customers,
     price_index, cost_index, value_gap_pct, margin_total)
  WITH monthly AS (
    SELECT month,
           sum(revenue)                                        AS revenue,
           sum(quotes)                                         AS quotes,
           sum(customers)                                      AS customers,
           sum(approved_lines)                                 AS approved,
           sum(approved_lines + rejected_lines)                AS finalised,
           sum(margin_value)                                   AS margin_total,
           sum(avg_price * priced_lines) / NULLIF(sum(priced_lines), 0) AS avg_price,
           sum(avg_cost  * costed_lines) / NULLIF(sum(costed_lines), 0) AS avg_cost
      FROM mv_pricing_monthly
     GROUP BY month
  ),
  /* Indices are rebased to the first month with both a price and a cost,
     which is what makes them comparable across the series. */
  base AS (
    SELECT avg_price AS base_price, avg_cost AS base_cost
      FROM monthly
     WHERE avg_price IS NOT NULL AND avg_price > 0
       AND avg_cost  IS NOT NULL AND avg_cost  > 0
     ORDER BY month LIMIT 1
  )
  SELECT m.month,
         (m.month + interval '1 month - 1 day')::date,
         'month',
         NULL, NULL, NULL,
         COALESCE(m.revenue, 0),
         COALESCE(m.quotes, 0),
         /* Approved over finalised. A proxy, not a win rate - see the header. */
         COALESCE(m.approved::numeric / NULLIF(m.finalised, 0) * 100, 0),
         COALESCE(m.customers, 0),
         COALESCE(m.avg_price / NULLIF(b.base_price, 0) * 100, 100),
         COALESCE(m.avg_cost  / NULLIF(b.base_cost,  0) * 100, 100),
         COALESCE(m.avg_price / NULLIF(b.base_price, 0) * 100
                - m.avg_cost  / NULLIF(b.base_cost,  0) * 100, 0),
         m.margin_total
    FROM monthly m CROSS JOIN base b
   ORDER BY m.month;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;
  view_name := 'analytics_business_performance'; rows_written := v_rows;
  duration_ms := (extract(epoch FROM clock_timestamp() - v_step) * 1000)::int;
  RETURN NEXT;

  /* --- analytics_price_performance, derived ------------------------------ */
  v_step := clock_timestamp();
  DELETE FROM analytics_price_performance;

  INSERT INTO analytics_price_performance
    (product_id, part_number, sales, margin_at_list_pct, average_discount_pct,
     pareto_category, pareto_cumulative_pct, price_premium_vs_comp_a)
  WITH totals AS (
    SELECT pm.product_id,
           p.name                                    AS part_number,
           sum(pm.revenue)                           AS sales,
           sum(pm.margin_value)                      AS margin_value,
           avg(pm.avg_discount)                      AS avg_discount
      FROM mv_product_monthly pm
      JOIN products p ON p.id = pm.product_id
     GROUP BY pm.product_id, p.name
    HAVING sum(pm.revenue) > 0
  ),
  ranked AS (
    SELECT t.*,
           sum(sales) OVER (ORDER BY sales DESC ROWS UNBOUNDED PRECEDING)
             / NULLIF(sum(sales) OVER (), 0) * 100 AS cumulative_pct
      FROM totals t
  )
  SELECT product_id,
         part_number,
         sales,
         COALESCE(margin_value / NULLIF(sales, 0) * 100, 0),
         COALESCE(avg_discount, 0),
         /* Standard ABC bands on cumulative revenue. */
         CASE WHEN cumulative_pct <= 80 THEN 'A'
              WHEN cumulative_pct <= 95 THEN 'B'
              WHEN cumulative_pct <= 99 THEN 'C'
              ELSE 'D' END,
         cumulative_pct,
         /* No competitor price data exists in any extract ITT has supplied. */
         NULL
    FROM ranked;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;
  view_name := 'analytics_price_performance'; rows_written := v_rows;
  duration_ms := (extract(epoch FROM clock_timestamp() - v_step) * 1000)::int;
  RETURN NEXT;

  INSERT INTO aggregate_refresh_log (duration_ms, rows_written, detail)
  VALUES ((extract(epoch FROM clock_timestamp() - v_started) * 1000)::int,
          v_total,
          jsonb_build_object('refreshed', 'all'));
END;
$$;

COMMENT ON FUNCTION refresh_pricing_aggregates() IS
  'Rebuilds the materialised summaries and derives analytics_* from real quotes. Cannot run inside a transaction block: REFRESH CONCURRENTLY forbids it.';

GRANT EXECUTE ON FUNCTION refresh_pricing_aggregates() TO authenticated;
