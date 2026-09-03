#!/usr/bin/env node
/*
 * Import ITT quotes from the ECIW extract.
 *
 * Usage:
 *   DATABASE_URL=... node db/import/quotes.mjs <file.tsv|file.csv> [options]
 *
 *   --dry-run            parse, validate and report; write nothing
 *   --create-placeholders create stub customers/products for unmatched keys
 *
 * The extract is one row per quote LINE, with the quote number repeated
 * across its lines. Rows are grouped into one `quotes` row plus N
 * `quote_lines`.
 *
 * By default a line whose part or customer is not already in the database is
 * reported and skipped rather than invented, so an import cannot quietly
 * manufacture catalogue entries. Pass --create-placeholders once the masters
 * are loaded and you want the stragglers stubbed in.
 *
 * Re-running is safe: a quote is replaced wholesale by its latest version.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const COLUMNS = {
  quoteNumber: 'Quote #',
  customerName: 'Customer Name (ECIW)',
  customerNumber: 'Customer Number (Matching)',
  partNumber: 'Part Number',
  minQty: 'MinQty',
  bookedCost: 'Booked Cost',
  unitPrice: 'Unit Price',
  effectiveDate: 'Effective Date',
  expirationDate: 'Expiration Date',
  requestDate: 'Request Date',
  quoteDate: 'Quote Date',
  outcome: 'Outcome',
};

/**
 * The extract writes the literal string NULL for a missing value, which is
 * not the same as an empty cell and must not become 0 or "".
 */
function value(raw) {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === '' || trimmed.toUpperCase() === 'NULL') return null;
  return trimmed;
}

function number(raw) {
  const v = value(raw);
  if (v === null) return null;
  // Strip thousands separators and currency symbols the export may include.
  const cleaned = v.replace(/[$€£,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function integer(raw) {
  const n = number(raw);
  return n === null ? null : Math.round(n);
}

/** Dates arrive US-style, M/D/YYYY. Returned as ISO for Postgres. */
function date(raw) {
  const v = value(raw);
  if (v === null) return null;

  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const [, m, d, y] = us;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Already ISO, or an Excel-exported timestamp.
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  return null;
}

/** Minimal RFC-4180 reader; handles quoted fields containing the delimiter. */
function parseDelimited(text, delimiter) {
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

function readRows(file) {
  const text = readFileSync(file, 'utf8');
  const delimiter = path.extname(file).toLowerCase() === '.csv' ? ',' : '\t';
  const rows = parseDelimited(text, delimiter);
  if (rows.length === 0) throw new Error('File is empty');

  const header = rows[0].map((h) => h.trim());
  const missing = Object.values(COLUMNS).filter((c) => !header.includes(c));
  if (missing.length) {
    throw new Error(
      `Missing expected column(s): ${missing.join(', ')}\nFound: ${header.join(', ')}`
    );
  }

  return rows.slice(1).map((cells) =>
    Object.fromEntries(header.map((h, i) => [h, cells[i]]))
  );
}

/** Group line rows into quotes. Quote-level fields are taken from the first
 * line; a later line disagreeing is reported rather than silently ignored. */
function groupQuotes(rows) {
  const quotes = new Map();
  const conflicts = [];

  rows.forEach((row, index) => {
    const id = value(row[COLUMNS.quoteNumber]);
    if (!id) return;

    const header = {
      id,
      customerNumber: value(row[COLUMNS.customerNumber]),
      customerName: value(row[COLUMNS.customerName]),
      quoteDate: date(row[COLUMNS.quoteDate]),
      requestDate: date(row[COLUMNS.requestDate]),
      effectiveDate: date(row[COLUMNS.effectiveDate]),
      expirationDate: date(row[COLUMNS.expirationDate]),
      outcome: value(row[COLUMNS.outcome]),
    };

    const line = {
      sourcePartNumber: value(row[COLUMNS.partNumber]),
      minQty: integer(row[COLUMNS.minQty]),
      bookedCost: number(row[COLUMNS.bookedCost]),
      unitPrice: number(row[COLUMNS.unitPrice]),
      sourceRow: index + 2,
    };

    const existing = quotes.get(id);
    if (!existing) {
      quotes.set(id, { ...header, lines: [line] });
      return;
    }

    /*
     * A quote number whose lines name different customers cannot be turned
     * into one quote. Picking either customer would attribute the other's
     * pricing to them, which is worse than not importing it, so the whole
     * quote is rejected and reported.
     */
    if (header.customerNumber !== existing.customerNumber) {
      existing.customerConflict = true;
      conflicts.push(
        `${id}: lines name different customers ` +
          `(${existing.customerNumber} ${existing.customerName ?? ''} vs ` +
          `${header.customerNumber} ${header.customerName ?? ''})`
      );
      return;
    }

    // Differing dates or outcome are survivable; the header keeps the first.
    for (const key of ['quoteDate', 'outcome']) {
      if (header[key] !== existing[key]) {
        conflicts.push(
          `${id}: ${key} differs between lines (${existing[key]} vs ${header[key]}), keeping the first`
        );
      }
    }
    existing.lines.push(line);
  });

  const all = [...quotes.values()];
  const rejected = all.filter((q) => q.customerConflict);
  return {
    quotes: all.filter((q) => !q.customerConflict),
    rejected,
    conflicts: [...new Set(conflicts)],
  };
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const createPlaceholders = args.includes('--create-placeholders');

  if (!file) {
    console.error('Usage: node db/import/quotes.mjs <file.tsv|file.csv> [--dry-run] [--create-placeholders]');
    process.exit(1);
  }

  const rows = readRows(file);
  const { quotes, rejected, conflicts } = groupQuotes(rows);
  const lineCount = quotes.reduce((n, q) => n + q.lines.length, 0);

  console.log(
    `Read ${rows.length} line rows -> ${quotes.length} quotes, ${lineCount} lines` +
      (rejected.length ? `, ${rejected.length} rejected` : '')
  );
  conflicts.forEach((c) => console.warn(`  warning: ${c}`));
  if (rejected.length) {
    console.warn(
      `  ${rejected.length} quote(s) skipped because their lines name more than ` +
        'one customer: ' + rejected.map((q) => q.id).join(', ')
    );
  }

  const withoutOutcome = quotes.filter((q) => !q.outcome).length;
  if (withoutOutcome) {
    console.warn(
      `  warning: ${withoutOutcome}/${quotes.length} quotes have no outcome; ` +
        'win rate and deal scoring cannot be computed for them'
    );
  }
  const unpriced = quotes.reduce(
    (n, q) => n + q.lines.filter((l) => l.unitPrice === null).length, 0
  );
  if (unpriced) console.warn(`  warning: ${unpriced}/${lineCount} lines have no unit price`);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const customerNumbers = [...new Set(quotes.map((q) => q.customerNumber).filter(Boolean))];
    const partNumbers = [
      ...new Set(quotes.flatMap((q) => q.lines.map((l) => l.sourcePartNumber)).filter(Boolean)),
    ];

    const known = async (table, ids) => {
      if (ids.length === 0) return new Set();
      const { rows } = await client.query(`SELECT id FROM ${table} WHERE id = ANY($1)`, [ids]);
      return new Set(rows.map((r) => r.id));
    };

    const knownCustomers = await known('customers', customerNumbers);
    const knownProducts = await known('products', partNumbers);

    const missingCustomers = customerNumbers.filter((c) => !knownCustomers.has(c));
    const missingParts = partNumbers.filter((p) => !knownProducts.has(p));

    if (missingCustomers.length) {
      console.warn(`\n${missingCustomers.length}/${customerNumbers.length} customers not in the database:`);
      missingCustomers.slice(0, 10).forEach((c) => console.warn(`  ${c}`));
      if (missingCustomers.length > 10) console.warn(`  ... and ${missingCustomers.length - 10} more`);
    }
    if (missingParts.length) {
      console.warn(`\n${missingParts.length}/${partNumbers.length} parts not in the database:`);
      missingParts.slice(0, 10).forEach((p) => console.warn(`  ${p}`));
      if (missingParts.length > 10) console.warn(`  ... and ${missingParts.length - 10} more`);
    }

    if ((missingCustomers.length || missingParts.length) && !createPlaceholders && !dryRun) {
      console.error(
        '\nRefusing to import: load the customer and item masters first, or pass ' +
          '--create-placeholders to stub the unmatched keys.'
      );
      process.exit(1);
    }

    if (dryRun) {
      console.log('\nDry run: nothing written.');
      return;
    }

    await client.query('BEGIN');

    if (createPlaceholders) {
      for (const id of missingCustomers) {
        const name = quotes.find((q) => q.customerNumber === id)?.customerName ?? id;
        await client.query(
          `INSERT INTO customers (id, name, segment, region)
           VALUES ($1, $2, 'Unknown', 'Unknown') ON CONFLICT (id) DO NOTHING`,
          [id, name]
        );
      }
      for (const id of missingParts) {
        await client.query(
          `INSERT INTO products (id, name, category, base_cost, uom, status)
           VALUES ($1, $1, 'Uncategorised', 0, 'EA', 'Active') ON CONFLICT (id) DO NOTHING`,
          [id]
        );
      }
      if (missingCustomers.length || missingParts.length) {
        console.log(
          `\nCreated ${missingCustomers.length} placeholder customers and ` +
            `${missingParts.length} placeholder products.`
        );
      }
    }

    let importedQuotes = 0;
    let importedLines = 0;

    for (const quote of quotes) {
      await client.query(
        `INSERT INTO quotes (
           id, customer_id, status, outcome, quote_date, request_date,
           effective_date, expiration_date, source_customer_name, source_system,
           subtotal, tax, total, approvals_required
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ECIW', 0, 0, 0, 0)
         ON CONFLICT (id) DO UPDATE SET
           customer_id = EXCLUDED.customer_id,
           status = EXCLUDED.status,
           outcome = EXCLUDED.outcome,
           quote_date = EXCLUDED.quote_date,
           request_date = EXCLUDED.request_date,
           effective_date = EXCLUDED.effective_date,
           expiration_date = EXCLUDED.expiration_date,
           source_customer_name = EXCLUDED.source_customer_name,
           source_system = EXCLUDED.source_system,
           updated_at = now()`,
        [
          quote.id,
          quote.customerNumber,
          // Outcome drives status; without one the quote is simply open.
          quote.outcome ?? 'Quoted',
          quote.outcome,
          quote.quoteDate,
          quote.requestDate,
          quote.effectiveDate,
          quote.expirationDate,
          quote.customerName,
        ]
      );

      // Replace lines wholesale so a re-import cannot duplicate or strand them.
      await client.query('DELETE FROM quote_lines WHERE quote_id = $1', [quote.id]);

      for (const line of quote.lines) {
        if (!knownProducts.has(line.sourcePartNumber) && !createPlaceholders) continue;
        await client.query(
          `INSERT INTO quote_lines
             (quote_id, product_id, min_qty, unit_price, booked_cost, source_part_number)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            quote.id,
            line.sourcePartNumber,
            line.minQty,
            line.unitPrice,
            line.bookedCost,
            line.sourcePartNumber,
          ]
        );
        importedLines++;
      }
      importedQuotes++;
    }

    await client.query('COMMIT');
    console.log(`\nImported ${importedQuotes} quotes and ${importedLines} lines.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
