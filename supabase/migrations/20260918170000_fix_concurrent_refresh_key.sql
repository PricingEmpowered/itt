/*
  # Make mv_pricing_monthly refreshable concurrently

  REFRESH MATERIALIZED VIEW CONCURRENTLY requires a unique index built from
  plain column names. The index on mv_pricing_monthly used
  COALESCE(family_id, '') to keep rows with a null family in the index, which
  PostgreSQL rejects for this purpose:

      cannot refresh materialized view concurrently
      HINT: Create a unique index with no WHERE clause on one or more columns

  Coalescing inside the view instead of inside the index fixes both halves of
  the problem at once: the key columns are never null, so a plain unique index
  works, and a null family or region becomes a visible '(none)' bucket rather
  than a row that quietly falls out of the index.

  Concurrency is not a nicety here. Without it the refresh takes an exclusive
  lock and the dashboard returns nothing for the duration, which on a nightly
  job is the difference between invisible and an outage.
*/

DROP MATERIALIZED VIEW IF EXISTS mv_pricing_monthly CASCADE;

CREATE MATERIALIZED VIEW mv_pricing_monthly AS
SELECT month,
       /* Never null, so a plain unique index can carry the key. */
       COALESCE(family_id, '(none)')                                AS family_id,
       COALESCE(region,    '(none)')                                AS region,
       COALESCE(channel,   '(none)')                                AS channel,
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
 GROUP BY month, COALESCE(family_id, '(none)'), COALESCE(region, '(none)'),
          COALESCE(channel, '(none)');

CREATE UNIQUE INDEX mv_pricing_monthly_key
  ON mv_pricing_monthly (month, family_id, region, channel);
CREATE INDEX mv_pricing_monthly_month ON mv_pricing_monthly (month DESC);

GRANT SELECT ON mv_pricing_monthly TO authenticated;
