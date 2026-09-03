/**
 * Database access.
 *
 * Every application query runs through `asUser` (or `asAnonymous`), which
 * wraps it in a transaction that sets the request's identity before touching
 * any table:
 *
 *   SET LOCAL ROLE authenticated
 *   SET LOCAL app.current_user_id = '<uuid>'
 *
 * `auth.uid()` reads that setting, so the 138 row-level security policies
 * carried over from Supabase keep applying underneath the API.
 *
 * SET LOCAL (not SET) is essential: connections are pooled, and a plain SET
 * would persist onto whichever request borrowed the connection next, leaking
 * one user's identity into another's queries. SET LOCAL is scoped to the
 * transaction and reverts on COMMIT or ROLLBACK.
 */
import pg from 'pg';
import { ENV } from './env.js';

/**
 * Postgres returns numeric/decimal as strings by default to avoid precision
 * loss. This app's money and margin columns are numeric, and the frontend
 * does arithmetic on them, so parse them into numbers here. Values beyond
 * float precision would be a problem, but these are prices and percentages.
 */
const NUMERIC_OID = 1700;
pg.types.setTypeParser(NUMERIC_OID, (value) => (value === null ? null : Number(value)));

// int8 (bigint) comes back as a string too; counts are what we see it for.
const INT8_OID = 20;
pg.types.setTypeParser(INT8_OID, (value) => (value === null ? null : Number(value)));

export const pool = new pg.Pool({
  connectionString: ENV.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  // An idle client failing should not take the process down.
  console.error('[db] idle client error:', err.message);
});

export type Queryable = {
  query: <T extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    params?: unknown[]
  ) => Promise<pg.QueryResult<T>>;
};

/**
 * Run `fn` with the connection scoped to `userId` and the RLS-constrained
 * `authenticated` role. Commits if `fn` resolves, rolls back if it throws.
 */
export async function asUser<T>(
  userId: string,
  fn: (db: Queryable) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE authenticated');
    // Parameterised: set_config is used rather than string-interpolating the
    // uuid into a SET statement.
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The connection is already unusable; releasing it below discards it.
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Run `fn` with no user identity, as the `anon` role. Used only by the login
 * path, which must read `auth.users` before anyone is authenticated -- so it
 * deliberately runs as the owning role instead, see `asOwner`.
 */
export async function asAnonymous<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE anon');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* discarded on release */
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Run `fn` without switching roles, i.e. as the role in DATABASE_URL.
 *
 * Reserved for authentication itself: `auth.users` is revoked from
 * `authenticated` and `anon` because password hashes live there, so only the
 * login and account-management paths use this. Never expose it to a router
 * that handles arbitrary user input as a query.
 */
export async function asOwner<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
