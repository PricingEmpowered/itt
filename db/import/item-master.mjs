#!/usr/bin/env node
/*
 * Import the ITT item master.
 *
 *   DATABASE_URL=... node db/import/item-master.mjs item-master.tsv [--dry-run]
 *
 * Products are keyed by their MANUFACTURER part number (the extract's "Part
 * Description", e.g. CIR02R36-10SW-F80T12), not the 9-digit internal number,
 * because that is the identifier the quote extract and the price lists both
 * use. The 9-digit number is kept in attributes.global_part_number, which is
 * what joins a product back to the item master and the price lists.
 *
 * The four "Product Family Level" columns form a hierarchy, loaded into
 * product_families via parent_family_id. Level 1 is an internal coding string
 * (e.g. "VO   VOCO VOCO10 5"); levels 2-4 are the readable names, so the
 * hierarchy is built from levels 2 down and level 1 is kept as an attribute.
 */
import pg from 'pg';
import { parseArgs, readTable, requireDatabaseUrl, slug, value } from './lib.mjs';

const COL = {
  partNumber: 'Part Number',
  description: 'Part Description',
  l1: 'Product Family Level 1',
  l2: 'Product Family Level 2',
  l3: 'Product Family Level 3',
  l4: 'Product Family Level 4',
};

async function main() {
  const { file, dryRun } = parseArgs(process.argv.slice(2));
  if (!file) {
    console.error('Usage: node db/import/item-master.mjs <file.tsv|file.csv> [--dry-run]');
    process.exit(1);
  }

  const { rows } = readTable(file, Object.values(COL));

  const families = new Map(); // id -> { id, name, parent }
  const products = [];
  const skipped = [];

  for (const [index, row] of rows.entries()) {
    const globalPartNumber = value(row[COL.partNumber]);
    const partNumber = value(row[COL.description]);

    // Without a manufacturer part number there is nothing to key on, and
    // nothing in quotes or the price lists could ever match it.
    if (!partNumber) {
      skipped.push({ line: index + 2, globalPartNumber, why: 'no part description' });
      continue;
    }

    const levels = [row[COL.l2], row[COL.l3], row[COL.l4]].map(value);
    let parent = null;
    let familyId = null;

    for (const level of levels) {
      if (!level) break;
      const id = slug(level, 'fam');
      if (!families.has(id)) families.set(id, { id, name: level, parent });
      parent = id;
      familyId = id;
    }

    products.push({
      id: partNumber,
      name: partNumber,
      category: value(row[COL.l2]),
      familyId,
      globalPartNumber,
      codingString: value(row[COL.l1]),
      familyPath: levels.filter(Boolean),
    });
  }

  const dupes = products.length - new Set(products.map((p) => p.id)).size;
  console.log(
    `Read ${rows.length} rows -> ${products.length} products, ${families.size} families` +
      (dupes ? `, ${dupes} duplicate part number(s) collapsed` : '')
  );
  skipped.forEach((s) => console.warn(`  skipped line ${s.line} (${s.globalPartNumber}): ${s.why}`));

  const depth = {};
  families.forEach((f) => {
    let d = 1, p = f.parent;
    while (p) { d++; p = families.get(p)?.parent ?? null; }
    depth[d] = (depth[d] ?? 0) + 1;
  });
  console.log('  family levels: ' + Object.entries(depth).map(([d, n]) => `L${d}=${n}`).join(' '));

  if (dryRun) { console.log('\nDry run: nothing written.'); return; }

  const client = new pg.Client({ connectionString: requireDatabaseUrl() });
  await client.connect();
  try {
    await client.query('BEGIN');

    // Parents before children, so parent_family_id always resolves.
    const ordered = [];
    const emit = (f) => {
      if (!f || ordered.includes(f)) return;
      if (f.parent) emit(families.get(f.parent));
      ordered.push(f);
    };
    families.forEach(emit);

    for (const f of ordered) {
      await client.query(
        `INSERT INTO product_families (id, name, parent_family_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name, parent_family_id = EXCLUDED.parent_family_id`,
        [f.id, f.name, f.parent]
      );
    }

    for (const p of products) {
      await client.query(
        `INSERT INTO products (id, name, category, family_id, attributes, base_cost, uom, status)
         VALUES ($1, $2, $3, $4, $5, NULL, 'EA', 'Active')  -- base_cost NULL: no extract carries a cost basis
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name,
               category = EXCLUDED.category,
               family_id = EXCLUDED.family_id,
               -- Merge so a later price-list import does not lose these keys.
               attributes = products.attributes || EXCLUDED.attributes`,
        [
          p.id, p.name, p.category, p.familyId,
          JSON.stringify({
            global_part_number: p.globalPartNumber,
            family_coding: p.codingString,
            family_path: p.familyPath,
          }),
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`\nImported ${families.size} families and ${products.length} products.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
