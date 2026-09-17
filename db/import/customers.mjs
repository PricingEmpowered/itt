#!/usr/bin/env node
/*
 * Import ITT customers.
 *
 *   DATABASE_URL=... node db/import/customers.mjs customer-master.tsv \
 *     [--parents customer-parent.tsv] [--dry-run]
 *
 * Reads the customer master whose numbers match the quote extract
 * (0000071275 style). The other master in the workbook uses a different
 * number range entirely (0010002740 / 0070000215) and is not loaded here —
 * how the two relate is still an open question with ITT.
 *
 * Customer numbers are text throughout so leading zeros survive.
 *
 * A customer number can appear more than once, once per site, differing by
 * state and industry — Lockheed Martin appears under both GA and TX in the
 * sample. Those collapse to one customer row, with the additional sites kept
 * in attributes rather than dropped or allowed to overwrite each other.
 */
import pg from 'pg';
import { parseArgs, readTable, requireDatabaseUrl, slug, value } from './lib.mjs';

const COL = {
  number: 'Customer No',
  name: 'Customer Name',
  region: 'Region',
  state: 'State',
  salesPerson: 'Sales Person',
  industry: 'Industry/Type',
  channel: 'Channel',
};
const PARENT_COL = { number: 'Customer No', parent: 'Parent' };

async function main() {
  const argv = process.argv.slice(2);
  const { file, dryRun } = parseArgs(argv);
  const parentIdx = argv.indexOf('--parents');
  const parentFile = parentIdx !== -1 ? argv[parentIdx + 1] : null;

  if (!file) {
    console.error('Usage: node db/import/customers.mjs <file.tsv> [--parents <file.tsv>] [--dry-run]');
    process.exit(1);
  }

  const { rows } = readTable(file, Object.values(COL));

  const parents = new Map();
  if (parentFile) {
    for (const row of readTable(parentFile, Object.values(PARENT_COL)).rows) {
      const id = value(row[PARENT_COL.number]);
      const parent = value(row[PARENT_COL.parent]);
      if (id && parent) parents.set(id, parent);
    }
  }

  const customers = new Map();
  const regions = new Map();
  const industries = new Map();
  let extraSites = 0;

  for (const row of rows) {
    const id = value(row[COL.number]);
    const name = value(row[COL.name]);
    if (!id || !name) continue;

    const regionName = value(row[COL.region]);
    const industryName = value(row[COL.industry]);
    const site = {
      state: value(row[COL.state]),
      sales_person: value(row[COL.salesPerson]),
      industry: industryName,
    };

    if (regionName) regions.set(slug(regionName, 'reg'), regionName);
    if (industryName) industries.set(slug(industryName, 'ind'), industryName);

    const existing = customers.get(id);
    if (existing) {
      existing.sites.push(site);
      extraSites++;
      continue;
    }

    customers.set(id, {
      id,
      name,
      segment: value(row[COL.channel]),
      region: regionName,
      regionId: regionName ? slug(regionName, 'reg') : null,
      industryId: industryName ? slug(industryName, 'ind') : null,
      sites: [site],
      parent: parents.get(id) ?? null,
    });
  }

  const withParent = [...customers.values()].filter((c) => c.parent).length;
  console.log(
    `Read ${rows.length} rows -> ${customers.size} customers, ` +
      `${regions.size} regions, ${industries.size} industries`
  );
  if (extraSites) console.log(`  ${extraSites} additional site row(s) merged into existing customers`);
  if (parentFile) console.log(`  ${withParent}/${customers.size} matched to a corporate parent`);

  const channels = [...new Set([...customers.values()].map((c) => c.segment).filter(Boolean))];
  console.log(`  channels: ${channels.join(', ') || '(none)'}`);

  if (dryRun) { console.log('\nDry run: nothing written.'); return; }

  const client = new pg.Client({ connectionString: requireDatabaseUrl() });
  await client.connect();
  try {
    await client.query('BEGIN');

    for (const [id, name] of regions) {
      await client.query(
        `INSERT INTO regions (id, name) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`, [id, name]);
    }
    for (const [id, name] of industries) {
      await client.query(
        `INSERT INTO industries (id, name) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`, [id, name]);
    }

    for (const c of customers.values()) {
      await client.query(
        /*
         * annual_volume and annual_revenue are written explicitly NULL. Both
         * columns default to 0, and ITT's customer extract (Customer No,
         * Name, Region, State, Sales Person, Industry/Type, Channel) carries
         * neither figure. Letting the default stand puts "$0.00 annual
         * volume" against a real account, which reads as a customer that
         * buys nothing rather than as a figure nobody supplied.
         */
        `INSERT INTO customers (id, name, segment, region, region_id, industry_id, attributes,
                                annual_volume, annual_revenue)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL)
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name,
               segment = EXCLUDED.segment,
               region = EXCLUDED.region,
               region_id = EXCLUDED.region_id,
               industry_id = EXCLUDED.industry_id,
               attributes = customers.attributes || EXCLUDED.attributes`,
        [c.id, c.name, c.segment, c.region, c.regionId, c.industryId,
         JSON.stringify({ corporate_parent: c.parent, sites: c.sites })]
      );
    }

    await client.query('COMMIT');
    console.log(`\nImported ${customers.size} customers.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
