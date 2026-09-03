# API server

Replaces Supabase for Price Space. One Node process serves the tRPC API and,
in production, the built frontend — so an on-premise install is a single
service on one port.

## Running it

```bash
cp .env.example .env          # then fill in DATABASE_URL and SESSION_SECRET
npm run db:migrate            # see db/README.md
npm run create-user -- you@example.com "Your Name"

npm run server                # API on :3000, reloads on change
npm run dev                   # frontend dev server, separate terminal
```

In production, build the frontend first so the server can serve it:

```bash
npm run build && npm run server:start
```

`GET /api/health` runs a real query, so it fails loudly on a bad
`DATABASE_URL` instead of letting every request fail later.

## How authorization works

There are two layers, and both matter.

The API is the outer one: `protectedProcedure` requires a valid session
cookie and an account that is still active, so deactivating a user takes
effect on their next request rather than at cookie expiry.

Row-level security is the inner one. `db.ts` runs every application query
inside a transaction that first sets the request's identity:

```sql
SET LOCAL ROLE authenticated;
SELECT set_config('app.current_user_id', $1, true);
```

`auth.uid()` reads that setting, so the RLS policies carried over from
Supabase keep applying underneath the API. **`SET LOCAL` rather than `SET` is
load-bearing** — connections are pooled, and a plain `SET` would persist onto
whichever request borrowed the connection next, leaking one user's identity
into another's queries.

Because of this the server must not connect as a superuser or as the table
owner; both bypass RLS. See `db/README.md` for the role to create.

`asOwner` deliberately skips the role switch and is used only by
authentication, because `auth.users` is revoked from `authenticated` —
password hashes live there. Do not reach for it elsewhere.

## Accounts

There is no self-service sign-up; ~10 named users are provisioned with
`npm run create-user`. Passwords are hashed with scrypt from Node's own
`crypto` module rather than bcrypt or argon2, both of which are native addons
needing a compiler at install time — a poor assumption for a client server
with no build toolchain. Cost parameters are stored per hash so they can be
raised later without invalidating existing passwords.

Sign-in returns the same message for an unknown email, a wrong password and a
deactivated account, and verifies against a dummy hash in those cases so
response time does not reveal which emails exist.

## Not done yet

- **Typed write endpoints.** Writes currently go through the allowlisted
  `data` router, which mirrors what the frontend had under Supabase but
  enforces no business rules. Quote submission, approvals and price-list
  changes deserve real procedures that validate state transitions.
- **`src/lib/dataClient.ts` is a compatibility layer.** It reproduces the
  PostgREST-shaped API the components were written against so they could move
  off Supabase without being rewritten. Call sites should migrate onto the
  feature routers (`trpc.quotes`, `trpc.reference`, `trpc.analytics`) over
  time, and this file should shrink.
- **Exchange rates are whatever is loaded.** `server/currencyRates.ts` reads
  the `exchange_rates` table; nothing fetches rates automatically, since an
  air-gapped server cannot. Rates need to be imported or entered.
- **Ask AI is off.** See `server/aiAnalytics.ts` for the two things that must
  be resolved before it can be enabled.
