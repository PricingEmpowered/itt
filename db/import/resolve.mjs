/**
 * Resolving incoming identifiers to things already in the database.
 *
 * ## Why this is separate
 *
 * Sales, Booking and SPA each arrive with a different subset of identifiers.
 * Sales carries an internal part number and no catalog number; Booking
 * carries both; SPA carries a catalog number, an internal number, ITT's own
 * normalised form, and the customer's and competitor's part numbers. All
 * three must land on the same product.
 *
 * ## Why nothing here guesses
 *
 * These importers were written against column definitions, not against data -
 * ITT cannot share extracts - so every resolution records how confident it is
 * and what it matched on. A row that resolves by an exact catalog number and
 * one that resolves by a normalised near-miss are both loaded, but the
 * diagnostics can tell them apart, and a human can look at the second kind.
 *
 * Unresolved is a first-class outcome. A row with no product is still loaded,
 * with its source identifier kept, because an invoice line that exists is
 * worth more than one silently dropped for not matching a catalogue that may
 * itself be incomplete.
 */
import { catalogPartNumber, value } from './lib.mjs';

/**
 * ITT's normalisation, as the SPA views apply it: uppercase, non-alphanumerics
 * removed. Reproduces `PART_NO_ALPHA_NUM` on every sample row, including
 * dropping the decimal point in `1.5F`.
 *
 * The price list's `Stripped Description` does NOT agree - it writes `V0`
 * where the SPA views keep `VO` - so this is one of two normalisations in
 * play. Which is correct is an open question with ITT; the diagnostics report
 * rows where the two disagree rather than picking a winner.
 */
export function normalisePartNumber(raw) {
  const v = value(raw);
  if (v === null) return null;
  const n = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return n === '' ? null : n;
}

/** How a match was made, weakest last. Reported, never hidden. */
export const MATCH = {
  CATALOG: 'catalog part number',
  INTERNAL: 'internal part number',
  ALPHA_NUM: "ITT's normalised form",
  NORMALISED: 'normalised comparison',
  NONE: null,
};

/**
 * Builds the lookup once per import rather than querying per row. A few tens
 * of thousands of products is a small map and a large number of round trips.
 */
export async function loadProductIndex(client) {
  const byCatalog = new Map();
  const byInternal = new Map();
  const byNormalised = new Map();

  const { rows: products } = await client.query('SELECT id, attributes FROM products');
  for (const p of products) {
    byCatalog.set(p.id.toUpperCase(), p.id);
    const norm = normalisePartNumber(p.id);
    if (norm && !byNormalised.has(norm)) byNormalised.set(norm, p.id);
    const global = p.attributes?.global_part_number;
    if (global) byInternal.set(String(global).toUpperCase(), p.id);
  }

  const { rows: alt } = await client.query(
    'SELECT product_id, kind, part_number, normalised FROM product_part_numbers'
  );
  for (const a of alt) {
    if (!a.product_id) continue;
    const key = a.part_number.toUpperCase();
    if (a.kind === 'internal') {
      if (!byInternal.has(key)) byInternal.set(key, a.product_id);
    } else if (!byCatalog.has(key)) {
      byCatalog.set(key, a.product_id);
    }
    if (a.normalised && !byNormalised.has(a.normalised)) {
      byNormalised.set(a.normalised, a.product_id);
    }
  }

  return { byCatalog, byInternal, byNormalised };
}

/**
 * Resolves whichever identifiers a row happens to carry.
 *
 * Tried strongest first: an exact catalog number, then an exact internal
 * number, then ITT's own normalised form, then a normalised comparison of
 * anything left. The last is the one to watch - it is where the two competing
 * normalisations could quietly match the wrong part - so it is reported
 * separately.
 */
export function resolveProduct(index, candidates) {
  const { catalog, internal, alphaNum, description } = candidates;

  const cat = catalogPartNumber(catalog);
  if (cat) {
    const hit = index.byCatalog.get(cat.toUpperCase());
    if (hit) return { productId: hit, matchedOn: MATCH.CATALOG, matchedValue: cat };
  }

  const int = value(internal);
  if (int) {
    const hit = index.byInternal.get(int.toUpperCase());
    if (hit) return { productId: hit, matchedOn: MATCH.INTERNAL, matchedValue: int };
  }

  const alpha = value(alphaNum);
  if (alpha) {
    const hit = index.byNormalised.get(alpha.toUpperCase());
    if (hit) return { productId: hit, matchedOn: MATCH.ALPHA_NUM, matchedValue: alpha };
  }

  for (const candidate of [catalog, description, internal]) {
    const norm = normalisePartNumber(candidate);
    if (!norm) continue;
    const hit = index.byNormalised.get(norm);
    if (hit) {
      return { productId: hit, matchedOn: MATCH.NORMALISED, matchedValue: value(candidate) };
    }
  }

  return {
    productId: null,
    matchedOn: MATCH.NONE,
    matchedValue: value(catalog) ?? value(internal) ?? value(description) ?? null,
  };
}

/**
 * Customer numbers carry a role. Bill-to numbers begin 000 in every sample;
 * ship-to numbers begin with a site prefix (007 IRNO, 001 Weinstadt).
 *
 * This reports what the prefix suggests rather than enforcing it, because a
 * prefix is a pattern observed across a handful of rows, not a documented
 * rule. A row whose number contradicts its column is loaded and flagged.
 */
export function customerRoleHint(number) {
  const v = value(number);
  if (v === null) return null;
  if (v.startsWith('000')) return 'bill-to';
  if (/^0[01][0-9]/.test(v)) return 'ship-to';
  return null;
}

export async function loadCustomerIndex(client) {
  const byId = new Set();
  const { rows } = await client.query('SELECT id FROM customers');
  for (const r of rows) byId.add(r.id);
  return byId;
}
