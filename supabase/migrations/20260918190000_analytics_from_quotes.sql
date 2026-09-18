/*
  # Derive the remaining Analytics tabs from quotes, and stop over-counting

  Three separate problems, all on the Analytics screen.

  ## 1. Distinct counts are not additive

  `mv_pricing_monthly` is grouped by month x family x region x channel. A
  quote that touches four product families lands in four buckets, so its
  `quotes` column counts it four times. `refresh_pricing_aggregates` summed
  that column into `analytics_business_performance.active_quotes`, and the
  same for `customers`. Measured against 3M lines in the scale database the
  headline quote count read 421,956 against a true 105,489 - almost exactly
  4x. Revenue and margin were unaffected; those are additive.

  The fix is to take both counts from `mv_customer_monthly`, where the grain
  is month x customer. A quote has exactly one customer and exactly one
  month, so summing there is exact - verified equal to
  `count(DISTINCT quote_id)` on the raw table.

  The two non-additive columns are renamed `bucket_*` so that the next person
  to reach for them has to think about it first. They remain useful for what
  they actually say: how many distinct quotes touched this family this month.

  ## 2. The price waterfall was a single hardcoded demo row

  One row, dated December 2023, with a $1,000,000 list price and round-number
  discounts. Nothing derived it and nothing refreshed it. It is replaced with
  a derivation from finalised quotes, which means the waterfall can only show
  the layers the data actually supports:

    list price     - from `price_list_items`, for lines whose price list
                     carries the part. Lines without a list price are
                     excluded from the waterfall and counted, so the screen
                     can state its own coverage.
    volume         - the part of the line discount explained by an applicable
                     quantity break. Capped at the discount actually given.
    other          - the remainder of the on-invoice discount.
    invoice price  - what was actually quoted.
    rebates,
    payment terms,
    freight        - NOT captured anywhere in the source extracts. These are
                     left NULL rather than zero: zero asserts there is no
                     off-invoice leakage, which is a claim no one has made.
                     Their NOT NULL defaults are dropped for this reason.
    pocket price   - equals invoice price while the three above are unknown.

  Contract/SPA attribution is deliberately not guessed. `spa_linked_lines`
  reports how many lines could be tied to a special pricing agreement, which
  is zero until ITT's SPA extract is loaded.

  ## 3. The funnel cannot report a win rate, and should not invent one

  `quotes.outcome` is empty on every row. Approved and Rejected are internal
  approval decisions, not customer wins and losses. The funnel therefore
  maps approval state to its review stages and leaves `win_rate` NULL unless
  `outcome` is populated, so the screen shows an em dash instead of a number
  that would be read as a win rate by a sales manager.
*/

/* ------------------------------------------------------------------ */
/* 1. Rename the non-additive columns                                  */
/* ------------------------------------------------------------------ */

ALTER MATERIALIZED VIEW mv_pricing_monthly RENAME COLUMN quotes    TO bucket_quotes;
ALTER MATERIALIZED VIEW mv_pricing_monthly RENAME COLUMN customers TO bucket_customers;
ALTER MATERIALIZED VIEW mv_product_monthly RENAME COLUMN quotes    TO bucket_quotes;

COMMENT ON COLUMN mv_pricing_monthly.bucket_quotes IS
  'Distinct quotes touching THIS bucket. Not additive across buckets - a quote spanning several families is counted in each. For a total, sum mv_customer_monthly.quotes.';
COMMENT ON COLUMN mv_pricing_monthly.bucket_customers IS
  'Distinct customers in THIS bucket. Not additive across buckets. For a total, count rows in mv_customer_monthly for the month.';
COMMENT ON COLUMN mv_product_monthly.bucket_quotes IS
  'Distinct quotes containing this product. Not additive across products - a quote with several products is counted in each.';
COMMENT ON COLUMN mv_customer_monthly.quotes IS
  'Distinct quotes for this customer in this month. Additive: a quote has exactly one customer and one month.';

/* ------------------------------------------------------------------ */
/* 2. Waterfall: let unknown be unknown                                */
/* ------------------------------------------------------------------ */

ALTER TABLE analytics_price_waterfall
  ALTER COLUMN rebates       DROP NOT NULL,
  ALTER COLUMN payment_terms DROP NOT NULL,
  ALTER COLUMN freight       DROP NOT NULL,
  ALTER COLUMN rebates       DROP DEFAULT,
  ALTER COLUMN payment_terms DROP DEFAULT,
  ALTER COLUMN freight       DROP DEFAULT;

ALTER TABLE analytics_price_waterfall
  ADD COLUMN IF NOT EXISTS lines_total           bigint  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lines_with_list_price bigint  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lines_with_break      bigint  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spa_linked_lines      bigint  NOT NULL DEFAULT 0;

COMMENT ON COLUMN analytics_price_waterfall.rebates IS
  'NULL means not captured in any source extract, which is the current state. Zero would assert there are no rebates.';
COMMENT ON COLUMN analytics_price_waterfall.payment_terms IS
  'NULL means not captured in any source extract. See rebates.';
COMMENT ON COLUMN analytics_price_waterfall.freight IS
  'NULL means not captured in any source extract. See rebates.';
COMMENT ON COLUMN analytics_price_waterfall.promotional_discount IS
  'Residual on-invoice discount not explained by a quantity break. Not necessarily promotional - it is the unexplained remainder.';
COMMENT ON COLUMN analytics_price_waterfall.lines_with_list_price IS
  'Of lines_total, how many carried a list price and so could enter the waterfall. The screen reports this as coverage.';

/*
 * One row per month, plus one all-time row with a NULL period grain is NOT
 * produced: the screen asks for the most recent period with all four
 * dimensions NULL, so the monthly unfiltered rows serve it directly.
 */
CREATE OR REPLACE FUNCTION refresh_price_waterfall()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows bigint;
BEGIN
  DELETE FROM analytics_price_waterfall;

  INSERT INTO analytics_price_waterfall
    (period_start, period_end, product_family, region, channel, segment,
     list_price, volume_discount, contract_discount, promotional_discount,
     invoice_price, rebates, payment_terms, freight, pocket_price,
     lines_total, lines_with_list_price, lines_with_break, spa_linked_lines)
  WITH lines AS (
    SELECT f.month,
           f.qty,
           f.effective_price,
           pli.list_price,
           /* The break that applies to this quantity. Widest match wins on
              ties, which mirrors the quoting path in utils/pricing. */
           (SELECT qb.discount_percent
              FROM quantity_breaks qb
             WHERE qb.product_id = f.product_id
               AND f.qty >= qb.min_quantity
               AND (qb.max_quantity IS NULL OR f.qty <= qb.max_quantity)
             ORDER BY qb.min_quantity DESC
             LIMIT 1) AS break_percent
      FROM v_finalised_quote_lines f
      LEFT JOIN quotes q  ON q.id = f.quote_id
      LEFT JOIN price_list_items pli
             ON pli.product_id = f.product_id
            AND pli.price_list_id = q.price_list_id
  ), priced AS (
    SELECT month,
           qty,
           list_price * qty                                   AS list_value,
           effective_price * qty                              AS invoice_value,
           GREATEST(list_price * qty - effective_price * qty, 0) AS discount_value,
           COALESCE(break_percent, 0)                         AS break_percent,
           (break_percent IS NOT NULL)                        AS has_break
      FROM lines
     WHERE list_price IS NOT NULL AND list_price > 0
  ), split AS (
    SELECT month,
           list_value,
           invoice_value,
           /* Volume is what the break rule accounts for, never more than the
              discount actually given. The rest is unexplained. */
           LEAST(list_value * break_percent / 100, discount_value) AS volume_value,
           discount_value
             - LEAST(list_value * break_percent / 100, discount_value) AS other_value,
           has_break
      FROM priced
  ), totals AS (
    SELECT month,
           sum(list_value)    AS list_value,
           sum(invoice_value) AS invoice_value,
           sum(volume_value)  AS volume_value,
           sum(other_value)   AS other_value,
           count(*)           AS lines_with_list_price,
           count(*) FILTER (WHERE has_break) AS lines_with_break
      FROM split GROUP BY month
  ), coverage AS (
    SELECT month, count(*) AS lines_total
      FROM v_finalised_quote_lines GROUP BY month
  )
  SELECT c.month,
         (c.month + interval '1 month - 1 day')::date,
         NULL, NULL, NULL, NULL,
         COALESCE(t.list_value, 0),
         COALESCE(t.volume_value, 0),
         0,                              /* contract: no SPA linkage yet */
         COALESCE(t.other_value, 0),
         COALESCE(t.invoice_value, 0),
         NULL, NULL, NULL,               /* rebates, terms, freight */
         COALESCE(t.invoice_value, 0),   /* pocket = invoice while those are unknown */
         c.lines_total,
         COALESCE(t.lines_with_list_price, 0),
         COALESCE(t.lines_with_break, 0),
         0
    FROM coverage c
    LEFT JOIN totals t ON t.month = c.month;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_price_waterfall() TO authenticated;

/* ------------------------------------------------------------------ */
/* 3. Funnel: stages from approval state, win rate only from outcome   */
/* ------------------------------------------------------------------ */

ALTER TABLE analytics_quote_funnel
  DROP CONSTRAINT IF EXISTS analytics_quote_funnel_stage_check;
ALTER TABLE analytics_quote_funnel
  ADD CONSTRAINT analytics_quote_funnel_stage_check
  CHECK (stage IN ('technical_review', 'negotiation', 'won', 'lost'));

COMMENT ON COLUMN analytics_quote_funnel.win_rate IS
  'NULL unless quotes.outcome is populated. Approved/Rejected are approval decisions, not wins and losses, and must not be reported as a win rate.';
COMMENT ON COLUMN analytics_quote_funnel.stage IS
  'technical_review = awaiting approval; negotiation = approved, no outcome recorded; won/lost = from quotes.outcome only.';

CREATE OR REPLACE FUNCTION refresh_quote_funnel()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows bigint;
BEGIN
  DELETE FROM analytics_quote_funnel WHERE period_type = 'month';

  INSERT INTO analytics_quote_funnel
    (period_start, period_end, period_type, region, channel, segment,
     business_type, stage, quote_count, quote_value, average_value,
     win_rate, average_cycle_time_days, conversion_rate)
  WITH classified AS (
    SELECT q.id,
           date_trunc('month', q.created_at)::date AS month,
           q.total,
           q.outcome,
           q.turnaround_time_hours,
           /* Repeat if this customer had an earlier quote. Cheap window,
              and it is the only definition the data supports. */
           CASE WHEN EXISTS (SELECT 1 FROM quotes p
                              WHERE p.customer_id = q.customer_id
                                AND p.created_at < q.created_at)
                THEN 'repeat' ELSE 'new' END AS business_type,
           CASE
             WHEN lower(q.outcome) IN ('won', 'win')  THEN 'won'
             WHEN lower(q.outcome) IN ('lost', 'loss') THEN 'lost'
             WHEN q.status = 'Approved'                THEN 'negotiation'
             ELSE 'technical_review'
           END AS stage
      FROM quotes q
     WHERE q.status <> 'Draft'
  ), agg AS (
    SELECT month, business_type, stage,
           count(*)                       AS quote_count,
           COALESCE(sum(total), 0)        AS quote_value,
           avg(total)                     AS average_value,
           avg(turnaround_time_hours) / 24 AS cycle_days
      FROM classified GROUP BY month, business_type, stage
  ), outcomes AS (
    SELECT month, business_type,
           count(*) FILTER (WHERE stage = 'won')  AS won,
           count(*) FILTER (WHERE stage IN ('won','lost')) AS decided
      FROM classified GROUP BY month, business_type
  ), period_totals AS (
    SELECT month, business_type, sum(quote_count) AS all_quotes
      FROM agg GROUP BY month, business_type
  )
  SELECT a.month,
         (a.month + interval '1 month - 1 day')::date,
         'month',
         NULL, NULL, NULL,
         a.business_type,
         a.stage,
         a.quote_count,
         a.quote_value,
         round(a.average_value, 2),
         /* Only a real outcome produces a win rate. */
         CASE WHEN o.decided > 0
              THEN LEAST(999.99, o.won::numeric / o.decided * 100)
              ELSE NULL END,
         round(a.cycle_days)::int,
         LEAST(999.99, a.quote_count::numeric / NULLIF(pt.all_quotes, 0) * 100)
    FROM agg a
    JOIN outcomes      o  ON o.month = a.month AND o.business_type = a.business_type
    JOIN period_totals pt ON pt.month = a.month AND pt.business_type = a.business_type;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_quote_funnel() TO authenticated;

/* ------------------------------------------------------------------ */
/* 4. Driver: exact counts, and the two new derivations               */
/* ------------------------------------------------------------------ */

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
           sum(revenue)         AS revenue,
           sum(approved_lines)  AS approved,
           sum(approved_lines + rejected_lines) AS finalised,
           sum(margin_value)    AS margin_total,
           sum(avg_price * priced_lines) / NULLIF(sum(priced_lines), 0) AS avg_price,
           sum(avg_cost  * costed_lines) / NULLIF(sum(costed_lines), 0) AS avg_cost
      FROM mv_pricing_monthly GROUP BY month
  ), counts AS (
    /* Quote and customer counts come from the customer grain, where they are
       additive. Summing them out of mv_pricing_monthly counted a quote once
       per product family it touched. */
    SELECT month, sum(quotes) AS quotes, count(*) AS customers
      FROM mv_customer_monthly GROUP BY month
  ), base AS (
    SELECT avg_price AS base_price, avg_cost AS base_cost FROM monthly
     WHERE avg_price > 0 AND avg_cost > 0 ORDER BY month LIMIT 1
  )
  SELECT m.month, (m.month + interval '1 month - 1 day')::date, 'month',
         COALESCE(m.revenue, 0), COALESCE(cn.quotes, 0),
         /* Approval rate, not a win rate. quotes.outcome is the only source
            for won/lost and it is empty; see refresh_quote_funnel. */
         LEAST(999.99, COALESCE(m.approved::numeric / NULLIF(m.finalised, 0) * 100, 0)),
         COALESCE(cn.customers, 0),
         LEAST(99999999.99, COALESCE(m.avg_price / NULLIF(b.base_price, 0) * 100, 100)),
         LEAST(99999999.99, COALESCE(m.avg_cost  / NULLIF(b.base_cost,  0) * 100, 100)),
         LEAST(999.99, GREATEST(-999.99,
           COALESCE(m.avg_price / NULLIF(b.base_price,0) * 100
                  - m.avg_cost  / NULLIF(b.base_cost, 0) * 100, 0))),
         m.margin_total
    FROM monthly m
    LEFT JOIN counts cn ON cn.month = m.month
    CROSS JOIN base b
   ORDER BY m.month;
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

  v_step := clock_timestamp();
  v_rows := refresh_price_waterfall();
  v_total := v_total + v_rows;
  view_name := 'analytics_price_waterfall'; rows_written := v_rows;
  duration_ms := (extract(epoch FROM clock_timestamp() - v_step) * 1000)::int;
  RETURN NEXT;

  v_step := clock_timestamp();
  v_rows := refresh_quote_funnel();
  v_total := v_total + v_rows;
  view_name := 'analytics_quote_funnel'; rows_written := v_rows;
  duration_ms := (extract(epoch FROM clock_timestamp() - v_step) * 1000)::int;
  RETURN NEXT;

  INSERT INTO aggregate_refresh_log (duration_ms, rows_written)
  VALUES ((extract(epoch FROM clock_timestamp() - v_started) * 1000)::int, v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_pricing_aggregates() TO authenticated;
