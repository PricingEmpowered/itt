/**
 * Quantity-break analytics.
 *
 * These four queries used to be sent from the browser as SQL strings to
 * `execute_analytics_query`, a SECURITY DEFINER function that ran whatever it
 * was given. That function has been dropped (see db/post/900_grants.sql), and
 * it was never needed: the queries are fixed and known at build time, so they
 * live here as named procedures.
 *
 * The histogram query previously interpolated a product id straight into its
 * SQL text; it is a bound parameter now.
 */
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc.js';

const ORDERING_PATTERNS = `
  SELECT ql.product_id,
         p.name AS product_name,
         p.category AS product_category,
         COUNT(DISTINCT ql.quote_id) AS times_ordered,
         SUM(ql.quantity) AS total_quantity_ordered,
         AVG(ql.quantity) AS avg_quantity_per_order,
         MIN(ql.quantity) AS min_quantity,
         MAX(ql.quantity) AS max_quantity,
         AVG(ql.unit_price) AS avg_unit_price,
         AVG(COALESCE(ql.discount_applied, 0)) AS avg_discount_percent,
         SUM(ql.quantity * ql.unit_price * (1 - COALESCE(ql.discount_applied, 0) / 100)) AS total_revenue
    FROM quote_lines ql
    JOIN products p ON p.id = ql.product_id
    JOIN quotes q ON q.id = ql.quote_id
   WHERE q.status <> 'Cancelled'
   GROUP BY ql.product_id, p.name, p.category
   ORDER BY total_quantity_ordered DESC
   LIMIT 50
`;

const BREAK_EFFECTIVENESS = `
  WITH quantity_break_usage AS (
    SELECT ql.product_id,
           p.name AS product_name,
           qb.id AS break_id,
           qb.min_quantity,
           qb.max_quantity,
           qb.discount_percent,
           COUNT(*) AS times_triggered,
           SUM(ql.quantity) AS total_quantity_in_tier,
           AVG(ql.quantity) AS avg_order_size_in_tier,
           SUM(ql.quantity * ql.unit_price * (1 - COALESCE(ql.discount_applied, 0) / 100)) AS revenue_in_tier,
           SUM(ql.quantity * ql.unit_price * COALESCE(ql.discount_applied, 0) / 100) AS discount_cost
      FROM quote_lines ql
      JOIN products p ON p.id = ql.product_id
      JOIN quotes q ON q.id = ql.quote_id
      JOIN quantity_breaks qb ON qb.product_id = ql.product_id
     WHERE q.status <> 'Cancelled'
       AND ql.quantity >= qb.min_quantity
       AND (qb.max_quantity IS NULL OR ql.quantity <= qb.max_quantity)
     GROUP BY ql.product_id, p.name, qb.id, qb.min_quantity, qb.max_quantity, qb.discount_percent
  )
  SELECT product_id,
         product_name,
         CASE WHEN max_quantity IS NULL THEN min_quantity::text || '+'
              ELSE min_quantity::text || '-' || max_quantity::text
         END AS break_tier,
         min_quantity,
         max_quantity,
         discount_percent,
         times_triggered,
         total_quantity_in_tier,
         ROUND(avg_order_size_in_tier, 2) AS avg_order_size_in_tier,
         ROUND(revenue_in_tier, 2) AS revenue_in_tier,
         ROUND(discount_cost, 2) AS discount_cost,
         ROUND(CASE WHEN discount_cost > 0 THEN revenue_in_tier / discount_cost ELSE 0 END, 2)
           AS effectiveness_score
    FROM quantity_break_usage
   ORDER BY product_name, min_quantity
`;

/*
 * The bucket label is assigned in a subquery rather than in the outer
 * SELECT. PostgreSQL resolves names inside an ORDER BY *expression* against
 * input columns, not output aliases, so the original
 * `ORDER BY CASE quantity_range WHEN ...` failed with
 * `column "quantity_range" does not exist`. Bucketing first makes the label
 * a real column that GROUP BY and ORDER BY can both use.
 */
const QUANTITY_DISTRIBUTION = `
  WITH bucketed AS (
    SELECT CASE
             WHEN ql.quantity <= 5 THEN '1-5'
             WHEN ql.quantity <= 10 THEN '6-10'
             WHEN ql.quantity <= 20 THEN '11-20'
             WHEN ql.quantity <= 50 THEN '21-50'
             WHEN ql.quantity <= 100 THEN '51-100'
             ELSE '100+'
           END AS quantity_range,
           CASE
             WHEN ql.quantity <= 5 THEN 1
             WHEN ql.quantity <= 10 THEN 2
             WHEN ql.quantity <= 20 THEN 3
             WHEN ql.quantity <= 50 THEN 4
             WHEN ql.quantity <= 100 THEN 5
             ELSE 6
           END AS bucket_order,
           ql.quantity,
           ql.unit_price,
           COALESCE(ql.discount_applied, 0) AS discount_applied
      FROM quote_lines ql
      JOIN quotes q ON q.id = ql.quote_id
     WHERE q.status <> 'Cancelled'
  )
  SELECT quantity_range,
         COUNT(*) AS order_count,
         SUM(quantity * unit_price * (1 - discount_applied / 100)) AS total_revenue,
         AVG(discount_applied) AS avg_discount
    FROM bucketed
   GROUP BY quantity_range, bucket_order
   ORDER BY bucket_order
`;

/** $1 is the product id, bound rather than interpolated. */
const PRODUCT_HISTOGRAM = `
  WITH order_data AS (
    SELECT ql.quantity,
           ql.quantity * ql.unit_price * (1 - COALESCE(ql.discount_applied, 0) / 100) AS revenue,
           COALESCE(ql.discount_applied, 0) AS discount_percent
      FROM quote_lines ql
      JOIN quotes q ON q.id = ql.quote_id
     WHERE ql.product_id = $1
       AND q.status <> 'Cancelled'
  ),
  buckets AS (
    SELECT CASE
             WHEN quantity <= 5 THEN '1-5'
             WHEN quantity <= 10 THEN '6-10'
             WHEN quantity <= 15 THEN '11-15'
             WHEN quantity <= 20 THEN '16-20'
             WHEN quantity <= 30 THEN '21-30'
             WHEN quantity <= 40 THEN '31-40'
             WHEN quantity <= 50 THEN '41-50'
             WHEN quantity <= 75 THEN '51-75'
             WHEN quantity <= 100 THEN '76-100'
             ELSE '100+'
           END AS quantity_bucket,
           CASE
             WHEN quantity <= 5 THEN 1
             WHEN quantity <= 10 THEN 6
             WHEN quantity <= 15 THEN 11
             WHEN quantity <= 20 THEN 16
             WHEN quantity <= 30 THEN 21
             WHEN quantity <= 40 THEN 31
             WHEN quantity <= 50 THEN 41
             WHEN quantity <= 75 THEN 51
             WHEN quantity <= 100 THEN 76
             ELSE 101
           END AS bucket_min,
           CASE
             WHEN quantity <= 5 THEN 5
             WHEN quantity <= 10 THEN 10
             WHEN quantity <= 15 THEN 15
             WHEN quantity <= 20 THEN 20
             WHEN quantity <= 30 THEN 30
             WHEN quantity <= 40 THEN 40
             WHEN quantity <= 50 THEN 50
             WHEN quantity <= 75 THEN 75
             WHEN quantity <= 100 THEN 100
             ELSE 999
           END AS bucket_max,
           quantity,
           revenue,
           discount_percent
      FROM order_data
  )
  SELECT quantity_bucket,
         bucket_min,
         bucket_max,
         COUNT(*) AS order_count,
         SUM(quantity) AS total_quantity,
         ROUND(AVG(discount_percent), 2) AS avg_discount,
         ROUND(SUM(revenue), 2) AS total_revenue
    FROM buckets
   GROUP BY quantity_bucket, bucket_min, bucket_max
   ORDER BY bucket_min
`;

/**
 * Dashboard drill-down: revenue, period-over-period change and unit volume
 * broken down by customer segment and product category.
 *
 * "Last 12 months" is measured against the most recent quote in the data
 * rather than now(), so a demo dataset that stops months ago still shows
 * figures instead of an empty table.
 */
const METRIC_DRILLDOWN = `
  WITH bounds AS (
    SELECT COALESCE(max(created_at), now()) AS anchor FROM quotes
  ),
  line_facts AS (
    SELECT COALESCE(c.segment, 'Unknown') AS customer_group,
           COALESCE(p.category, 'Uncategorised') AS product_group,
           ql.quantity,
           ql.quantity * ql.unit_price * (1 - COALESCE(ql.discount_applied, 0) / 100) AS revenue,
           CASE
             WHEN q.created_at > b.anchor - interval '12 months' THEN 'current'
             WHEN q.created_at > b.anchor - interval '24 months' THEN 'previous'
           END AS period
      FROM quote_lines ql
      JOIN quotes q ON q.id = ql.quote_id
      CROSS JOIN bounds b
      LEFT JOIN customers c ON c.id = q.customer_id
      LEFT JOIN products p ON p.id = ql.product_id
     WHERE q.status <> 'Cancelled'
       AND q.created_at > b.anchor - interval '24 months'
  )
  SELECT customer_group,
         product_group,
         ROUND(SUM(revenue) FILTER (WHERE period = 'current')::numeric, 2) AS value,
         ROUND(
           CASE
             WHEN COALESCE(SUM(revenue) FILTER (WHERE period = 'previous'), 0) > 0
               THEN (SUM(revenue) FILTER (WHERE period = 'current')
                     - SUM(revenue) FILTER (WHERE period = 'previous'))
                    / SUM(revenue) FILTER (WHERE period = 'previous') * 100
             ELSE 0
           END::numeric, 1
         ) AS change,
         COALESCE(SUM(quantity) FILTER (WHERE period = 'current'), 0) AS volume
    FROM line_facts
   GROUP BY customer_group, product_group
  HAVING SUM(revenue) FILTER (WHERE period = 'current') > 0
   ORDER BY value DESC NULLS LAST
   LIMIT 100
`;


/**
 * Shared basis for the customer analytics below.
 *
 * List price is derived as base_cost * 1.5, the convention the app uses when
 * a product is added to a quote (see src/utils/listPrice.ts). Margin is
 * revenue less cost, where cost is quantity * base_cost. "Current" is the 12
 * months up to the most recent quote, "previous" the 12 before it, so a
 * dataset that stops months ago still produces figures.
 */
const CUSTOMER_FACTS = `
  WITH bounds AS (
    SELECT COALESCE(max(created_at), now()) AS anchor FROM quotes
  ),
  facts AS (
    SELECT q.customer_id,
           c.name AS customer_name,
           c.segment,
           p.id AS product_id,
           p.name AS product_name,
           p.category,
           ql.quantity,
           ql.unit_price,
           COALESCE(ql.discount_applied, 0) AS discount_applied,
           p.base_cost * 1.5 AS list_price,
           ql.quantity * ql.unit_price AS revenue,
           ql.quantity * p.base_cost AS cost,
           CASE
             WHEN q.created_at > b.anchor - interval '12 months' THEN 'current'
             ELSE 'previous'
           END AS period
      FROM quote_lines ql
      JOIN quotes q ON q.id = ql.quote_id
      CROSS JOIN bounds b
      JOIN customers c ON c.id = q.customer_id
      JOIN products p ON p.id = ql.product_id
     WHERE q.status <> 'Cancelled'
       AND q.created_at > b.anchor - interval '24 months'
  )
`;

/** Percentage change helper shared by the queries below. */
const CURRENT_ONLY = `period = 'current'`;

export const analyticsRouter = router({
  /** Per-customer sales, margin, discount and price index, with product detail. */
  customerSummary: protectedProcedure.query(({ ctx }) =>
    ctx.withDb(async (db) => {
      const { rows } = await db.query(
        `${CUSTOMER_FACTS}
         , per_customer AS (
           SELECT customer_id,
                  customer_name,
                  SUM(revenue) FILTER (WHERE ${CURRENT_ONLY}) AS sales,
                  SUM(cost) FILTER (WHERE ${CURRENT_ONLY}) AS cost,
                  AVG(discount_applied) FILTER (WHERE ${CURRENT_ONLY}) AS discount_pct,
                  AVG(unit_price) FILTER (WHERE ${CURRENT_ONLY}) AS avg_price,
                  AVG(list_price) FILTER (WHERE ${CURRENT_ONLY}) AS avg_list,
                  AVG(unit_price) FILTER (WHERE period = 'previous') AS prev_avg_price
             FROM facts
            GROUP BY customer_id, customer_name
           HAVING SUM(revenue) FILTER (WHERE ${CURRENT_ONLY}) > 0
         ),
         per_product AS (
           SELECT customer_id,
                  product_name,
                  SUM(revenue) FILTER (WHERE ${CURRENT_ONLY}) AS sales,
                  SUM(cost) FILTER (WHERE ${CURRENT_ONLY}) AS cost,
                  AVG(discount_applied) FILTER (WHERE ${CURRENT_ONLY}) AS discount_pct,
                  AVG(unit_price) FILTER (WHERE ${CURRENT_ONLY}) AS avg_price,
                  AVG(list_price) FILTER (WHERE ${CURRENT_ONLY}) AS avg_list,
                  AVG(unit_price) FILTER (WHERE period = 'previous') AS prev_avg_price
             FROM facts
            GROUP BY customer_id, product_name
           HAVING SUM(revenue) FILTER (WHERE ${CURRENT_ONLY}) > 0
         )
         SELECT c.customer_id AS id,
                c.customer_name AS name,
                ROUND(c.sales::numeric, 2) AS "sales",
                ROUND((CASE WHEN c.sales > 0 THEN (c.sales - c.cost) / c.sales * 100 ELSE 0 END)::numeric, 1) AS "marginPct",
                ROUND(c.discount_pct::numeric, 1) AS "discountPct",
                ROUND((CASE WHEN c.avg_list > 0 THEN c.avg_price / c.avg_list * 100 ELSE 0 END)::numeric, 1) AS "priceIndex",
                ROUND((CASE WHEN c.prev_avg_price > 0 THEN (c.avg_price - c.prev_avg_price) / c.prev_avg_price * 100 ELSE 0 END)::numeric, 1) AS "priceYoY",
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                           'name', pp.product_name,
                           'sales', ROUND(pp.sales::numeric, 2),
                           'marginPct', ROUND((CASE WHEN pp.sales > 0 THEN (pp.sales - pp.cost) / pp.sales * 100 ELSE 0 END)::numeric, 1),
                           'discountPct', ROUND(pp.discount_pct::numeric, 1),
                           'priceIndex', ROUND((CASE WHEN pp.avg_list > 0 THEN pp.avg_price / pp.avg_list * 100 ELSE 0 END)::numeric, 1),
                           'priceYoY', ROUND((CASE WHEN pp.prev_avg_price > 0 THEN (pp.avg_price - pp.prev_avg_price) / pp.prev_avg_price * 100 ELSE 0 END)::numeric, 1)
                         ) ORDER BY pp.sales DESC)
                    FROM per_product pp
                   WHERE pp.customer_id = c.customer_id
                ), '[]'::jsonb) AS products
           FROM per_customer c
          ORDER BY c.sales DESC
          LIMIT 100`
      );
      return rows;
    })
  ),

  /** Price index vs margin index per customer, for the scatter/bar views. */
  customerPricePerformance: protectedProcedure.query(({ ctx }) =>
    ctx.withDb(async (db) => {
      const { rows } = await db.query(
        `${CUSTOMER_FACTS}
         , per_customer AS (
           SELECT customer_name,
                  SUM(revenue) FILTER (WHERE ${CURRENT_ONLY}) AS sales,
                  SUM(cost) FILTER (WHERE ${CURRENT_ONLY}) AS cost,
                  AVG(unit_price) FILTER (WHERE ${CURRENT_ONLY}) AS avg_price,
                  AVG(list_price) FILTER (WHERE ${CURRENT_ONLY}) AS avg_list
             FROM facts
            GROUP BY customer_name
           HAVING SUM(revenue) FILTER (WHERE ${CURRENT_ONLY}) > 0
         ),
         indexed AS (
           SELECT customer_name,
                  sales,
                  CASE WHEN avg_list > 0 THEN avg_price / avg_list * 100 ELSE 0 END AS price_index,
                  CASE WHEN sales > 0 THEN (sales - cost) / sales * 100 ELSE 0 END AS margin_pct
             FROM per_customer
         ),
         benchmark AS (
           SELECT AVG(margin_pct) AS avg_margin FROM indexed WHERE margin_pct > 0
         )
         SELECT i.customer_name AS name,
                ROUND(i.price_index::numeric, 1) AS "priceIndex",
                -- Margin index is each customer's margin relative to the average.
                ROUND((CASE WHEN b.avg_margin > 0 THEN i.margin_pct / b.avg_margin * 100 ELSE 0 END)::numeric, 1) AS "marginIndex",
                ROUND(i.sales::numeric, 2) AS sales,
                CASE
                  WHEN i.price_index >= 102 THEN 'above'
                  WHEN i.price_index <= 92 THEN 'below'
                  ELSE 'at'
                END AS status
           FROM indexed i CROSS JOIN benchmark b
          ORDER BY i.sales DESC
          LIMIT 60`
      );
      return rows;
    })
  ),

  /**
   * Revenue mix and margin by segment, current vs previous period.
   * `mixImpact` is the standard mix effect: the share shift applied to the
   * segment's prior margin.
   */
  mixAnalysis: protectedProcedure
    .input(
      z
        .object({ dimension: z.enum(['product', 'customer']).default('product') })
        .default({ dimension: 'product' })
    )
    .query(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        // Only ever one of two literal column names, chosen here, never from input.
        const groupColumn = input.dimension === 'product' ? 'category' : 'segment';
        const { rows } = await db.query(
          `${CUSTOMER_FACTS}
           , grouped AS (
             SELECT COALESCE(${groupColumn}, 'Unknown') AS name,
                    SUM(revenue) FILTER (WHERE ${CURRENT_ONLY}) AS cur_rev,
                    SUM(cost) FILTER (WHERE ${CURRENT_ONLY}) AS cur_cost,
                    SUM(revenue) FILTER (WHERE period = 'previous') AS prev_rev,
                    SUM(cost) FILTER (WHERE period = 'previous') AS prev_cost
               FROM facts
              GROUP BY 1
             HAVING SUM(revenue) FILTER (WHERE ${CURRENT_ONLY}) > 0
           ),
           totals AS (
             SELECT SUM(cur_rev) AS cur_total, NULLIF(SUM(prev_rev), 0) AS prev_total FROM grouped
           )
           SELECT g.name,
                  ROUND((g.cur_rev / t.cur_total * 100)::numeric, 1) AS "currentShare",
                  ROUND((COALESCE(g.prev_rev, 0) / COALESCE(t.prev_total, g.cur_rev) * 100)::numeric, 1) AS "previousShare",
                  ROUND((CASE WHEN g.cur_rev > 0 THEN (g.cur_rev - g.cur_cost) / g.cur_rev * 100 ELSE 0 END)::numeric, 1) AS "currentMargin",
                  ROUND((CASE WHEN COALESCE(g.prev_rev, 0) > 0 THEN (g.prev_rev - g.prev_cost) / g.prev_rev * 100 ELSE 0 END)::numeric, 1) AS "previousMargin",
                  ROUND((
                    (g.cur_rev / t.cur_total * 100 - COALESCE(g.prev_rev, 0) / COALESCE(t.prev_total, g.cur_rev) * 100)
                    * (CASE WHEN COALESCE(g.prev_rev, 0) > 0 THEN (g.prev_rev - g.prev_cost) / g.prev_rev * 100 ELSE 0 END)
                    / 100
                  )::numeric, 2) AS "mixImpact"
             FROM grouped g CROSS JOIN totals t
            ORDER BY g.cur_rev DESC
            LIMIT 25`
        );
        return rows;
      })
    ),

  metricDrillDown: protectedProcedure.query(({ ctx }) =>
    ctx.withDb(async (db) => (await db.query(METRIC_DRILLDOWN)).rows)
  ),

  orderingPatterns: protectedProcedure.query(({ ctx }) =>
    ctx.withDb(async (db) => (await db.query(ORDERING_PATTERNS)).rows)
  ),

  breakEffectiveness: protectedProcedure.query(({ ctx }) =>
    ctx.withDb(async (db) => (await db.query(BREAK_EFFECTIVENESS)).rows)
  ),

  quantityDistribution: protectedProcedure.query(({ ctx }) =>
    ctx.withDb(async (db) => (await db.query(QUANTITY_DISTRIBUTION)).rows)
  ),

  productQuantityHistogram: protectedProcedure
    .input(z.object({ productId: z.string().min(1).max(100) }))
    .query(({ ctx, input }) =>
      ctx.withDb(async (db) => (await db.query(PRODUCT_HISTOGRAM, [input.productId])).rows)
    ),
});
