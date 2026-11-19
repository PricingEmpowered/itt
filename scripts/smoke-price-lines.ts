/**
 * Smoke test: prices real lines against a real database.
 *
 *   DATABASE_URL=... npx tsx scripts/smoke-price-lines.ts
 *
 * The unit checks in check-price-bands.ts prove the arithmetic. This proves
 * the part they cannot: that the cohort SQL runs, that it returns margins in
 * the shape priceBands expects, and that a quote of ordinary catalogue parts
 * comes back with a band rather than an exception or a page of nulls.
 *
 * It reads the database and writes nothing.
 */

import pg from 'pg';
import { priceQuoteLines } from '../server/pricing/priceQuoteLines.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

function money(v: number | null): string {
  return v === null ? '—' : '$' + v.toFixed(2);
}

async function main() {
  await client.connect();

  const { rows: customers } = await client.query<{ id: string; name: string }>(
    `SELECT c.id, c.name
       FROM customers c
       JOIN quotes q ON q.customer_id = c.id
      GROUP BY c.id, c.name
      ORDER BY count(*) DESC
      LIMIT 1`
  );
  if (customers.length === 0) {
    console.error('No customer with quote history; seed demo data first.');
    process.exit(1);
  }
  const customer = customers[0];

  const { rows: products } = await client.query<{
    id: string;
    name: string;
    category: string | null;
    base_cost: string | null;
  }>(
    `SELECT p.id, p.name, p.category, p.base_cost
       FROM products p
      WHERE p.base_cost > 0 AND p.category IS NOT NULL
      ORDER BY p.id
      LIMIT 4`
  );

  const lines = [
    ...products.map((p) => ({
      productId: p.id,
      partNumber: p.id,
      quantity: 10,
      listPrice: Number(p.base_cost) * 2,
      cost: null,
    })),
    /* A configured part: not in the catalogue, cost supplied by the form. */
    { productId: null, partNumber: 'CONFIG-XYZ-001', quantity: 5, listPrice: 900, cost: 400 },
    /* The same, with no cost at all. Must come back unpriced, not guessed. */
    { productId: null, partNumber: 'CONFIG-NOCOST', quantity: 5, listPrice: 900, cost: null },
  ];

  console.log(`\nCustomer: ${customer.name} (${customer.id})`);
  console.log(`Lines:    ${lines.length}\n`);

  const started = Date.now();
  const priced = await priceQuoteLines(client, customer.id, lines);
  const elapsed = Date.now() - started;

  let failures = 0;

  for (const p of priced) {
    const label = (p.productId ?? p.partNumber ?? '?').padEnd(18).slice(0, 18);
    const basis = p.band.priceable ? p.band.targetBasis : 'unpriced';
    console.log(
      `  ${label} ` +
        `floor ${money(p.band.floor).padStart(10)}  ` +
        `target ${money(p.band.target).padStart(10)}  ` +
        `ceiling ${money(p.band.ceiling).padStart(10)}  ` +
        `${basis}${p.band.priceable && p.band.targetBasis === 'comparable' ? ` (${p.band.comparableCount}, ${p.band.cohortUsed})` : ''}`
    );

    /* Invariants that must hold on live data, not just in the unit checks. */
    if (p.band.priceable) {
      if (p.band.floor !== null && p.band.target !== null && p.band.floor > p.band.target + 1e-6) {
        console.log('       FAIL floor above target');
        failures++;
      }
      if (p.band.ceiling !== null && p.band.target !== null && p.band.ceiling < p.band.target - 1e-6) {
        console.log('       FAIL ceiling below target');
        failures++;
      }
      if (p.band.rationale.length === 0) {
        console.log('       FAIL priced line with no rationale');
        failures++;
      }
    }
  }

  const noCost = priced.find((p) => p.partNumber === 'CONFIG-NOCOST');
  if (!noCost || noCost.band.priceable) {
    console.log('\n  FAIL a line with no cost was priced anyway');
    failures++;
  } else {
    console.log('\n  ok   a line with no cost came back unpriced');
  }

  const configured = priced.find((p) => p.partNumber === 'CONFIG-XYZ-001');
  if (!configured || configured.band.target === null) {
    console.log('  FAIL the configured line with a supplied cost was not priced');
    failures++;
  } else {
    console.log('  ok   a configured line priced from the cost on the form');
  }

  console.log(`\n  priced ${priced.length} lines in ${elapsed} ms`);
  console.log(failures === 0 ? '\nall invariants held\n' : `\n${failures} failure(s)\n`);

  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await client.end().catch(() => {});
  process.exit(1);
});
