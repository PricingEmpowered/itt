# Importing ITT data

## Quotes (ECIW extract)

```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/pricespace

node db/import/quotes.mjs quotes.tsv --dry-run   # parse and report, write nothing
node db/import/quotes.mjs quotes.tsv             # import
```

Accepts tab-separated (`.tsv`) or comma-separated (`.csv`) exports with these
columns:

`Quote #`, `Customer Name (ECIW)`, `Customer Number (Matching)`,
`Part Number`, `MinQty`, `Booked Cost`, `Unit Price`, `Effective Date`,
`Expiration Date`, `Request Date`, `Quote Date`, `Outcome`

The extract is one row per quote **line**, with the quote number repeated
across its lines; the importer groups them into one `quotes` row plus its
`quote_lines`. Re-running replaces a quote's lines wholesale, so it is safe to
run repeatedly.

By default it refuses to import when a part or customer is not already in the
database, rather than inventing catalogue entries. Load the masters first, or
pass `--create-placeholders` to stub the unmatched keys.

### How it maps

| Extract | Database |
|---|---|
| `Quote #` | `quotes.id` |
| `Customer Number (Matching)` | `quotes.customer_id` → `customers.id` |
| `Customer Name (ECIW)` | `quotes.source_customer_name` (kept verbatim for traceability) |
| `Quote / Request / Effective / Expiration Date` | matching `quotes.*_date` columns |
| `Outcome` | `quotes.outcome`, and drives `quotes.status` |
| `Part Number` | `quote_lines.product_id` → `products.id`, and `source_part_number` |
| `MinQty` | `quote_lines.min_qty` |
| `Booked Cost` | `quote_lines.booked_cost` |
| `Unit Price` | `quote_lines.unit_price` |

`MinQty` is deliberately **not** mapped to `quote_lines.quantity`: it is the
minimum order quantity the quoted price applies at, not a quantity ordered.

The literal string `NULL` in the extract is imported as SQL NULL, never as
zero — otherwise a missing price would be indistinguishable from a real zero
and would drag down every margin and discount average.

Dates are read as `M/D/YYYY`. Customer and part numbers are treated as text
throughout, so leading zeros (`0000071275`) survive.

## Data issues found in the sample

These need answers from ITT before a production load.

**1. `Outcome` is NULL on every row.** Win rate, the quote funnel and deal
scoring all depend on knowing whether a quote was won or lost. Without it,
those measures cannot be computed from this extract, and the dashboard's win
rate would be meaningless. Is outcome held in another system, or does it
arrive later once quotes close?

**2. One quote number spanned two customers.** In the sample, `SP675701` has
one line for AVNET EUROPE BV (`0000090993`) and four for MOUSER ELECTRONICS
(`0000071275`). Either `Quote #` is not unique per customer — a batch or
request identifier rather than a quote — or that row is an error. The importer
rejects such quotes and names them rather than picking a customer, because
attributing one distributor's pricing to another is worse than skipping it.

**3. Prices and costs are largely absent.** In the sample, `Unit Price` is
missing on 8 of 17 lines and `Booked Cost` on 16 of 17. Margin cannot be
computed without cost, so margin analytics will be sparse.

**4. No currency on the quote.** One line is a European distributor (AVNET
EUROPE BV) among North American ones, so quotes are presumably not all USD, but
the extract carries no currency column. Imported quotes leave `currency_id`
unset.

## Structure of the other files (`Compiled_Structure.xlsx`)

Not yet imported. What the file shows, and what blocks each:

| Sheet | Content | Status |
|---|---|---|
| Sales Data | Invoiced lines: order, invoice, customer, item, extended sell/cost, qty | Needs its own tables — these are invoices, not quotes |
| Order Data | Distributor point-of-sale: part, cost, value, qty | Same; `CombinedCustName` packs end customer, distributor, branch, rep, city, state and postcode into one colon-delimited string that needs parsing |
| Item Master | Part number, description, 4-level product family hierarchy | Importable; `Column1` and `item master` are spreadsheet lookup artifacts (`#N/A`) |
| Customer Master | site_name, customer no, name, industry classification, CorpMarket | See key mismatch below |
| Customer Master2 | customer no, name, region, state, sales person, industry, channel | Matches the quote extract's customer numbers |
| Parent | Customer no → corporate parent | Importable as a customer hierarchy |
| Quotes | — | In that workbook this sheet is a duplicate of `Parent`; the real format is the ECIW extract above |
| Price List Euro/NA × OE/Dist | Per-part price lists, 25 quantity-break slots | Importable; see below |

### Keys do not join across the files

- The two customer masters share **no** customer numbers. `Customer Master`
  uses `0010002740` / `0070000215`; `Customer Master2` uses `0000037414`. The
  quote extract uses the `Customer Master2` form, so that is the quote-side
  master — but `Sales Data` customer numbers (`0070000215`) match **neither**.
- Part numbers likewise do not join: `Item Master` uses `000000050`,
  `Sales Data` uses `067478-0004`, the price lists use `000-915640`, and the
  quote extract uses `MDM-37SSM5-A174`. The quote and price-list forms look
  like the same namespace (the price lists' `Description` column), while
  `Item Master.Part Number` looks like an internal numeric id.

A crosswalk between these identifiers is needed before sales history can be
tied to products or customers.

### Price lists

Four lists: Europe and North America, each OEM and Distribution. OEM sheets
carry resale prices in `QR1..QR25` / `R1..R25`; Distribution sheets carry cost
in `QC1..QC25` / `C1..C25`. Only 1–4 tiers are used in practice and the rest
are zero-padding, which must be ignored rather than loaded as zero-priced
breaks. `Class Code` is empty in all four. Currency is EUR for Europe and USD
for North America.
