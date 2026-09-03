# ITT Connectors Configurator

Product configurator and pricing engine ("Smart Target Pricing Engine") for
ITT connectors: part-number building, quote workflow with three-tier price
recommendations, a five-level approval chain, bulk opportunity intake, and
pricing analytics.

React 19 + wouter + tRPC on the client, Express + tRPC + Drizzle on MySQL on
the server. 29 tables, 24 pages.

> This app is **not** part of the Price Space deployment and is not wired into
> it. It runs standalone.

## Requirements

- Node.js 20 or newer, pnpm 10
- MySQL 8

## Install

```bash
pnpm install

cp .env.example .env        # fill in DATABASE_URL and SESSION_SECRET
                            #   openssl rand -base64 48
pnpm db:push                # apply migrations

ADMIN=true pnpm create-user you@example.com "Your Name"

pnpm dev                    # development, on :3000
# pnpm build && pnpm start  # production
```

## Accounts

Sign-in is local: email and password, hashed with scrypt from Node's own
crypto module, held in a signed httpOnly session cookie.

There is no self-service sign-up. Accounts are provisioned with
`pnpm create-user`; `ADMIN=true` makes the account an admin, which is what the
`adminProcedure` routes (pricing rules, RFQ submissions) require. The password
comes from the `PASSWORD` environment variable, or is generated and printed:

```bash
PASSWORD='a-long-password' pnpm create-user sales@example.com "Sales User"
```

Migration `0014_local_user_accounts` moves the `users` table to this model. It
**clears existing rows** — accounts from before it have no password and cannot
be carried over, so re-provision them.

## No external services

The app makes no outbound calls at runtime. It needs only its MySQL database,
so it runs on an isolated network.

There is no telemetry, no analytics beacon, no external identity provider and
no remote file storage. Uploaded content is handled in-process; nothing is
proxied to a third party.

## Commands

| | |
|---|---|
| `pnpm dev` | Development server (API + client) |
| `pnpm build` | Build client and server |
| `pnpm start` | Run the production build |
| `pnpm db:push` | Generate and apply migrations |
| `pnpm create-user` | Provision an account |
| `pnpm check` | Typecheck |
| `pnpm test` | Vitest |
| `pnpm format` | Prettier |

## Layout

| Path | |
|---|---|
| `client/src/pages/` | 24 application pages |
| `client/src/_core/` | Auth hook |
| `server/routers.ts` | tRPC routers (93 procedures) |
| `server/db.ts` | Data access |
| `server/_core/` | Server plumbing: sessions, passwords, cookies, tRPC, Vite |
| `drizzle/` | Schema, migrations, snapshots |
| `todo.md` | Build history across 28 phases |
