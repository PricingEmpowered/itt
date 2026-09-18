/*
 * Shared helpers for the ITT import scripts.
 *
 * The extracts are Excel exports saved as delimited text, which brings a few
 * consistent quirks these helpers absorb: the literal string "NULL" for a
 * missing value, US-format dates, numbers carrying currency symbols and
 * thousands separators, and identifiers whose leading zeros must survive.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * A missing value. The extracts write the literal "NULL", which is not the
 * same as an empty cell and must never become 0 or "" — a fabricated zero
 * price is indistinguishable from a real one.
 */
export function value(raw) {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === '' || trimmed.toUpperCase() === 'NULL') return null;
  return trimmed;
}

/**
 * The catalog part number as the rest of the data writes it.
 *
 * The item master's `Part Description` carries packaging annotations inside
 * the part number: `43381-24        (100 PCS PACK)`, `16958/1 (100 PCS PACK)`,
 * `47107-155T9      (10 PCS PACK)`. Six of seventeen sample rows do. Used
 * verbatim as a product id, none of them can ever match the same part as a
 * price list or a quote writes it -- both of those carry the bare number.
 *
 * So: drop parentheticals, collapse runs of whitespace. The pack quantity is
 * not thrown away; the caller records it alongside the raw string.
 *
 * This is a stopgap. ITT's own quoting system stores a normalized form of
 * every part number next to the display form (`PART_NO_ALPHA_NUM` and its
 * siblings), and when that rule is available it should replace this, because
 * it is the one their systems already agree on.
 */
export function catalogPartNumber(raw) {
  const v = value(raw);
  if (v === null) return null;
  const stripped = v.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped === '' ? null : stripped;
}

/** Pack quantity from an annotation like `(100 PCS PACK)`. Null when absent. */
export function packQuantity(raw) {
  const v = value(raw);
  if (v === null) return null;
  const m = v.match(/\((\d+)\s*(?:PCS|PC|EA)?\s*PACK\)/i);
  return m ? Number(m[1]) : null;
}

export function number(raw) {
  const v = value(raw);
  if (v === null) return null;
  const cleaned = v.replace(/[$€£,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function integer(raw) {
  const n = number(raw);
  return n === null ? null : Math.round(n);
}

/** US-style M/D/YYYY, or an ISO/Excel timestamp. Returned ISO for Postgres. */
export function date(raw) {
  const v = value(raw);
  if (v === null) return null;
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

/** Minimal RFC-4180 reader; handles quoted fields containing the delimiter. */
export function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/**
 * Read a delimited export into objects keyed by header, checking that the
 * columns we depend on are present. A renamed column should stop the import
 * with a clear message, not silently import nulls.
 */
export function readTable(file, required = []) {
  const text = readFileSync(file, 'utf8');
  const delimiter = path.extname(file).toLowerCase() === '.csv' ? ',' : '\t';
  const rows = parseDelimited(text, delimiter);
  if (rows.length === 0) throw new Error(`${file} is empty`);

  const header = rows[0].map((h) => h.trim());
  const missing = required.filter((c) => !header.includes(c));
  if (missing.length) {
    throw new Error(
      `${path.basename(file)} is missing expected column(s): ${missing.join(', ')}\n` +
        `Found: ${header.join(', ')}`
    );
  }
  return {
    header,
    rows: rows.slice(1).map((cells) =>
      Object.fromEntries(header.map((h, i) => [h, cells[i]]))
    ),
  };
}

/** A stable, readable key from a label (for family/region/industry ids). */
export function slug(text, prefix = '') {
  const base = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return prefix ? `${prefix}-${base}` : base;
}

export function parseArgs(argv) {
  return {
    file: argv.find((a) => !a.startsWith('--')) ?? null,
    dryRun: argv.includes('--dry-run'),
    flags: new Set(argv.filter((a) => a.startsWith('--'))),
  };
}

export function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  return url;
}
