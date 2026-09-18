/*
  # Serve the dashboard KPI strip from the aggregate layer

  The strip's query scanned every quote line in the window under row-level
  security. Measured on the three-million-line database it took 3.7 seconds,
  and it runs on the first screen a user sees after signing in.

  Two things had to be added before the aggregates could answer it.

  ## List price reaches the view

  Net price realization is quoted price over list price, so the view needs a
  list price per line. The rule is the one the dashboard already used: the
  price on the quote's own price list, falling back to the highest price
  recorded for that product on any list. The fallback exists because ITT's
  quote extract carries no price list column, and a higher denominator is the
  conservative choice - a lower one would flatter realization.

  ## Sums, not averages, where the average is unweighted

  `avg_margin` on the strip is the mean of each line's margin percentage, and
  `avg_discount` the mean of each line's discount. An average of bucket
  averages is not that number: a bucket holding one line would count as much
  as a bucket holding a thousand. The view therefore carries the sums and the
  counts, and the mean is recombined from them, which is exact.

  `mv_pricing_monthly` has to be dropped and recreated rather than replaced;
  a materialised view has no CREATE OR REPLACE. Nothing depends on it except
  the refresh driver, which names it as a string.

  Like the other charts, the strip now reflects finalised quotes only. The
  raw query counted drafts, so a rep opening a quote and typing a price moved
  the company margin figure on everyone's dashboard.
*/

CREATE OR REPLACE VIEW v_finalised_quote_lines AS
WITH best_list AS (
  /* One row per product rather than a correlated lookup per line. */
  SELECT product_id, max(list_price) AS list_price
    FROM price_list_items GROUP BY product_id
)
SELECT q.id                                            AS quote_id,
       q.customer_id,
       q.status,
       q.outcome,
       q.created_at,
       date_trunc('month', q.created_at)::date         AS month,
       q.deal_score,
       ql.product_id,
       COALESCE(p.family_id, '(none)')                 AS family_id,
       p.category,
       COALESCE(c.region, '')                          AS region,
       COALESCE(c.segment, '')                         AS channel,
       COALESCE(ql.quantity, 1)                        AS qty,
       ql.unit_price,
       COALESCE(ql.discount_applied, 0)                AS discount,
       COALESCE(ql.booked_cost, p.base_cost)           AS unit_cost,
       ql.unit_price * (1 - COALESCE(ql.discount_applied, 0) / 100) AS effective_price,
       COALESCE(pli.list_price, bl.list_price)         AS list_price
  FROM quote_lines ql
  JOIN quotes    q ON q.id = ql.quote_id
  JOIN products  p ON p.id = ql.product_id
  LEFT JOIN customers c ON c.id = q.customer_id
  LEFT JOIN best_list bl ON bl.product_id = ql.product_id
  LEFT JOIN price_list_items pli
         ON pli.product_id = ql.product_id
        AND pli.price_list_id = q.price_list_id
 WHERE q.status IN ('Approved', 'Rejected', 'Won', 'Lost');

COMMENT ON VIEW v_finalised_quote_lines IS
  'Finalised quote lines (Approved, Rejected, Won, Lost) with cost, effective price and list price resolved. Drafts and in-flight quotes are excluded because they are not evidence of a price anyone agreed to - not as a privacy control. Every status included here is readable line-by-line by any authenticated user under the quote_lines SELECT policy, which is what makes the materialised views built on it safe to read without RLS.';

DROP MATERIALIZED VIEW IF EXISTS mv_pricing_monthly;

CREATE MATERIALIZED VIEW mv_pricing_monthly AS
SELECT month,
       family_id,
       region,
       channel,
       count(*)                                                      AS lines,
       count(DISTINCT quote_id)                                      AS bucket_quotes,
       count(DISTINCT customer_id)                                   AS bucket_customers,
       count(*) FILTER (WHERE unit_price IS NOT NULL AND unit_price > 0) AS priced_lines,
       count(*) FILTER (WHERE unit_cost IS NOT NULL AND unit_cost > 0)   AS costed_lines,
       count(*) FILTER (WHERE list_price IS NOT NULL AND list_price > 0) AS listed_lines,
       sum(effective_price * qty)                                    AS revenue,
       sum(unit_cost * qty) FILTER (WHERE unit_cost IS NOT NULL)      AS cost,
       avg(discount)                                                 AS avg_discount,
       avg(effective_price) FILTER (WHERE unit_price IS NOT NULL)     AS avg_price,
       avg(unit_cost) FILTER (WHERE unit_cost IS NOT NULL AND unit_cost > 0) AS avg_cost,
       sum((effective_price - unit_cost) * qty)
         FILTER (WHERE unit_cost IS NOT NULL AND unit_cost > 0)      AS margin_value,
       count(*) FILTER (WHERE status = 'Approved')                   AS approved_lines,
       count(*) FILTER (WHERE status = 'Rejected')                   AS rejected_lines,

       /* Unweighted means are recombined from these, not averaged again. */
       sum(discount)                                                 AS discount_sum,
       sum((effective_price - unit_cost) / effective_price * 100)
         FILTER (WHERE unit_cost IS NOT NULL AND unit_cost > 0
                   AND effective_price > 0)                          AS margin_pct_sum,
       count(*) FILTER (WHERE unit_cost IS NOT NULL AND unit_cost > 0
                          AND effective_price > 0)                   AS margin_pct_lines,

       /* Realization: quoted over list, across lines that carry a list. */
       sum(list_price * qty) FILTER (WHERE list_price IS NOT NULL AND list_price > 0)
                                                                     AS list_value,
       sum(effective_price * qty) FILTER (WHERE list_price IS NOT NULL AND list_price > 0)
                                                                     AS listed_revenue
  FROM v_finalised_quote_lines
 GROUP BY month, family_id, region, channel;

CREATE UNIQUE INDEX mv_pricing_monthly_key
  ON mv_pricing_monthly (month, family_id, region, channel);
CREATE INDEX mv_pricing_monthly_month ON mv_pricing_monthly (month DESC);

COMMENT ON COLUMN mv_pricing_monthly.bucket_quotes IS
  'Distinct quotes touching THIS bucket. Not additive across buckets - a quote spanning several families is counted in each. For a total, sum mv_customer_monthly.quotes.';
COMMENT ON COLUMN mv_pricing_monthly.bucket_customers IS
  'Distinct customers in THIS bucket. Not additive across buckets. For a total, count rows in mv_customer_monthly for the month.';
COMMENT ON COLUMN mv_pricing_monthly.margin_pct_sum IS
  'Sum of per-line margin percentages, with margin_pct_lines as its divisor. The dashboard reports the unweighted mean of line margins; averaging bucket averages would not give that.';
COMMENT ON COLUMN mv_pricing_monthly.list_value IS
  'Sum of list_price * qty over lines carrying a list price. listed_revenue is the quoted value of the SAME lines, so realization is listed_revenue / list_value.';

GRANT SELECT ON mv_pricing_monthly TO authenticated;
