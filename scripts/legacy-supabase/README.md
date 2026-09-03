# Legacy Supabase scripts (not runnable)

These scripts seeded and synced data through the Supabase JS client. Supabase
has been removed from this deployment and the dependency uninstalled, so
**none of them run as-is**. They are kept because the data they produce is
still wanted and their logic is the specification for replacing them.

They lived in the repository root, which made them look like current tooling.

## What this costs today

The schema migrations already seed 100 products, 200 customers, price lists,
services, currencies and the analytics tables, and `npm run db:migrate:demo`
loads ~900 historical quotes. What these scripts additionally provided is
therefore missing:

| Script | Provides | Effect if not ported |
|---|---|---|
| `seed-commissions.ts` | `sales_commissions` rows | Commissions screen shows zero totals |
| `seed-approvals.ts`, `sync-approvals.ts` | Pending approval requests | Approval queue is empty |
| `seed-cost-alerts.ts` | `expected_cost_changes` | Price Alerts has nothing to act on |
| `seed-deal-scores.ts` | Deal score history | Deal Score Analytics has thin history |
| `seed-analytics.ts`, `sync-analytics-from-cpq.ts` | Analytics aggregates | Migrations already seed these tables |
| `create-regional-price-lists.ts` | Regional price lists | Only the demo `PL-2025-US` list exists |
| `check-quotes.ts` | Ad-hoc data check | None |

None of this blocks a production install, which starts from real data rather
than demo data.

## Porting one

Replace the Supabase client with a direct `pg` connection, as `db/migrate.mjs`
and `server/create-user.ts` do — connect with `DATABASE_URL`, use bound
parameters, and run as the owning role so RLS does not filter the seed.
Prefer adding the result to `db/seed/` as SQL where the data is static; keep a
script only where the values are computed.
