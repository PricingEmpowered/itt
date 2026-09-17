#!/usr/bin/env node
/*
 * On-premise migration runner for Price Space.
 *
 * Applies, in order:
 *   1. db/migrations/       - the on-prem bootstrap (roles, auth schema, shims)
 *   2. supabase/migrations/ - the 47 application schema migrations, minus the
 *                             demo-data seeds listed in DEMO_SEEDS
 *   3. db/post/             - privileges, which need the schema to exist first
 *   4. db/seed/ + DEMO_SEEDS - demo data, only with --with-demo-data
 *
 * Every file runs inside a transaction and is recorded in schema_migrations,
 * so the runner is safe to re-run and resumes where it left off.
 *
 * Usage:
 *   node db/migrate.mjs [--with-demo-data] [--dry-run]
 *   DATABASE_URL=postgres://user:pass@host:5432/pricespace node db/migrate.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/*
 * These files live in supabase/migrations but are demo data, not schema, and
 * a production install must not run them. They are listed in dependency
 * order: the quote history reads the products and customers the hierarchy
 * seed creates. db/seed/001_demo_prerequisites.sql supplies the price list
 * and auth.users row they also need.
 *
 * The first two are here because of what they do to a database that already
 * holds real data, not only because of what they add:
 *
 * - The hierarchy seed generates 100 products priced with `random() * 500`
 *   and 200 customers named "Customer Tier 2 Industrial 54". Worse, before
 *   generating them it round-robins arbitrary families onto every product
 *   with no family, and arbitrary regions and industries onto every customer
 *   missing either - so on an install carrying ITT's catalogue it would
 *   quietly assign invented hierarchy to real parts and real accounts.
 *
 * - The analytics seed writes twelve months of invented 2023 business
 *   performance: $1.85M-$2.4M of monthly revenue, 1,205-1,250 active
 *   customers, 72-76% win rates. Nothing derives those from the quotes
 *   table, so the entire Analytics screen reads them back as if they were
 *   findings. In a client's production database that is not sample data, it
 *   is a fabricated report.
 */
const DEMO_SEEDS = [
  '20251009161528_seed_hierarchy_data_v2.sql',
  '20251029142339_seed_analytics_data_v3.sql',
  '20251009175642_seed_historical_quote_data.sql',
  '20251009180011_add_more_historical_quotes_v2.sql',
  '20251009180038_comprehensive_historical_quotes.sql',
  '20251009180058_create_targeted_product_quotes.sql',
];

/*
 * Four features were migrated twice under near-identical filenames, so the
 * later file of each pair re-issues CREATE POLICY for policies that already
 * exist and aborts. Postgres has no CREATE POLICY IF NOT EXISTS, so make each
 * statement idempotent by dropping first. This is safe because a policy is
 * fully redefined by the statement that follows.
 */
function makePoliciesIdempotent(sql) {
  return sql.replace(
    /CREATE\s+POLICY\s+("(?:[^"]|"")+"|[A-Za-z_][\w$]*)\s+ON\s+((?:"[^"]+"|[A-Za-z_][\w$]*)(?:\.(?:"[^"]+"|[A-Za-z_][\w$]*))?)/gi,
    (match, name, table) => `DROP POLICY IF EXISTS ${name} ON ${table};\n${match}`
  );
}

function sqlFiles(dir) {
  try {
    return readdirSync(path.join(ROOT, dir))
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => ({ dir, file: f, key: `${dir}/${f}` }));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function plan({ withDemoData }) {
  const bootstrap = sqlFiles('db/migrations');
  const app = sqlFiles('supabase/migrations').filter((m) => !DEMO_SEEDS.includes(m.file));
  const post = sqlFiles('db/post');
  const steps = [...bootstrap, ...app, ...post];

  if (withDemoData) {
    steps.push(...sqlFiles('db/seed'));
    // Demo quote history runs last: it reads the products, customers and
    // price list established above.
    for (const file of DEMO_SEEDS) {
      steps.push({ dir: 'supabase/migrations', file, key: `supabase/migrations/${file}` });
    }
  }
  return steps;
}

async function main() {
  const withDemoData = process.argv.includes('--with-demo-data');
  const dryRun = process.argv.includes('--dry-run');
  const steps = plan({ withDemoData });

  // --dry-run only reports the plan, so it needs no database connection.
  if (dryRun) {
    console.log(`Would apply ${steps.length} file(s)${withDemoData ? ' including demo data' : ''}:`);
    steps.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s.key}`));
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required, e.g.');
    console.error('  DATABASE_URL=postgres://user:pass@localhost:5432/pricespace node db/migrate.mjs');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        key text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const { rows } = await client.query('SELECT key, checksum FROM schema_migrations');
    const applied = new Map(rows.map((r) => [r.key, r.checksum]));

    let ran = 0;
    let skipped = 0;

    for (const step of steps) {
      const raw = readFileSync(path.join(ROOT, step.dir, step.file), 'utf8');
      const checksum = createHash('sha256').update(raw).digest('hex');
      const seen = applied.get(step.key);

      if (seen) {
        if (seen !== checksum) {
          throw new Error(
            `${step.key} changed after it was applied (recorded ${seen.slice(0, 12)}, ` +
              `now ${checksum.slice(0, 12)}). Add a new migration instead of editing an applied one.`
          );
        }
        skipped++;
        continue;
      }

      const sql = makePoliciesIdempotent(raw);
      process.stdout.write(`applying ${step.key} ... `);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (key, checksum) VALUES ($1, $2)',
          [step.key, checksum]
        );
        await client.query('COMMIT');
        console.log('ok');
        ran++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.log('FAILED');
        console.error(`\n${step.key}: ${err.message}\n`);
        throw err;
      }
    }

    console.log(`\n${ran} applied, ${skipped} already up to date.`);
    if (!withDemoData) {
      console.log('Demo data was not applied. Re-run with --with-demo-data to load it.');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
