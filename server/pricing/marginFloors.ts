/**
 * Chooses the minimum margin that applies to a quote line.
 *
 * ITT sets the margin below which an analyst needs approval by product line
 * and region, and the figures differ by level of authority. The rows live in
 * `margin_authority_floors`; this module decides which row applies to a given
 * line. It is a pure function over rows already read, so the rule is testable
 * without a database and the pricing path stays at a fixed number of queries.
 *
 * ## Which row wins
 *
 * Most specific first:
 *
 *   1. this product line, this region
 *   2. this product line, any region
 *   3. any product line, this region
 *   4. any product line, any region   (the default)
 *
 * '*' is the wildcard. Product lines are compared ignoring case and spacing,
 * because a name typed into an admin screen and a name loaded from a
 * spreadsheet will not agree on either.
 *
 * ## An unmatched line gets nothing, not a guess
 *
 * If no row applies, which only happens when the default row has been deleted,
 * the result carries a null margin and says why. The caller then shows no
 * approval line. Falling back to a number built into the code would put a
 * figure nobody configured into a decision about who must approve a quote.
 */

export type RegionName = 'North America' | 'Europe' | 'Asia Pacific';

export const ANY = '*';

export interface MarginFloorRow {
  authorityLevel: string;
  productLine: string;
  region: string;
  /** A fraction: 0.30 is 30%. */
  minimumMargin: number;
  isPlaceholder: boolean;
  note: string | null;
}

export interface FloorResolution {
  /** Null when no row applies. */
  minimumMargin: number | null;
  /** True when the applied row is a stand-in that ITT has not confirmed. */
  isPlaceholder: boolean;
  /** The row that matched, for showing the user where the figure came from. */
  matchedProductLine: string | null;
  matchedRegion: string | null;
  note: string | null;
  /** The product line and region the lookup was for, as understood. */
  productLine: string | null;
  region: RegionName | null;
  /** One sentence on how the figure was chosen, or why there is none. */
  reason: string;
}

/** Case and spacing do not distinguish one product line from another. */
export function normaliseProductLine(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Maps a customer's region text onto the regions the table is keyed on.
 * Anything else returns null, which means "match only rows for any region"
 * and never "assume a region".
 */
export function canonicalRegion(raw: string | null | undefined): RegionName | null {
  const r = (raw ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (r === 'north america' || r === 'na') return 'North America';
  if (r === 'europe' || r === 'eu' || r === 'emea') return 'Europe';
  if (r === 'asia pacific' || r === 'asia' || r === 'apac') return 'Asia Pacific';
  return null;
}

export function resolveFloor(
  rows: MarginFloorRow[],
  authorityLevel: string,
  productLine: string | null | undefined,
  region: string | null | undefined
): FloorResolution {
  const line = normaliseProductLine(productLine);
  const canonical = canonicalRegion(region);

  const atLevel = rows.filter((r) => r.authorityLevel === authorityLevel);

  const find = (pl: string, rg: string) =>
    atLevel.find(
      (r) =>
        (pl === ANY ? r.productLine === ANY : normaliseProductLine(r.productLine) === pl) &&
        r.region === rg
    );

  const candidates: Array<[string, string]> = [];
  if (line !== '' && canonical) candidates.push([line, canonical]);
  if (line !== '') candidates.push([line, ANY]);
  if (canonical) candidates.push([ANY, canonical]);
  candidates.push([ANY, ANY]);

  for (const [pl, rg] of candidates) {
    const hit = find(pl, rg);
    if (!hit) continue;

    const where =
      pl === ANY && rg === ANY
        ? 'the default for every product line and region'
        : pl === ANY
          ? `the default for ${hit.region}`
          : rg === ANY
            ? `${hit.productLine}, any region`
            : `${hit.productLine} in ${hit.region}`;

    return {
      minimumMargin: hit.minimumMargin,
      isPlaceholder: hit.isPlaceholder,
      matchedProductLine: hit.productLine,
      matchedRegion: hit.region,
      note: hit.note,
      productLine: line === '' ? null : (productLine ?? null),
      region: canonical,
      reason: `${(hit.minimumMargin * 100).toFixed(1)}% from ${where}.`,
    };
  }

  return {
    minimumMargin: null,
    isPlaceholder: false,
    matchedProductLine: null,
    matchedRegion: null,
    note: null,
    productLine: line === '' ? null : (productLine ?? null),
    region: canonical,
    reason:
      `No minimum margin is set for ${authorityLevel} authority` +
      (line !== '' ? ` on ${productLine}` : '') +
      ', and there is no default row.',
  };
}
