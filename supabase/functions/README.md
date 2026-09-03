# Supabase Edge Functions (no longer deployed)

These two Deno functions ran on Supabase. This deployment is on-premise with
no Supabase project, so neither is deployed. They are kept as reference for
the logic they contained, not as live code.

## currency-rates

Fetched live rates from `api.frankfurter.dev` on every call. An air-gapped
server cannot reach it, so exchange rates are now served from the
`exchange_rates` table by `server/currencyRates.ts` — whatever the
organisation has loaded is what the app uses. The response shape is
unchanged, so the frontend call sites only changed URL.

To populate rates, insert into `exchange_rates` (`from_currency`,
`to_currency`, `rate`, `date`). On an install that does have outbound
access, this function's logic is the reference for a scheduled import.

## ai-analytics

Took a question, asked an LLM to write SQL, and executed the result through
`execute_analytics_query` — a SECURITY DEFINER function that bypassed
row-level security and has since been dropped as a privilege-escalation
path.

Replacing it needs two things, both outstanding: a language model the server
can reach (absent on an air-gapped install), and a safe way to run generated
SQL — as the requesting user, read-only, with a statement timeout, rather
than as the table owner. `server/aiAnalytics.ts` returns a structured
"unavailable" response until then, and the UI explains it. `schema-catalog.ts`
here is still the useful part: the table/column descriptions given to the
model as context.
