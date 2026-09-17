#!/usr/bin/env node
/*
 * Backfill deal scores.
 *
 * Deal scoring has never run: the browser-side calculator issued a query the
 * API layer cannot serve and failed silently on every call (see
 * server/dealScore.ts). Scores are now produced on the server, but existing
 * quotes - the 900-odd imported from ITT's extract, and anything created
 * before the fix - still have deal_score NULL, so every screen that reads it
 * (dashboard deal-score health, deal score analytics, commissions) shows
 * nothing.
 *
 * This scores quotes that do not already have one. It is idempotent and
 * safe to re-run; --all rescores everything, which is what to use after
 * changing the model or loading more history.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npm run score-quotes [-- --all] [-- --dry-run]
 */
import pg from 'pg';
import { calculateDealScore } from './dealScore.js';

const args = new Set(process.argv.slice(2));
const rescoreAll = args.has('--all');
const dryRun = args.has('--dry-run');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const { rows: quotes } = await client.query(
  `SELECT q.id, q.customer_id
     FROM quotes q
    WHERE ${rescoreAll ? 'TRUE' : 'q.deal_score IS NULL'}
    ORDER BY q.created_at`
);

console.log(`${quotes.length} quote(s) to score${dryRun ? ' (dry run)' : ''}.`);

let scored = 0;
const reasons = new Map();

for (const quote of quotes) {
  const { rows: lines } = await client.query(
    `SELECT product_id, unit_price, discount_applied
       FROM quote_lines WHERE quote_id = $1`,
    [quote.id]
  );

  const result = await calculateDealScore(
    client,
    quote.customer_id,
    lines.map((l) => ({
      product_id: l.product_id,
      unit_price: l.unit_price === null ? null : Number(l.unit_price),
      discount_applied: l.discount_applied === null ? null : Number(l.discount_applied),
    }))
  );

  if (result.score === null) {
    reasons.set(result.reason, (reasons.get(result.reason) || 0) + 1);
    continue;
  }

  scored += 1;
  if (!dryRun) {
    await client.query(
      `UPDATE quotes
          SET deal_score = $2,
              deal_score_details = $3,
              deal_score_calculated_at = now()
        WHERE id = $1`,
      [quote.id, result.score, JSON.stringify(result.details)]
    );
  }
}

console.log(`scored ${scored}, left unscored ${quotes.length - scored}.`);
for (const [reason, count] of [...reasons].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count.toString().padStart(5)}  ${reason}`);
}

await client.end();
