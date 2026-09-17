/**
 * Dashboard reads.
 *
 * `metrics` calls get_dashboard_metrics, a SECURITY DEFINER function that
 * takes a typed integer period, so it is kept as-is and called through here
 * rather than from the browser.
 *
 * `overview` is new. The dashboard's "Pricing Analytics" strip was ten cards
 * of hardcoded numbers - "Contribution Margin per Product 34.70%, +10.70%"
 * and so on - baked into the component with no query behind them. On a demo
 * to the client whose data is in the database, those read as findings about
 * that data. They are not; they were never anything but placeholders.
 *
 * This computes what the data actually supports and says, per metric, when
 * it supports nothing. Some of the ten need a price-change history or a
 * multi-year revenue series that no ITT extract provides, and those return
 * null with the reason attached rather than a number. `basis` and `total`
 * say how much of the data a figure was computed over, so a metric drawn
 * from 4% of the lines cannot pass for one drawn from all of them.
 */
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc.js';

/** A metric the UI can render whether or not the data supports it. */
interface Metric {
  key: string;
  title: string;
  /** Null when the data cannot support the metric. */
  value: number | null;
  unit: 'percent' | 'currency' | 'number';
  /** Lines (or rows) the figure was computed over, and the population. */
  basis: number | null;
  total: number | null;
  /** Present when value is null: what is missing. */
  unavailable: string | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * The filters the dashboard charts accept.
 *
 * `channel` reads customers.segment. ITT's customer master carries a Channel
 * column and the importer maps it onto segment, so on this data the two are
 * the same field.
 */
const chartFilters = z
  .object({
    periodDays: z.number().int().min(1).max(3650).default(365),
    familyId: z.string().max(200).nullable().default(null),
    region: z.string().max(200).nullable().default(null),
    channel: z.string().max(200).nullable().default(null),
  })
  .default({ periodDays: 365, familyId: null, region: null, channel: null });

type ChartFilters = z.infer<typeof chartFilters>;

/*
 * Shared predicate for the chart queries. Families nest up to four deep, so a
 * family filter has to match the whole subtree, not just products attached to
 * the chosen node.
 *
 * Parameters are $1 period days, $2 family id, $3 region, $4 channel; every
 * chart query binds them in that order.
 */
const CHART_SCOPE = `
  q.created_at >= now() - make_interval(days => $1)
  AND ($2::text IS NULL OR p.family_id IN (
        WITH RECURSIVE subtree AS (
          SELECT id FROM product_families WHERE id = $2
          UNION ALL
          SELECT f.id FROM product_families f
            JOIN subtree s ON f.parent_family_id = s.id
        )
        SELECT id FROM subtree
      ))
  AND ($3::text IS NULL OR cu.region = $3)
  AND ($4::text IS NULL OR cu.segment = $4)
`;

const chartParams = (f: ChartFilters) => [f.periodDays, f.familyId, f.region, f.channel];

export const dashboardRouter = router({
  metrics: protectedProcedure
    .input(z.object({ periodDays: z.number().int().min(1).max(3650).default(365) }).default({ periodDays: 365 }))
    .query(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        /*
         * The function returns a single jsonb value, so `SELECT *` would wrap
         * it in a column named after the function. Alias it and unwrap, so
         * callers get the metrics object itself.
         */
        const { rows } = await db.query<{ metrics: Record<string, number> | null }>(
          'SELECT get_dashboard_metrics($1) AS metrics',
          [input.periodDays]
        );
        return rows[0]?.metrics ?? null;
      })
    ),

  /** Real values for the chart filters, so they cannot offer what the data lacks. */
  filterOptions: protectedProcedure.query(({ ctx }) =>
    ctx.withDb(async (db) => {
      const [families, regions, channels] = await Promise.all([
        db.query(
          `SELECT f.id, f.name, (f.parent_family_id IS NULL) AS is_root
             FROM product_families f
            WHERE EXISTS (SELECT 1 FROM products p WHERE p.family_id = f.id)
               OR EXISTS (SELECT 1 FROM product_families c WHERE c.parent_family_id = f.id)
            ORDER BY f.parent_family_id NULLS FIRST, f.name`
        ),
        db.query<{ region: string }>(
          `SELECT DISTINCT region FROM customers
            WHERE region IS NOT NULL AND region <> '' ORDER BY region`
        ),
        db.query<{ segment: string }>(
          `SELECT DISTINCT segment FROM customers
            WHERE segment IS NOT NULL AND segment <> '' ORDER BY segment`
        ),
      ]);
      return {
        productFamilies: families.rows,
        regions: regions.rows.map((r) => r.region),
        channels: channels.rows.map((r) => r.segment),
      };
    })
  ),

  /*
   * Price and cost indices by month, both rebased to 100 at the first month
   * that has data, with the gap between them.
   *
   * This chart used to be a hardcoded twelve-point series multiplied by a
   * factor keyed off the filter value - the numbers moved when you changed a
   * filter, which made it look live, but nothing was ever read from the
   * database.
   */
  pricePerformance: protectedProcedure.input(chartFilters).query(({ ctx, input }) =>
    ctx.withDb(async (db) => {
      const { rows } = await db.query<{
        month: string;
        avg_price: string | null;
        avg_cost: string | null;
        lines: string;
      }>(
        `SELECT to_char(date_trunc('month', q.created_at), 'YYYY-MM') AS month,
                avg(ql.unit_price * (1 - COALESCE(ql.discount_applied, 0) / 100))
                  AS avg_price,
                avg(COALESCE(ql.booked_cost, p.base_cost))            AS avg_cost,
                count(*)                                             AS lines
           FROM quote_lines ql
           JOIN quotes    q  ON q.id  = ql.quote_id
           JOIN products  p  ON p.id  = ql.product_id
           JOIN customers cu ON cu.id = q.customer_id
          WHERE ${CHART_SCOPE}
            AND ql.unit_price IS NOT NULL
          GROUP BY 1
          ORDER BY 1`,
        chartParams(input)
      );

      const first = rows.find((r) => num(r.avg_price) !== null);
      const priceBase = num(first?.avg_price ?? null);
      const costBase = num(first?.avg_cost ?? null);

      /*
       * An index needs a base. Without a first month carrying both a price
       * and a cost the series is returned unindexed rather than rebased
       * against an assumed 100.
       */
      return {
        indexed: priceBase !== null && priceBase > 0 && costBase !== null && costBase > 0,
        points: rows.map((r) => {
          const price = num(r.avg_price);
          const cost = num(r.avg_cost);
          const priceIndex =
            price !== null && priceBase ? (price / priceBase) * 100 : null;
          const costIndex = cost !== null && costBase ? (cost / costBase) * 100 : null;
          return {
            month: r.month,
            lines: Number(r.lines),
            priceIndex,
            costIndex,
            valueGap:
              priceIndex !== null && costIndex !== null ? priceIndex - costIndex : null,
          };
        }),
      };
    })
  ),

  /*
   * Margin bridge between the two halves of the window.
   *
   * The chart it feeds was a waterfall of six constants scaled by a filter
   * multiplier. A real bridge needs two comparable periods, so the window is
   * split in half and decomposed at the (customer, product) grain:
   *
   *   price  = sum (priceB - priceA) * qtyB
   *   cost   = sum (costA  - costB)  * qtyB
   *   volume = sum (qtyB   - qtyA)   * (priceA - costA)
   *   new    = margin of pairs present only in the later half
   *   lost   = minus the margin of pairs present only in the earlier half
   *
   * Those five reconcile exactly to the difference between the two halves'
   * margins, which is what makes it a bridge rather than an illustration.
   *
   * It is quoted margin, not booked: no extract ITT supplied is order
   * history, so "volume" here is quoted quantity.
   */
  marginBridge: protectedProcedure.input(chartFilters).query(({ ctx, input }) =>
    ctx.withDb(async (db) => {
      const { rows } = await db.query<{
        opening: string | null;
        closing: string | null;
        price_effect: string | null;
        cost_effect: string | null;
        volume_effect: string | null;
        new_business: string | null;
        lost_business: string | null;
        pairs: string;
      }>(
        `WITH bounds AS (
           SELECT now() - make_interval(days => $1) AS start_at,
                  now() - make_interval(days => $1 / 2) AS mid_at
         ),
         lines AS (
           SELECT q.customer_id,
                  ql.product_id,
                  CASE WHEN q.created_at < (SELECT mid_at FROM bounds)
                       THEN 'a' ELSE 'b' END AS half,
                  ql.unit_price * (1 - COALESCE(ql.discount_applied, 0) / 100) AS price,
                  COALESCE(ql.booked_cost, p.base_cost) AS cost,
                  COALESCE(ql.quantity, 1)              AS qty
             FROM quote_lines ql
             JOIN quotes    q  ON q.id  = ql.quote_id
             JOIN products  p  ON p.id  = ql.product_id
             JOIN customers cu ON cu.id = q.customer_id
            WHERE ${CHART_SCOPE}
              AND ql.unit_price IS NOT NULL
              AND COALESCE(ql.booked_cost, p.base_cost) IS NOT NULL
         ),
         /* Quantity-weighted price and cost per pair per half. */
         pairs AS (
           SELECT customer_id, product_id, half,
                  sum(price * qty) / NULLIF(sum(qty), 0) AS price,
                  sum(cost  * qty) / NULLIF(sum(qty), 0) AS cost,
                  sum(qty)                               AS qty
             FROM lines GROUP BY 1, 2, 3
         ),
         joined AS (
           SELECT COALESCE(a.customer_id, b.customer_id) AS customer_id,
                  COALESCE(a.product_id,  b.product_id)  AS product_id,
                  a.price AS pa, a.cost AS ca, a.qty AS qa,
                  b.price AS pb, b.cost AS cb, b.qty AS qb
             FROM (SELECT * FROM pairs WHERE half = 'a') a
             FULL JOIN (SELECT * FROM pairs WHERE half = 'b') b
               ON b.customer_id = a.customer_id AND b.product_id = a.product_id
         )
         SELECT COALESCE(sum((pa - ca) * qa), 0)  AS opening,
                COALESCE(sum((pb - cb) * qb), 0)  AS closing,
                COALESCE(sum((pb - pa) * qb) FILTER (WHERE pa IS NOT NULL AND pb IS NOT NULL), 0)
                  AS price_effect,
                COALESCE(sum((ca - cb) * qb) FILTER (WHERE pa IS NOT NULL AND pb IS NOT NULL), 0)
                  AS cost_effect,
                COALESCE(sum((qb - qa) * (pa - ca)) FILTER (WHERE pa IS NOT NULL AND pb IS NOT NULL), 0)
                  AS volume_effect,
                COALESCE(sum((pb - cb) * qb) FILTER (WHERE pa IS NULL), 0)
                  AS new_business,
                COALESCE(-sum((pa - ca) * qa) FILTER (WHERE pb IS NULL), 0)
                  AS lost_business,
                count(*) AS pairs
           FROM joined`,
        chartParams(input)
      );

      const r = rows[0];
      return {
        pairs: Number(r?.pairs ?? 0),
        opening: num(r?.opening) ?? 0,
        closing: num(r?.closing) ?? 0,
        priceEffect: num(r?.price_effect) ?? 0,
        costEffect: num(r?.cost_effect) ?? 0,
        volumeEffect: num(r?.volume_effect) ?? 0,
        newBusiness: num(r?.new_business) ?? 0,
        lostBusiness: num(r?.lost_business) ?? 0,
      };
    })
  ),

  overview: protectedProcedure
    .input(z.object({ periodDays: z.number().int().min(1).max(3650).default(365) }).default({ periodDays: 365 }))
    .query(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        const days = input.periodDays;

        /*
         * Every line in the window, with the cost and list price needed to
         * derive margin and realization.
         *
         * List price is the one the quote's own price list carries, falling
         * back to the highest price recorded for the product across the
         * lists. The fallback exists because ITT's quote extract has no
         * price list column at all, so without it realization would be
         * uncomputable for every imported quote; it is the conservative
         * choice, since a lower denominator would flatter realization.
         *
         * Cost prefers the cost booked against the line at quote time over
         * the product's standing cost: it is the cost that deal was actually
         * priced against.
         */
        const { rows: lineRows } = await db.query<{
          lines: string;
          priced_lines: string;
          costed_lines: string;
          listed_lines: string;
          avg_discount: string | null;
          avg_margin: string | null;
          realization: string | null;
          revenue: string | null;
        }>(
          `WITH best_list AS (
             /*
              * One row per product, computed once. This was two correlated
              * subqueries evaluated per line, which at three million lines
              * meant a million executions each and took the query from 1.4
              * seconds to 8.4.
              */
             SELECT product_id, max(list_price) AS list_price
               FROM price_list_items GROUP BY product_id
           ),
           priced AS (
             SELECT COALESCE(ql.discount_applied, 0)            AS discount,
                    COALESCE(ql.quantity, 1)                    AS qty,
                    COALESCE(ql.booked_cost, p.base_cost)       AS cost,
                    COALESCE(pl.list_price, bl.list_price)      AS list_price,
                    ql.unit_price * (1 - COALESCE(ql.discount_applied, 0) / 100)
                      AS effective
               FROM quote_lines ql
               JOIN quotes   q ON q.id = ql.quote_id
               JOIN products p ON p.id = ql.product_id
               LEFT JOIN best_list bl
                 ON bl.product_id = ql.product_id
               LEFT JOIN price_list_items pl
                 ON pl.product_id = ql.product_id
                AND pl.price_list_id = q.price_list_id
              WHERE q.created_at >= now() - make_interval(days => $1)
                AND ql.unit_price IS NOT NULL
                AND ql.unit_price > 0
           ),
           /* Lines in the window regardless of whether they carry a price. */
           total AS (
             SELECT count(*) AS lines
               FROM quote_lines ql
               JOIN quotes q ON q.id = ql.quote_id
              WHERE q.created_at >= now() - make_interval(days => $1)
           )
           /*
            * One pass with FILTER rather than a scalar subquery per metric.
            * Six subqueries over the same CTE meant six scans of it.
            */
           SELECT (SELECT lines FROM total)                        AS lines,
                  count(*)                                         AS priced_lines,
                  count(*) FILTER (WHERE cost IS NOT NULL AND cost > 0)
                                                                   AS costed_lines,
                  count(*) FILTER (WHERE list_price IS NOT NULL AND list_price > 0)
                                                                   AS listed_lines,
                  avg(discount)                                    AS avg_discount,
                  avg((effective - cost) / effective * 100)
                    FILTER (WHERE cost IS NOT NULL AND cost > 0 AND effective > 0)
                                                                   AS avg_margin,
                  sum(effective * qty) FILTER (WHERE list_price IS NOT NULL AND list_price > 0)
                    / NULLIF(sum(list_price * qty)
                        FILTER (WHERE list_price IS NOT NULL AND list_price > 0), 0)
                    * 100                                          AS realization,
                  sum(effective * qty)                             AS revenue
             FROM priced`,
          [days]
        );

        const l = lineRows[0];
        const lines = Number(l?.lines ?? 0);
        const priced = Number(l?.priced_lines ?? 0);
        const costed = Number(l?.costed_lines ?? 0);
        const listed = Number(l?.listed_lines ?? 0);
        const realization = num(l?.realization);

        /*
         * The remaining metrics from the original strip each need a history
         * the database does not hold: a series of price changes with dates,
         * or revenue split into price and volume effects across periods.
         * Nothing here can stand in for that, so they carry the reason
         * instead of a number.
         */
        const NO_PRICE_HISTORY =
          'Needs a history of list price changes with effective dates. No extract supplied one.';
        const NO_REVENUE_SERIES =
          'Needs booked revenue by period, split into price and volume effects. The quote extract is not order history.';

        const pricingMetrics: Metric[] = [
          {
            key: 'contribution_margin',
            title: 'Contribution Margin per Product',
            value: num(l?.avg_margin),
            unit: 'percent',
            basis: costed,
            total: priced,
            unavailable:
              costed === 0
                ? 'No quoted line carries a cost, so margin cannot be derived.'
                : null,
          },
          {
            key: 'net_price_realization',
            title: 'Net Price Realization',
            value: realization,
            unit: 'percent',
            basis: listed,
            total: priced,
            unavailable:
              listed === 0
                ? 'None of the quoted products appears on a price list, so there is no list price to realize against.'
                : null,
          },
          {
            key: 'price_leakage',
            title: 'Price Leakage',
            value: realization === null ? null : 100 - realization,
            unit: 'percent',
            basis: listed,
            total: priced,
            unavailable:
              listed === 0
                ? 'The complement of net price realization, which is itself unavailable.'
                : null,
          },
          {
            key: 'average_discount',
            title: 'Average Discount',
            value: num(l?.avg_discount),
            unit: 'percent',
            basis: priced,
            total: lines,
            unavailable: priced === 0 ? 'No line in this window carries a price.' : null,
          },
          {
            key: 'quoted_value',
            title: 'Quoted Value',
            value: num(l?.revenue),
            unit: 'currency',
            basis: priced,
            total: lines,
            unavailable: priced === 0 ? 'No line in this window carries a price.' : null,
          },
          {
            key: 'revenue_growth_from_pricing',
            title: 'Revenue Growth from Pricing',
            value: null,
            unit: 'percent',
            basis: null,
            total: null,
            unavailable: NO_REVENUE_SERIES,
          },
          {
            key: 'incremental_revenue_per_price_change',
            title: 'Incremental Revenue per Price Change',
            value: null,
            unit: 'percent',
            basis: null,
            total: null,
            unavailable: NO_PRICE_HISTORY,
          },
          {
            key: 'customer_lifetime_value',
            title: 'Customer Lifetime Value',
            value: null,
            unit: 'currency',
            basis: null,
            total: null,
            unavailable: NO_REVENUE_SERIES,
          },
          {
            key: 'price_optimization_velocity',
            title: 'Price Optimization Velocity',
            value: null,
            unit: 'percent',
            basis: null,
            total: null,
            unavailable: NO_PRICE_HISTORY,
          },
          {
            key: 'price_variance_change',
            title: 'Avg Change in Price Variance',
            value: null,
            unit: 'percent',
            basis: null,
            total: null,
            unavailable: NO_PRICE_HISTORY,
          },
        ];

        /* Deal score health. Bands match getDealScoreLabel in the frontend. */
        const { rows: scoreRows } = await db.query<{
          scored: string;
          total: string;
          average: string | null;
          excellent: string;
          good: string;
          attention: string;
        }>(
          `SELECT count(deal_score)                                   AS scored,
                  count(*)                                            AS total,
                  avg(deal_score)                                     AS average,
                  count(*) FILTER (WHERE deal_score >= 110)           AS excellent,
                  count(*) FILTER (WHERE deal_score >= 90
                                     AND deal_score < 110)            AS good,
                  count(*) FILTER (WHERE deal_score < 90)             AS attention
             FROM quotes
            WHERE created_at >= now() - make_interval(days => $1)`,
          [days]
        );

        const { rows: recentActivity } = await db.query(
          `SELECT q.id,
                  q.status,
                  q.total,
                  q.deal_score,
                  q.outcome,
                  COALESCE(q.quote_date::timestamptz, q.created_at) AS activity_at,
                  COALESCE(c.name, q.source_customer_name, q.customer_id) AS customer_name
             FROM quotes q
             LEFT JOIN customers c ON c.id = q.customer_id
            ORDER BY COALESCE(q.quote_date::timestamptz, q.created_at) DESC
            LIMIT 8`
        );

        /*
         * Commission overview. The table is populated when a quote is won,
         * by the quote builder, so it is empty until deals start closing
         * through the app.
         */
        const { rows: commissionRows } = await db.query<{
          records: string;
          reps: string;
          total: string | null;
          paid: string | null;
          pending: string | null;
        }>(
          `SELECT count(*)                                           AS records,
                  count(DISTINCT sales_rep_email)                    AS reps,
                  COALESCE(sum(commission_amount), 0)                AS total,
                  COALESCE(sum(commission_amount)
                             FILTER (WHERE status = 'paid'), 0)      AS paid,
                  COALESCE(sum(commission_amount)
                             FILTER (WHERE status <> 'paid'), 0)     AS pending
             FROM sales_commissions`
        );

        const { rows: topProducts } = await db.query(
          `SELECT p.id,
                  p.name,
                  count(DISTINCT ql.quote_id)::int AS quote_count,
                  sum(COALESCE(ql.quantity, 1))::int AS units,
                  sum(COALESCE(ql.line_total,
                               ql.unit_price
                                 * (1 - COALESCE(ql.discount_applied, 0) / 100)
                                 * COALESCE(ql.quantity, 1))) AS revenue
             FROM quote_lines ql
             JOIN quotes   q ON q.id = ql.quote_id
             JOIN products p ON p.id = ql.product_id
            WHERE q.created_at >= now() - make_interval(days => $1)
            GROUP BY p.id, p.name
            HAVING sum(COALESCE(ql.line_total, 0)) > 0
            ORDER BY revenue DESC NULLS LAST
            LIMIT 8`,
          [days]
        );

        const s = scoreRows[0];
        const c = commissionRows[0];

        return {
          pricingMetrics,
          dealScore: {
            scored: Number(s?.scored ?? 0),
            total: Number(s?.total ?? 0),
            average: num(s?.average),
            excellent: Number(s?.excellent ?? 0),
            good: Number(s?.good ?? 0),
            attention: Number(s?.attention ?? 0),
          },
          recentActivity,
          commissions: {
            records: Number(c?.records ?? 0),
            reps: Number(c?.reps ?? 0),
            total: num(c?.total) ?? 0,
            paid: num(c?.paid) ?? 0,
            pending: num(c?.pending) ?? 0,
          },
          topProducts,
        };
      })
    ),
});
