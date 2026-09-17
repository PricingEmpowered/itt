/**
 * Number and currency formatting that tolerates missing values.
 *
 * Real ITT data carries genuine nulls where the demo data never did: products
 * have no cost basis (none of the source extracts provide one), and quote
 * lines routinely arrive without a unit price or booked cost. Calling
 * `.toLocaleString()` straight on those fields throws and takes the whole
 * screen down, which is how the product catalogue first failed on real data.
 *
 * These helpers also absorb the other thing the data does: `numeric` columns
 * can arrive as strings depending on the driver, so a value may be a number,
 * a numeric string, or absent.
 */

/** Shown in place of a value that genuinely is not known. */
export const MISSING = '—';

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Money. Returns the placeholder rather than "$0.00" when the value is
 * missing — a fabricated zero reads as a real price and would quietly distort
 * any total or average computed from it.
 */
export function formatCurrency(
  value: unknown,
  options: { decimals?: number; symbol?: string; fallback?: string } = {}
): string {
  const { decimals = 2, symbol = '$', fallback = MISSING } = options;
  const n = toNumber(value);
  if (n === null) return fallback;
  return (
    symbol +
    n.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

/** A plain number, grouped. */
export function formatNumber(
  value: unknown,
  options: { decimals?: number; fallback?: string } = {}
): string {
  const { decimals = 0, fallback = MISSING } = options;
  const n = toNumber(value);
  if (n === null) return fallback;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** A percentage, with the sign left to the caller's wording. */
export function formatPercent(
  value: unknown,
  options: { decimals?: number; fallback?: string } = {}
): string {
  const { decimals = 1, fallback = MISSING } = options;
  const n = toNumber(value);
  if (n === null) return fallback;
  return `${n.toFixed(decimals)}%`;
}

/** The numeric value, or null. For arithmetic rather than display. */
export function asNumber(value: unknown): number | null {
  return toNumber(value);
}
