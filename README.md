# Price Space

Pricing and quoting (CPQ) application for ITT: product catalog, quote
building with quantity breaks and rules-based pricing, a multi-level approval
workflow, deal scoring, commissions, and pricing analytics.

Built to run **on-premise** — one Node process and a PostgreSQL database on
the customer's own server, with no external services required at runtime.

## Requirements

- Node.js 20 or newer
- PostgreSQL 16 (verified against 16.13)
- No outbound internet access needed

## Install

```bash
npm install

# 1. Database
createdb pricespace
export DATABASE_URL=postgres://user:pass@localhost:5432/pricespace
npm run db:migrate                 # schema only
# npm run db:migrate:demo          # schema + ~900 demo quotes, for demos only
psql "$DATABASE_URL" -v app_password="'choose-a-real-one'" -f db/app-role.sql

# 2. Configuration
cp .env.example .env               # then fill in DATABASE_URL and SESSION_SECRET
#   openssl rand -base64 48        # to generate SESSION_SECRET

# 3. First account
ADMIN=true npm run create-user -- you@example.com "Your Name"

# 4. Run
npm run build                      # build the frontend
npm run server:start               # serves API and frontend on :3000
```

`GET /api/health` runs a real query, so a bad `DATABASE_URL` shows up there
rather than as a failure on every page.

### Development

Two processes: `npm run server` (API, reloads on change) and `npm run dev`
(frontend, proxies `/api` to the server).

### Database roles

Run migrations as the owning role, but point the **server** at a separate
least-privilege role — table owners and superusers bypass row-level security,
which would silently disable every policy the app relies on.

After `npm run db:migrate`, as the owner:

```bash
psql "$DATABASE_URL" -v app_password="'choose-a-real-one'" -f db/app-role.sql
```

Then set the server's `DATABASE_URL` to that role. Keep the owner connection
string for migrations and `create-user` only.

See [`db/README.md`](db/README.md) for the full picture.

## Accounts

There is no self-service sign-up. Accounts are provisioned with
`npm run create-user`, which creates both the login and the `user_profiles`
row that drives approval authority. `ADMIN=true` grants full authority;
`ROLE`, `APPROVAL_LEVEL`, `MAX_DISCOUNT`, `MAX_QUOTE_SIZE` and `MIN_MARGIN`
set individual fields. Passwords are hashed with scrypt from Node's own
crypto module, so there is no native addon to compile on the target server.

## What is not available offline

- **Ask AI** (natural-language analytics) needs a language model the server
  can reach. It is off, and the screen says so. See
  [`server/aiAnalytics.ts`](server/aiAnalytics.ts) for the two things that
  must be resolved before enabling it — a reachable model, and a safe way to
  execute generated SQL.
- **Exchange rates** are read from the `exchange_rates` table rather than
  fetched from a rates API. Load them by inserting `from_currency`,
  `to_currency`, `rate`, `date`.

Everything else — quoting, approvals, catalog, analytics, deal scoring,
commissions, reporting — runs with no outbound access.

## Layout

| Path | |
|---|---|
| `src/` | React frontend (Vite, TypeScript, Tailwind) |
| `server/` | Express + tRPC API, auth, documents — see [`server/README.md`](server/README.md) |
| `db/` | Migration runner, on-prem bootstrap, seeds — see [`db/README.md`](db/README.md) |
| `supabase/migrations/` | Application schema history (name is historical; no Supabase dependency) |
| `configurator/` | ITT Connectors Configurator, a separate app — see below |
| `scripts/legacy-supabase/` | Pre-migration seed scripts, no longer runnable |

## Commands

| | |
|---|---|
| `npm run dev` | Frontend dev server |
| `npm run server` | API with reload |
| `npm run build` | Build frontend |
| `npm run server:start` | Production: API + built frontend |
| `npm run db:migrate` | Apply schema migrations |
| `npm run db:migrate:demo` | Schema plus demo data |
| `npm run create-user` | Provision an account |
| `npm run typecheck` | Frontend and server |
| `npm run lint` | ESLint |

## The configurator

`configurator/` holds the ITT Connectors Product Configurator ("Smart Target
Pricing Engine"), a separate full-stack app built on Manus: React 19, tRPC,
Drizzle on MySQL, 29 tables and 24 pages. It is checked in so the work is
under version control and off that platform.

It is **not** wired into Price Space and is not part of this deployment. It
still depends on Manus platform services (OAuth identity, an LLM API, an S3
storage proxy, the Manus Vite runtime plugin). Its dependencies do install
cleanly outside Manus, so replacing those is the starting point if it is
taken forward.

## Historical documents

`DEMO_SCRIPT.md`, `README_DEMO.md`, `QUICK_START_DEMO.md`,
`DEMO_DATA_STATUS.md`, `ANALYTICS_INTEGRATION.md` and
`RULES_PRICING_INTEGRATION.md` were written while the app ran on Supabase.
Their walkthroughs are still broadly accurate, but any setup, environment or
data-loading instructions in them are superseded by this file. Row counts
quoted there reflect the old hosted database, not a fresh install.
