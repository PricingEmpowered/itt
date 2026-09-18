# Pre-aggregated analytics

Every figure on the Dashboard and the Analytics screen is read from a
materialised view, not computed from quote lines on demand. This note says
why, what the views contain, how they are refreshed, and which numbers
changed meaning when they were introduced.

## Why

Measured against a three-million-line database (810k quotes), under the same
row-level security the application runs with:

| Query | Direct from quote_lines | From the aggregates |
| --- | ---: | ---: |
| Dashboard KPI strip (`dashboard.overview`) | 3,706 ms | 2.0 ms |
| Price index chart (`dashboard.pricePerformance`) | 4,175 ms | 2.3 ms |
| Analytics monthly rollup | 1,164 ms | 1.9 ms |

The row-level security policy on `quote_lines` is an `EXISTS` against
`quotes`, evaluated per row. That is the right policy and it is not the
problem; scanning three million rows to answer a question whose answer
changes once a day is.

## What exists

`v_finalised_quote_lines` is the base. One row per quote line, with cost,
effective price and list price resolved, restricted to quotes with status
Approved, Rejected, Won or Lost.

Drafts and in-flight quotes are excluded because they are not evidence of a
price anyone agreed to — **not** as a privacy control. Every status the view
includes is readable line by line by any authenticated user under the
`quote_lines` SELECT policy, which is what makes the materialised views built
on it safe to read without RLS.

| View | Grain | Serves |
| --- | --- | --- |
| `mv_pricing_monthly` | month × family × region × channel | Dashboard strip, price index chart, Business Performance |
| `mv_product_monthly` | month × product | List Price Performance, Pareto |
| `mv_customer_monthly` | month × customer | Quote and customer counts |
| `mv_deal_score_monthly` | month | Deal score trend |

Four tables are rebuilt from those views in the same cycle:
`analytics_business_performance`, `analytics_price_performance`,
`analytics_price_waterfall`, `analytics_quote_funnel`.

## Counts that are not additive

`mv_pricing_monthly` is grouped by family, region and channel. A quote
touching four product families lands in four buckets, so **summing
`bucket_quotes` across buckets counts it four times**. This was a live defect:
the dashboard's quote count read 421,956 against a true 105,489.

The columns are named `bucket_quotes` and `bucket_customers` to make that
visible. They are correct for what they say — how many distinct quotes
touched this family this month — and wrong as a total.

For a total, use `mv_customer_monthly`. A quote has exactly one customer and
exactly one month, so `sum(quotes)` there is exact.

## Means that are not averages of averages

`avg_discount` and `avg_margin` on the dashboard are means of **per-line**
values. Averaging the bucket averages would give a bucket holding one line
the same weight as a bucket holding a thousand. `mv_pricing_monthly`
therefore carries `discount_sum`, `margin_pct_sum` and `margin_pct_lines`,
and the mean is recombined from those. Verified equal to the direct
computation to six decimal places.

The price index chart recombines `avg_price` and `avg_cost` by weight
(`priced_lines`, `costed_lines`), which are separate because a line can carry
a price without a cost.

## Refreshing

The API server runs the refresh itself, every `AGGREGATE_REFRESH_MINUTES`
(default 60). It is in-process rather than in cron or Windows Task Scheduler
because an on-premise install should be one service to configure, and a
scheduled task that never gets registered does not fail loudly — the
dashboard just quietly stops moving.

At boot the refresh runs only if the data is already stale, so restarting the
service during the day does not trigger a rebuild each time.

`REFRESH MATERIALIZED VIEW CONCURRENTLY` does not block readers. A refresh
running underneath someone looking at a chart is safe; they see the previous
values until it commits.

Full rebuild at three million lines: **26 seconds**.

To drive it from your own scheduler instead — typically as the last step of
the nightly ERP extract, when the data has actually changed:

```
AGGREGATE_REFRESH_MINUTES=0        # in the server's environment
npm run db:refresh-aggregates      # from your job, with DATABASE_URL set
```

The script exits non-zero on failure so a scheduler can alert on it.

Users can also rebuild on demand from the Analytics screen, which shows how
old the figures are and warns when they are later than the schedule expects.

## Numbers that changed meaning

Two deliberate changes came with this work. Both are in the direction of the
figures meaning what their labels say.

**Drafts no longer move company figures.** The dashboard strip and the price
index previously included draft quotes, so a rep opening a quote and typing a
price moved the company margin and price index on everyone's screen. They now
reflect finalised quotes only.

**The period is rounded to whole months** on the charts, because that is the
grain the views are built at. A 365-day window starts at the beginning of the
month 365 days ago rather than mid-month, which removes a partial first
bucket from an index chart rather than adding one. Reconciled month by month
against the direct computation: every full month matches to four decimal
places, and the first month differs by exactly the days the old window cut
off.

## "Win rate" is an approval rate

`analytics_business_performance.win_rate` and `get_dashboard_metrics`'
`win_rate_12m` are `approved / (approved + rejected)`. That is a decision made
inside ITT, not by the customer. Both are now labelled **Approval Rate** in
the interface.

Won and lost come from `quotes.outcome`, which no source extract populates.
The quote funnel leaves its win rate NULL and the screen shows "Not recorded"
rather than a number a sales manager would read as a win rate.

**Open question for ITT: where does quote outcome live?** Until that is
answered, nothing in this application knows whether a quote was won.

## The price waterfall shows only what the data supports

It previously rendered one hardcoded row — a $1,000,000 list price with
round-number discounts, dated December 2023, that nothing derived and nothing
refreshed. It is now derived from finalised quotes, which means it can only
show the layers that exist:

- **list price** — from the quote's own price list. Lines without one are
  excluded and counted, and the screen reports its own coverage.
- **volume discount** — the part of the line discount explained by an
  applicable quantity break, capped at the discount actually given.
- **other discount** — the unexplained remainder. Not necessarily
  promotional; it is what the break rule does not account for.
- **rebates, payment terms, freight** — not captured in any source extract.
  Stored NULL and rendered "not captured", because zero would assert there is
  no off-invoice leakage and nobody has made that claim.
- **pocket price** — equals invoice price while those three are unknown, and
  is labelled a ceiling rather than a measurement.

Contract attribution is not guessed. `spa_linked_lines` reports how many lines
could be tied to a special pricing agreement, which is zero until ITT's SPA
extract is loaded.

On the current pilot data the waterfall reports **0% coverage**: none of the
quoted parts appears on a price list, because the reference data loaded so far
is VEAM and the transactional data is IRNO. That is the correct answer, and
the screen says what to load to fix it.
