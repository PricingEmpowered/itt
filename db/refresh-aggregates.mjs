#!/usr/bin/env node
/**
 * Rebuild the pre-aggregated analytics from the command line.
 *
 * The server does this on a schedule of its own, so this script is for the
 * install that turns that off (AGGREGATE_REFRESH_MINUTES=0) and would rather
 * trigger the rebuild from its own job - typically as the last step of the
 * nightly ERP extract, when the data has actually changed.
 *
 * Exits non-zero on failure so a scheduler can alert on it.
 */
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
const started = Date.now();

try {
  await client.connect();
  const { rows } = await client.query('SELECT * FROM refresh_pricing_aggregates()');

  const width = Math.max(...rows.map((r) => r.view_name.length));
  let total = 0;
  for (const row of rows) {
    total += Number(row.rows_written);
    console.log(
      `${row.view_name.padEnd(width)}  ${String(row.rows_written).padStart(9)} rows  ${String(row.duration_ms).padStart(6)} ms`
    );
  }
  console.log(`\n${total.toLocaleString()} rows in ${Date.now() - started} ms.`);
} catch (err) {
  console.error('Refresh failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
