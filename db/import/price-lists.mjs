#!/usr/bin/env node
/*
 * Import an ITT price list.
 *
 *   DATABASE_URL=... node db/import/price-lists.mjs <file.tsv> [--dry-run]
 *
 * One file per list: Europe and North America, each OEM and Distribution.
 * The list's identity, currency and tier columns are read from the file's own
 * Region/Type/Currency values rather than the filename.
 *
 * Tiers. Each row carries 25 quantity-break slots — QR1..QR25 with prices
 * R1..R25 on an OEM sheet, QC/C on a Distribution sheet. In practice only the
 * first one to four are used and the remainder are zero-filled padding. A zero
 * quantity means "unused slot", NOT a break starting at zero, so padding is
 * discarded; loading it would create dozens of zero-priced breaks per part and
 * every quote would price at zero.
 *
 * Products are keyed by manufacturer part number (the "Description" column),
 * matching the item master import and the quote extract.
 *
 * Note on cost: a Distribution list's "cost" is what the distributor pays,
 * i.e. ITT's revenue — not ITT's own cost — so it is loaded as a price list
 * and deliberately does NOT populate products.base_cost. Margin needs a real
 * cost basis, which none of these extracts carry.
 */
import pg from 'pg';
import { integer, number, parseArgs, readTable, requireDatabaseUrl, value } from './lib.mjs';

const BASE = {
  description: 'Description',
  globalPartNumber: 'Global Manufacturing Part Number',
  series: 'Series',
  line: 'Line',
  currency: 'Currency',
  region: 'Region',
  type: 'Type',
  moq: 'MOQ',
  packageQty: 'Package Qty',
  leadTime: 'Estimated Mfg Lead Time',
  countryOfOrigin: 'Country of Origin',
  rohs: 'RoHS Compliant',
  reach: 'REACh SVHC',
  eccn: 'ECCN Code',
  hts: 'HTS Code',
};

const LIST_IDS = {
  'European|OEM': ['PL-EU-OEM', 'Europe — OEM'],
  'European|Distribution Cost': ['PL-EU-DIST', 'Europe — Distribution'],
  'North American|OEM': ['PL-NA-OEM', 'North America — OEM'],
  'North American|Distribution Cost': ['PL-NA-DIST', 'North America — Distribution'],
};

/** Reads the up-to-25 (quantity, price) slots, dropping zero-filled padding. */
function readTiers(row, prefix) {
  const tiers = [];
  for (let i = 1; i <= 25; i++) {
    const qty = integer(row[`Q${prefix}${i}`]);
    const price = number(row[`${prefix}${i}`]);
    if (!qty || qty <= 0) continue;          // unused slot
    if (price === null || price <= 0) continue; // no usable price
    tiers.push({ qty, price });
  }
  tiers.sort((a, b) => a.qty - b.qty);
  // A break runs until the next one starts; the last is open-ended.
  return tiers.map((t, i) => ({
    ...t,
    maxQty: i < tiers.length - 1 ? tiers[i + 1].qty - 1 : null,
  }));
}

async function main() {
  const { file, dryRun } = parseArgs(process.argv.slice(2));
  if (!file) {
    console.error('Usage: node db/import/price-lists.mjs <file.tsv|file.csv> [--dry-run]');
    process.exit(1);
  }

  const { header, rows } = readTable(file, Object.values(BASE));
  const prefix = header.includes('QR1') ? 'R' : header.includes('QC1') ? 'C' : null;
  if (!prefix) throw new Error('No tier columns found (expected QR1..QR25 or QC1..QC25)');

  const region = value(rows[0]?.[BASE.region]);
  const type = value(rows[0]?.[BASE.type]);
  const currency = value(rows[0]?.[BASE.currency]);
  const known = LIST_IDS[`${region}|${type}`];
  if (!known) throw new Error(`Unrecognised list: region "${region}", type "${type}"`);
  const [listId, listName] = known;

  const items = [];
  const skipped = [];
  let tierTotal = 0;

  for (const [index, row] of rows.entries()) {
    const partNumber = value(row[BASE.description]);
    if (!partNumber) { skipped.push({ line: index + 2, why: 'no part number' }); continue; }

    const tiers = readTiers(row, prefix);
    if (tiers.length === 0) { skipped.push({ line: index + 2, why: `${partNumber}: no priced tier` }); continue; }
    tierTotal += tiers.length;

    items.push({
      partNumber,
      globalPartNumber: value(row[BASE.globalPartNumber]),
      listPrice: tiers[0].price,
      tiers,
      attributes: {
        series: value(row[BASE.series]),
        line: value(row[BASE.line]),
        moq: integer(row[BASE.moq]),
        package_qty: integer(row[BASE.packageQty]),
        lead_time: value(row[BASE.leadTime]),
        country_of_origin: value(row[BASE.countryOfOrigin]),
        rohs: value(row[BASE.rohs]),
        reach_svhc: value(row[BASE.reach]),
        eccn_code: value(row[BASE.eccn]),
        hts_code: value(row[BASE.hts]),
      },
    });
  }

  const counts = items.reduce((m, i) => { m[i.tiers.length] = (m[i.tiers.length] ?? 0) + 1; return m; }, {});
  console.log(`${listName}  [${listId}, ${currency}, tier columns Q${prefix}n/${prefix}n]`);
  console.log(`  ${rows.length} rows -> ${items.length} items, ${tierTotal} quantity breaks`);
  console.log('  breaks per part: ' + Object.entries(counts).sort().map(([n, c]) => `${n}x${c}`).join(' '));
  skipped.forEach((s) => console.warn(`  skipped line ${s.line}: ${s.why}`));

  if (dryRun) { console.log('\nDry run: nothing written.'); return; }

  const client = new pg.Client({ connectionString: requireDatabaseUrl() });
  await client.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO price_lists (id, name, currency, effective_from, version)
       VALUES ($1, $2, $3, CURRENT_DATE, 1)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, currency = EXCLUDED.currency`,
      [listId, listName, currency]
    );

    for (const item of items) {
      // The item master may not have been loaded, or may not carry this part.
      await client.query(
        `INSERT INTO products (id, name, uom, status, attributes)
         VALUES ($1, $1, 'EA', 'Active', $2)
         ON CONFLICT (id) DO UPDATE SET attributes = products.attributes || EXCLUDED.attributes`,
        [item.partNumber, JSON.stringify({
          ...item.attributes,
          global_part_number: item.globalPartNumber,
        })]
      );

      await client.query(
        `INSERT INTO price_list_items (price_list_id, product_id, list_price)
         VALUES ($1, $2, $3)`,
        [listId, item.partNumber, item.listPrice]
      );

      // Replace this list's breaks for the part, so a re-import cannot stack.
      await client.query(
        'DELETE FROM quantity_breaks WHERE price_list_id = $1 AND product_id = $2',
        [listId, item.partNumber]
      );
      for (const tier of item.tiers) {
        /*
         * discount_percent is explicitly NULL: the column defaults to 0, and
         * a check constraint allows exactly one of discount_percent and
         * fixed_price to be set. These tiers are absolute prices, not
         * discounts, so the default has to be overridden rather than left.
         */
        await client.query(
          `INSERT INTO quantity_breaks
             (product_id, price_list_id, min_quantity, max_quantity, fixed_price, discount_percent)
           VALUES ($1, $2, $3, $4, $5, NULL)`,
          [item.partNumber, listId, tier.qty, tier.maxQty, tier.price]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`\nImported ${items.length} items and ${tierTotal} breaks into ${listId}.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
