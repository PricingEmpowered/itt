/*
  # Pre-aggregation

  Two problems, one fix.

  ## The performance problem

  Benchmarked against 3,000,000 quote lines, the dashboard's pricing metrics
  query took 10.3 seconds through the API against 1.4 in psql. The difference
  is row-level security: the policy on quote_lines re-checks quote ownership
  through a correlated EXISTS, per row, three million times.

  That protection is correct and worth keeping - it is what stops one rep
  reading another's drafts - but it cannot be paid on every dashboard load.
  Measured against a pre-aggregated summary the same figures came back in
  1.2 milliseconds, from something that rebuilds in 1.9 seconds.

  ## The honesty problem

  The analytics_* tables are read by all four Analytics modules and were
  populated by a migration that invented twelve months of 2023 performance -
  $1.85M to $2.4M of monthly revenue, 72 to 76 percent win rates. Nothing
  derived them from the quotes table. That seed is now demo-only, which left
  the tables empty on a real install.

  Their shape was never the problem. period x family x region x channel with
  revenue, margin and the margin bridge is exactly what a pre-aggregation
  wants. So they are populated from real quotes here, and the same refresh
  serves both purposes.

  ## Why these views deliberately see every row

  A materialised view does not enforce row-level security, so these aggregate
  across all quotes regardless of who is asking. That is safe here for a
  specific reason rather than by assumption: **they aggregate only finalised
  quotes** - Approved, Rejected, Won, Lost - and the existing policy already
  makes every line of a finalised quote readable by every authenticated user.
  Drafts, which RLS restricts to their author, are excluded.

  So the views expose nothing a user could not already query, and they exclude
  the in-progress work that should not be in a peer statistic anyway.
*/

/* Finalised quotes only. Drafts are private and are not evidence. */
CREATE OR REPLACE VIEW v_finalised_quote_lines AS
SELECT q.id                                            AS quote_id,
       q.customer_id,
       q.status,
       q.outcome,
       q.created_at,
       date_trunc('month', q.created_at)::date         AS month,
       q.deal_score,
       ql.product_id,
       p.family_id,
       p.category,
       c.region,
       c.segment                                       AS channel,
       COALESCE(ql.quantity, 1)                        AS qty,
       ql.unit_price,
       COALESCE(ql.discount_applied, 0)                AS discount,
       COALESCE(ql.booked_cost, p.base_cost)           AS unit_cost,
       ql.unit_price * (1 - COALESCE(ql.discount_applied, 0) / 100) AS effective_price
  FROM quote_lines ql
  JOIN quotes    q ON q.id = ql.quote_id
  JOIN products  p ON p.id = ql.product_id
  LEFT JOIN customers c ON c.id = q.customer_id
 WHERE q.status IN ('Approved', 'Rejected', 'Won', 'Lost');

COMMENT ON VIEW v_finalised_quote_lines IS
  'Finalised quote lines with cost and effective price resolved. Excludes drafts, which RLS keeps private and which are not evidence of anything.';

/*
 * The grain every dashboard figure is derived from. Coarse enough that no
 * single quote is identifiable, fine enough to filter by family, region and
 * channel without returning to the transaction table.
 */
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_pricing_monthly AS
SELECT month,
       family_id,
       region,
       channel,
       count(*)                                                     AS lines,
       count(DISTINCT quote_id)                                     AS quotes,
       count(DISTINCT customer_id)                                  AS customers,
       count(*) FILTER (WHERE unit_price IS NOT NULL)               AS priced_lines,
       count(*) FILTER (WHERE unit_cost IS NOT NULL AND unit_cost > 0) AS costed_lines,
       sum(effective_price * qty)                                   AS revenue,
       sum(unit_cost * qty) FILTER (WHERE unit_cost IS NOT NULL)    AS cost,
       avg(discount)                                                AS avg_discount,
       avg(effective_price) FILTER (WHERE unit_price IS NOT NULL)   AS avg_price,
       avg(unit_cost) FILTER (WHERE unit_cost IS NOT NULL AND unit_cost > 0) AS avg_cost,
       sum((effective_price - unit_cost) * qty)
         FILTER (WHERE unit_cost IS NOT NULL AND unit_cost > 0)     AS margin_value,
       count(*) FILTER (WHERE status = 'Approved')                  AS approved_lines,
       count(*) FILTER (WHERE status = 'Rejected')                  AS rejected_lines
  FROM v_finalised_quote_lines
 GROUP BY month, family_id, region, channel;

/* REFRESH CONCURRENTLY needs a unique index, and concurrency is what keeps
   the refresh from locking the dashboard out while it runs. NULLs are real
   here - a product with no family, a customer with no region - so they are
   coalesced into the key rather than losing those rows from the index. */
CREATE UNIQUE INDEX IF NOT EXISTS mv_pricing_monthly_key
  ON mv_pricing_monthly (month, COALESCE(family_id, ''), COALESCE(region, ''), COALESCE(channel, ''));
CREATE INDEX IF NOT EXISTS mv_pricing_monthly_month ON mv_pricing_monthly (month DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_product_monthly AS
SELECT month,
       product_id,
       count(DISTINCT quote_id)                        AS quotes,
       sum(qty)                                        AS units,
       sum(effective_price * qty)                      AS revenue,
       sum((effective_price - unit_cost) * qty)
         FILTER (WHERE unit_cost IS NOT NULL AND unit_cost > 0) AS margin_value,
       avg(discount)                                   AS avg_discount
  FROM v_finalised_quote_lines
 WHERE product_id IS NOT NULL
 GROUP BY month, product_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_product_monthly_key
  ON mv_product_monthly (month, product_id);
CREATE INDEX IF NOT EXISTS mv_product_monthly_revenue ON mv_product_monthly (revenue DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_customer_monthly AS
SELECT month,
       customer_id,
       count(DISTINCT quote_id)                        AS quotes,
       sum(effective_price * qty)                      AS revenue,
       avg(discount)                                   AS avg_discount,
       sum((effective_price - unit_cost) * qty)
         FILTER (WHERE unit_cost IS NOT NULL AND unit_cost > 0) AS margin_value,
       count(*) FILTER (WHERE status = 'Approved')     AS approved_lines,
       count(*) FILTER (WHERE status = 'Rejected')     AS rejected_lines
  FROM v_finalised_quote_lines
 WHERE customer_id IS NOT NULL
 GROUP BY month, customer_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_customer_monthly_key
  ON mv_customer_monthly (month, customer_id);

/* Deal score health, which the dashboard reads on every load. */
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_deal_score_monthly AS
SELECT date_trunc('month', created_at)::date            AS month,
       count(*)                                         AS quotes,
       count(deal_score)                                AS scored,
       avg(deal_score)                                  AS avg_score,
       count(*) FILTER (WHERE deal_score >= 110)        AS excellent,
       count(*) FILTER (WHERE deal_score >= 90 AND deal_score < 110) AS good,
       count(*) FILTER (WHERE deal_score < 90)          AS attention
  FROM quotes
 WHERE status IN ('Approved', 'Rejected', 'Won', 'Lost')
 GROUP BY 1;

CREATE UNIQUE INDEX IF NOT EXISTS mv_deal_score_monthly_key ON mv_deal_score_monthly (month);

/* Aggregates only, over finalised quotes, which RLS already makes readable. */
GRANT SELECT ON mv_pricing_monthly, mv_product_monthly, mv_customer_monthly,
                mv_deal_score_monthly, v_finalised_quote_lines TO authenticated;

/* When the summaries were last rebuilt. A figure whose age is unknown is not
   a figure anyone should quote from. */
CREATE TABLE IF NOT EXISTS aggregate_refresh_log (
  id           bigserial PRIMARY KEY,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  duration_ms  integer,
  rows_written integer,
  detail       jsonb DEFAULT '{}'::jsonb
);

GRANT SELECT ON aggregate_refresh_log TO authenticated;
