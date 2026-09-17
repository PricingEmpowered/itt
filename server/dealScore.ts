/**
 * Deal scoring.
 *
 * ## Why this is on the server
 *
 * The original calculator (src/utils/dealScoreCalculator.ts) benchmarked a
 * quote against comparable historical deals with a single PostgREST query
 * that embedded three levels of relation:
 *
 *   quote_lines -> products!inner, quotes!inner -> customers!inner
 *
 * with filters applied to the embedded tables (`.in('quotes.status', ...)`,
 * `.gte('quotes.created_at', ...)`). Embedded selects are the one part of
 * PostgREST the compatibility layer in src/lib/dataClient.ts does not
 * reimplement, so that query could not run: the embedded column names are
 * not columns of quote_lines and the request was rejected. Every call
 * returned `{ score: null }` through the catch, silently, which is why no
 * quote in the database has ever carried a deal score - and why commissions,
 * which key off the score, were never created either.
 *
 * The join is trivial in SQL, so the benchmark runs here and the browser
 * asks for a score instead of assembling one.
 *
 * ## The scoring model
 *
 * A quote is scored against approved quotes from the last 12 months for the
 * same product categories, split into those from the customer's industry and
 * those from its region. Score 100 means "priced exactly like the
 * comparable deals"; above 100 means better margin or less discount than the
 * benchmark, below means worse. The arithmetic is preserved exactly from the
 * original so scores stay comparable with anything already recorded.
 *
 * Returns a null score rather than a guess when there is nothing to compare
 * against - fewer than five comparable lines, or fewer than three in both
 * the industry and the region cohorts. An unscored quote is honest; a quote
 * scored against two data points is not.
 */
import type { Queryable } from './db.js';

export interface DealScoreLine {
  product_id: string;
  unit_price: number | null;
  discount_applied: number | null;
}

export interface DealScoreDetails {
  industry_avg_margin: number;
  region_avg_margin: number;
  industry_avg_discount: number;
  region_avg_discount: number;
  current_avg_margin: number;
  current_avg_discount: number;
  comparable_deals_count: number;
  percentile: number;
  score_factors: { margin_score: number; discount_score: number };
}

export interface DealScoreResult {
  score: number | null;
  details: DealScoreDetails | null;
  /** Why a score could not be produced. Null when one was. */
  reason: string | null;
}

interface ComparableDeal {
  margin_percent: number;
  discount_percent: number;
  in_industry: boolean;
  in_region: boolean;
}

const UNSCORED = (reason: string): DealScoreResult => ({
  score: null,
  details: null,
  reason,
});

/** Margin on the effective (post-discount) price. Zero when cost is unknown. */
function marginPercent(
  unitPrice: number | null,
  discount: number | null,
  baseCost: number | null
): number {
  if (unitPrice === null || baseCost === null || baseCost <= 0) return 0;
  const effective = unitPrice * (1 - (discount ?? 0) / 100);
  if (effective === 0) return 0;
  return ((effective - baseCost) / effective) * 100;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export async function calculateDealScore(
  db: Queryable,
  customerId: string,
  lines: DealScoreLine[]
): Promise<DealScoreResult> {
  if (!customerId || lines.length === 0) {
    return UNSCORED('No customer or no lines to score.');
  }

  const { rows: customerRows } = await db.query<{
    industry_id: string | null;
    region_id: string | null;
  }>('SELECT industry_id, region_id FROM customers WHERE id = $1', [customerId]);

  const customer = customerRows[0];
  if (!customer?.industry_id || !customer?.region_id) {
    return UNSCORED(
      'The customer has no industry or region, so there is no cohort to benchmark against.'
    );
  }

  const productIds = Array.from(new Set(lines.map((l) => l.product_id)));
  const { rows: productRows } = await db.query<{
    id: string;
    category: string | null;
    base_cost: string | null;
  }>('SELECT id, category, base_cost FROM products WHERE id = ANY($1)', [productIds]);

  const products = new Map(productRows.map((p) => [p.id, p]));
  const categories = Array.from(
    new Set(productRows.map((p) => p.category).filter((c): c is string => !!c))
  );
  if (categories.length === 0) {
    return UNSCORED('None of the quoted products is categorised.');
  }

  /*
   * The comparison cohort. `quotes.created_at` rather than `quote_date`,
   * matching the original: an imported quote's created_at is its import
   * time, so for imported history this window is effectively "everything".
   */
  const { rows: historical } = await db.query<{
    unit_price: string | null;
    discount_applied: string | null;
    base_cost: string | null;
    in_industry: boolean;
    in_region: boolean;
  }>(
    `SELECT ql.unit_price,
            ql.discount_applied,
            p.base_cost,
            (cu.industry_id = $2) AS in_industry,
            (cu.region_id = $3)   AS in_region
       FROM quote_lines ql
       JOIN products  p  ON p.id  = ql.product_id
       JOIN quotes    q  ON q.id  = ql.quote_id
       JOIN customers cu ON cu.id = q.customer_id
      WHERE q.status = 'Approved'
        AND q.created_at >= now() - interval '12 months'
        AND p.category = ANY($1)`,
    [categories, customer.industry_id, customer.region_id]
  );

  if (historical.length < 5) {
    return UNSCORED(
      `Only ${historical.length} comparable approved lines in the last 12 months; at least 5 are needed.`
    );
  }

  const comparables: ComparableDeal[] = historical.map((row) => ({
    margin_percent: marginPercent(
      row.unit_price === null ? null : Number(row.unit_price),
      row.discount_applied === null ? null : Number(row.discount_applied),
      row.base_cost === null ? null : Number(row.base_cost)
    ),
    discount_percent: Number(row.discount_applied ?? 0),
    in_industry: row.in_industry,
    in_region: row.in_region,
  }));

  const industryDeals = comparables.filter((d) => d.in_industry);
  const regionDeals = comparables.filter((d) => d.in_region);

  if (industryDeals.length < 3 && regionDeals.length < 3) {
    return UNSCORED(
      `Comparable deals exist but too few share the customer's industry (${industryDeals.length}) or region (${regionDeals.length}); 3 are needed in one of them.`
    );
  }

  const industryAvgMargin = mean(industryDeals.map((d) => d.margin_percent));
  const industryAvgDiscount = mean(industryDeals.map((d) => d.discount_percent));
  const regionAvgMargin = mean(regionDeals.map((d) => d.margin_percent));
  const regionAvgDiscount = mean(regionDeals.map((d) => d.discount_percent));

  const currentMargins: number[] = [];
  const currentDiscounts: number[] = [];
  for (const line of lines) {
    const product = products.get(line.product_id);
    if (!product || line.unit_price === null || line.discount_applied === null) continue;
    currentMargins.push(
      marginPercent(
        line.unit_price,
        line.discount_applied,
        product.base_cost === null ? null : Number(product.base_cost)
      )
    );
    currentDiscounts.push(line.discount_applied);
  }

  if (currentMargins.length === 0) {
    return UNSCORED('No line on this quote carries both a price and a discount.');
  }

  const currentAvgMargin = mean(currentMargins);
  const currentAvgDiscount = mean(currentDiscounts);

  /* Both cohorts count when both are populated; otherwise whichever exists. */
  const both = industryDeals.length > 0 && regionDeals.length > 0;
  const baselineMargin = both
    ? (industryAvgMargin + regionAvgMargin) / 2
    : industryDeals.length > 0
      ? industryAvgMargin
      : regionAvgMargin;
  const baselineDiscount = both
    ? (industryAvgDiscount + regionAvgDiscount) / 2
    : industryDeals.length > 0
      ? industryAvgDiscount
      : regionAvgDiscount;

  const marginDelta =
    baselineMargin > 0 ? ((currentAvgMargin - baselineMargin) / baselineMargin) * 100 : 0;
  const discountDelta =
    baselineDiscount > 0
      ? ((baselineDiscount - currentAvgDiscount) / baselineDiscount) * 100
      : 0;

  const marginScore = 100 + marginDelta;
  const discountScore = 100 + discountDelta;

  /*
   * The cohorts overlap - a deal can be both in-industry and in-region - and
   * the percentile is taken over the union, each deal once. The original
   * deduplicated with a Set over freshly built objects, which never removes
   * anything, so a deal in both cohorts was counted twice. Counting it once
   * is what the field name (comparable_deals_count) claims.
   */
  const union = comparables.filter((d) => d.in_industry || d.in_region);
  const sortedMargins = union.map((d) => d.margin_percent).sort((a, b) => a - b);
  const belowCount = sortedMargins.filter((m) => m < currentAvgMargin).length;
  const percentile =
    sortedMargins.length > 0 ? (belowCount / sortedMargins.length) * 100 : 50;

  return {
    score: Math.round(((marginScore + discountScore) / 2) * 100) / 100,
    details: {
      industry_avg_margin: industryAvgMargin,
      region_avg_margin: regionAvgMargin,
      industry_avg_discount: industryAvgDiscount,
      region_avg_discount: regionAvgDiscount,
      current_avg_margin: currentAvgMargin,
      current_avg_discount: currentAvgDiscount,
      comparable_deals_count: union.length,
      percentile,
      score_factors: { margin_score: marginScore, discount_score: discountScore },
    },
    reason: null,
  };
}
