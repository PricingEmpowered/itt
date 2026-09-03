# Database (on-premise PostgreSQL)

Price Space was built against Supabase. It now targets a plain PostgreSQL 16
instance on the client's own server, so nothing here depends on Supabase being
reachable.

## Quick start

```bash
createdb pricespace
export DATABASE_URL=postgres://user:pass@localhost:5432/pricespace

npm run db:migrate              # schema only — use this for production
npm run db:migrate:demo         # schema + ~930 demo quotes, for demos/dev
npm run db:migrate -- --dry-run # print the plan, no connection needed
```

The runner records every applied file in `schema_migrations` and re-runs
safely: a second run applies nothing. It refuses to continue if a file that
was already applied has since been edited — add a new migration instead.

## What runs, in order

1. **`db/migrations/000_onprem_bootstrap.sql`** — the compatibility layer that
   makes the Supabase-era migrations work on stock PostgreSQL. It creates the
   `authenticated` / `anon` / `service_role` roles that the RLS policies
   target, the `auth` schema with a local `auth.users` table and an
   `auth.uid()` function, and a minimal `storage` shim.

2. **`supabase/migrations/*.sql`** — the 43 application schema migrations,
   applied unchanged. (The directory keeps its original name so the migration
   history stays traceable; it no longer implies a Supabase dependency.)

3. **`db/seed/` + the demo-quote seeds** — only with `--with-demo-data`.

## Design notes

**RLS is kept, not deleted.** The 43 migrations contain 200+ `CREATE POLICY`
statements which settle into 138 live policies across 54 tables once the
later consolidation migrations have run. Under Supabase these were the *only*
thing standing between a browser and the data. On-premise the API is the
security boundary, but the policies are retained as defense-in-depth: the API
sets `app.current_user_id` from the verified session cookie on each request,
which is what `auth.uid()` reads.

Consequently the application must **not** connect as a superuser or as the
table owner in normal operation — both bypass RLS. Create a dedicated
least-privilege role for the app and let it assume `authenticated`.

**Four files in `supabase/migrations` are demo data, not schema.** They insert
historical quotes and depend on a price list and an `auth.users` row that no
schema migration creates, which is why they fail on a clean database. The
runner holds them back unless `--with-demo-data` is passed, and
`db/seed/001_demo_prerequisites.sql` supplies what they need. A production
install starts with an empty quote history.

**Policy creation is made idempotent at apply time.** Four features were
migrated twice under near-identical filenames, so the later file of each pair
re-issues `CREATE POLICY` for a policy that already exists and aborts.
PostgreSQL has no `CREATE POLICY IF NOT EXISTS`, so the runner injects a
`DROP POLICY IF EXISTS` before each one. This is safe because the statement
that follows fully redefines the policy.

**Passwords.** `auth.users.encrypted_password` holds a scrypt hash written by
the API (Node's built-in scrypt, so there is no native addon to compile on the
client's server). The demo seed account cannot authenticate: its stored value is not
a valid hash and `is_active` is false.

## Security notes

**`execute_analytics_query` was removed.** It took arbitrary SQL as text and
ran it unvalidated under `SECURITY DEFINER`, so it executed as the table owner
and bypassed row-level security entirely, despite its own comment claiming the
opposite. The Supabase-era frontend called it straight from the browser with
interpolated strings. Confirmed against this schema: as `authenticated`,
`execute_analytics_query('SELECT count(*) FROM auth.users')` returned a count
from the password-hash table. `db/post/900_grants.sql` drops it. Revoking was
not enough -- PostgreSQL grants function EXECUTE to PUBLIC by default.

The four analytics call sites that used it (in `QuantityBreaksAnalytics.tsx`
and `QuantityBreaksDetailModal.tsx`) need typed API endpoints.

**Quote-line visibility was restored.** Migration `20251106014716` dropped the
policy that let users read lines of Approved/Rejected quotes, leaving them able
to see every quote header but only their own quotes' line items. That broke
price guidance, which exists to show pricing across the organisation.
`20260903120000_restore_price_guidance_quote_lines_policy.sql` re-creates it.
Verified both directions: finalised quotes' lines are readable by any signed-in
user, and a Draft quote belonging to someone else still returns no lines.

**Connect as a non-owner role.** Table owners and superusers bypass RLS. Run
migrations as the owning role, but have the application connect as a separate
least-privilege role. `db/app-role.sql` sets one up:

```bash
psql "$DATABASE_URL" -v app_password="'choose-a-real-one'" -f db/app-role.sql
```

That role is granted `authenticated` (which the API assumes per request via
`SET LOCAL ROLE`) plus `SELECT, UPDATE` on `auth.users`. The latter is
deliberate: the API verifies passwords itself, so the role it connects as has
to read the credential table. `authenticated` remains denied it, and every
application query runs as `authenticated` — only the login path, which never
switches role, can reach it.

## Known gaps

- The TypeScript seed scripts in the repo root (`seed-data.ts`,
  `seed-analytics.ts`, and the others) still use the Supabase JS client and
  have not been ported. The migrations already seed 100 products and 200
  customers, so they are not needed for a working install.
- `storage.buckets` / `storage.objects` exist only so the document-storage
  migration applies. Document bytes belong on the server filesystem, served
  by the API; only `pricing_documents` metadata lives in the database.
