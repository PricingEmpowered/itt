/**
 * Prices every line of a quote in one pass.
 *
 * The pilot flow uploads a Channel Partners quote form and expects the whole
 * thing to come back priced - band, target and reasoning on every line -
 * rather than the analyst opening a calculator per line. So this takes all
 * the lines at once and issues a fixed number of queries regardless of how
 * many there are: one for the customer, one for the products, one for the
 * comparable cohort, one for the rule sets. A hundred-line quote costs the
 * same four round trips as a one-line quote.
 *
 * ## Where the evidence comes from
 *
 * The cohort is quote lines from the last twelve months in the same product
 * category, carrying the margin each achieved. priceBands.ts turns those
 * margins into this line's band. Cohort selection, the window and the
 * thresholds mirror server/dealScore.ts, which is where comparability is
 * already defined for this application.
 *
 * ## Two deliberate departures from dealScore's version
 *
 * dealScore's `marginPercent` returns 0 when cost is unknown. For a score
 * that is survivable; for a target it is not - a fabricated 0% margin drags
 * the percentile down and looks identical to a line that genuinely earned
 * nothing. Lines without a usable cost are excluded from the cohort here, so
 * a thin cohort reports as thin instead of as a cohort of zeros.
 *
 * dealScore reads `products.base_cost`, which is today's cost. The margin a
 * line achieved depends on what it cost at the time, so this prefers
 * `quote_lines.booked_cost` and falls back to `base_cost` only when the line
 * never recorded one.
 *
 * ## Won versus approved
 *
 * A target should be built on business that was actually won. ITT's extract
 * carries no outcome yet - the same gap noted on quotes.winRate - so
 * 'Approved' stands in alongside 'Won' for now. Once the monthly win/loss
 * file lands this should narrow to won business only, and the cohort will
 * get smaller and more honest at the same time.
 */

import type { Queryable } from '../db.js';
import { calculatePriceBand, type ComparableLine, type PriceBand } from './priceBands.js';
import type { MarginBasis } from './costPlus.js';
import { resolveFloor, type FloorResolution, type MarginFloorRow } from './marginFloors.js';

/* Whose authority the analyst is quoting under. The delegation of authority
   will add manager and director levels; until then the pricing desk is analysts. */
const AUTHORITY_LEVEL = 'analyst';

/* Used when no rule set matches and none is active. Stated, not hidden. */
const DEFAULT_FALLBACK_RATE = 0.4;
const DEFAULT_FALLBACK_BASIS: MarginBasis = 'margin';

export interface PriceLineRequest {
  /** Catalogue product. Null for a configured or custom part. */
  productId?: string | null;
  /** Part number as it appeared in the uploaded form. */
  partNumber?: string | null;
  quantity?: number | null;
  /** List price from the Channel Partners form. Reporting only. */
  listPrice?: number | null;
  /** Per-unit cost from the form, if it carried one. Overrides the catalogue. */
  cost?: number | null;
}

export interface PricedLine {
  index: number;
  productId: string | null;
  partNumber: string | null;
  category: string | null;
  /** The per-unit cost the band was built on. */
  costUsed: number | null;
  costSource: 'line' | 'catalogue' | 'none';
  /**
   * The minimum margin that applies to this line and where it came from. The
   * screen compares the live unit price against it, so the approval flag moves
   * as the analyst edits the price without another round trip.
   */
  authority: FloorResolution & { level: string };
  band: PriceBand;
}

type ProductRow = {
  id: string;
  category: string | null;
  family_id: string | null;
  family_name: string | null;
  base_cost: string | null;
};

type ComparableRow = {
  category: string | null;
  unit_price: string | null;
  discount_applied: string | null;
  cost: string | null;
  in_industry: boolean | null;
  in_region: boolean | null;
};

type RuleRow = {
  product_family_id: string | null;
  margin_basis: string | null;
  standard_rate: string | null;
};

type FloorRow = {
  authority_level: string;
  product_line: string;
  region: string;
  minimum_margin: string;
  is_placeholder: boolean;
  note: string | null;
};

/** Margin on the effective post-discount price, or null when it cannot be known. */
function achievedMargin(
  unitPrice: number | null,
  discountPercent: number | null,
  cost: number | null
): number | null {
  if (unitPrice === null || cost === null || cost <= 0) return null;
  const effective = unitPrice * (1 - (discountPercent ?? 0) / 100);
  if (effective <= 0) return null;
  return (effective - cost) / effective;
}

function num(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function priceQuoteLines(
  db: Queryable,
  customerId: string | null,
  lines: PriceLineRequest[]
): Promise<PricedLine[]> {
  if (lines.length === 0) return [];

  /*
   * A customer without an industry or region is not an error. It only means
   * neither cohort can be preferred, so priceBands falls back to using every
   * comparable line, which it reports as cohort 'all'.
   */
  let industryId: string | null = null;
  let regionId: string | null = null;
  let regionName: string | null = null;
  if (customerId) {
    const { rows } = await db.query<{
      industry_id: string | null;
      region_id: string | null;
      region: string | null;
    }>('SELECT industry_id, region_id, region FROM customers WHERE id = $1', [customerId]);
    industryId = rows[0]?.industry_id ?? null;
    regionId = rows[0]?.region_id ?? null;
    regionName = rows[0]?.region ?? null;
  }

  const productIds = [...new Set(lines.map((l) => l.productId).filter((id): id is string => !!id))];

  const productsById = new Map<string, ProductRow>();
  if (productIds.length > 0) {
    /*
     * The product line is taken from the product family. ITT's own product-line
     * field is not on the catalogue, so this is the one place that mapping
     * lives: if it moves, it moves here and nowhere else.
     */
    const { rows } = await db.query<ProductRow>(
      `SELECT p.id, p.category, p.family_id, f.name AS family_name, p.base_cost
         FROM products p
         LEFT JOIN product_families f ON f.id = p.family_id
        WHERE p.id = ANY($1)`,
      [productIds]
    );
    for (const r of rows) productsById.set(r.id, r);
  }

  const categories = [
    ...new Set(
      [...productsById.values()].map((p) => p.category).filter((c): c is string => !!c)
    ),
  ];

  /* The cohort, for every category on the quote, in one query. */
  const comparablesByCategory = new Map<string, ComparableLine[]>();
  if (categories.length > 0) {
    const { rows } = await db.query<ComparableRow>(
      `SELECT p.category,
              ql.unit_price,
              ql.discount_applied,
              COALESCE(ql.booked_cost, p.base_cost) AS cost,
              (cu.industry_id = $2) AS in_industry,
              (cu.region_id   = $3) AS in_region
         FROM quote_lines ql
         JOIN products  p  ON p.id  = ql.product_id
         JOIN quotes    q  ON q.id  = ql.quote_id
         JOIN customers cu ON cu.id = q.customer_id
        WHERE q.status IN ('Won', 'Approved')
          AND q.created_at >= now() - interval '12 months'
          AND p.category = ANY($1)
          AND ql.unit_price IS NOT NULL
          AND COALESCE(ql.booked_cost, p.base_cost) > 0`,
      [categories, industryId, regionId]
    );

    for (const r of rows) {
      if (!r.category) continue;
      const margin = achievedMargin(num(r.unit_price), num(r.discount_applied), num(r.cost));
      /* No usable cost means no evidence, not zero margin. Dropped. */
      if (margin === null) continue;
      const bucket = comparablesByCategory.get(r.category) ?? [];
      bucket.push({
        marginFraction: margin,
        inIndustry: r.in_industry === true,
        inRegion: r.in_region === true,
      });
      comparablesByCategory.set(r.category, bucket);
    }
  }

  /*
   * Rule sets supply the cost-plus fallback. Indexed by family; a config with
   * no family acts as the default for everything. The minimum margin no longer
   * comes from here: it is looked up per product line and region below.
   */
  const { rows: ruleRows } = await db.query<RuleRow>(
    `SELECT product_family_id, margin_basis, standard_rate
       FROM pricing_rules_config
      WHERE is_active`
  );
  const ruleByFamily = new Map<string, RuleRow>();
  let defaultRule: RuleRow | null = null;
  for (const r of ruleRows) {
    if (r.product_family_id) ruleByFamily.set(r.product_family_id, r);
    else if (!defaultRule) defaultRule = r;
  }
  if (!defaultRule && ruleRows.length > 0) defaultRule = ruleRows[0];

  /* Small table, read whole, resolved per line in memory. */
  const { rows: floorRows } = await db.query<FloorRow>(
    `SELECT authority_level, product_line, region, minimum_margin, is_placeholder, note
       FROM margin_authority_floors`
  );
  const floors: MarginFloorRow[] = floorRows.map((r) => ({
    authorityLevel: r.authority_level,
    productLine: r.product_line,
    region: r.region,
    minimumMargin: Number(r.minimum_margin),
    isPlaceholder: r.is_placeholder,
    note: r.note,
  }));

  return lines.map((line, index) => {
    const product = line.productId ? productsById.get(line.productId) : undefined;

    /*
     * `products.base_cost` defaults to 0, so a catalogue row that was never
     * costed reads as free. Treating that as a cost would produce a band of
     * zeros that looks priced; treating it as missing produces an unpriced
     * line that says why, which is the truthful rendering.
     */
    const lineCost = typeof line.cost === 'number' && line.cost > 0 ? line.cost : null;
    const catalogueCost = product ? num(product.base_cost) : null;
    const usableCatalogueCost =
      catalogueCost !== null && catalogueCost > 0 ? catalogueCost : null;

    const costUsed = lineCost ?? usableCatalogueCost;
    const costSource: PricedLine['costSource'] =
      lineCost !== null ? 'line' : usableCatalogueCost !== null ? 'catalogue' : 'none';

    const rule =
      (product?.family_id ? ruleByFamily.get(product.family_id) : undefined) ?? defaultRule;

    const basis = rule?.margin_basis === 'markup' ? 'markup' : DEFAULT_FALLBACK_BASIS;
    const fallbackRate = num(rule?.standard_rate ?? null) ?? DEFAULT_FALLBACK_RATE;
    /* A product line is its family name; a part with no family matches only the defaults. */
    const authority = resolveFloor(floors, AUTHORITY_LEVEL, product?.family_name ?? null, regionName);
    const minimumMargin = authority.minimumMargin;

    const band = calculatePriceBand({
      cost: costUsed,
      comparables: product?.category ? comparablesByCategory.get(product.category) ?? [] : [],
      fallbackRate,
      fallbackBasis: basis,
      minimumMargin,
      enteredListPrice: line.listPrice ?? null,
    });

    return {
      index,
      productId: line.productId ?? null,
      partNumber: line.partNumber ?? null,
      category: product?.category ?? null,
      costUsed,
      costSource,
      authority: { ...authority, level: AUTHORITY_LEVEL },
      band,
    };
  });
}
