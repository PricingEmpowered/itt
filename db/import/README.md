# Importing ITT data

```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/pricespace

node db/import/item-master.mjs  item-master.tsv
node db/import/price-lists.mjs  pricelist-euro-oe.tsv     # once per list
node db/import/customers.mjs    customer-master.tsv --parents customer-parent.tsv
node db/import/quotes.mjs       quotes.tsv
```

Every importer takes `--dry-run`, which parses, validates and reports without
writing. Run the item master and price lists before quotes, so quote lines
resolve to real products instead of placeholders.

## Part number namespaces

Three identifiers appear across the files, and knowing which is which is what
makes the imports join up:

| Identifier | Format | Appears in |
|---|---|---|
| Manufacturer part number | `CIR06F-20-3P-F80` | Item Master (`Part Description`), price lists (`Description`), **quote extract** (`Part Number`) |
| Internal global part number | `000000110` | Item Master (`Part Number`), price lists (`Global Manufacturing Part Number`) |
| Unmatched | `067478-0004` | Sales Data only |

`products.id` is therefore the **manufacturer** part number — the one quotes
and price lists share. The internal number is kept in
`attributes.global_part_number`, which is what ties a product back to the item
master.

Sales Data's item numbers are in a third format that matches neither, so sales
history still cannot be tied to products. That one remains open with ITT.

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

## Identifier namespaces across the extracts

Samples of Sales Data and the site-scoped Customer Master arrived after the
first import was built, and they do not share identifiers with what is already
loaded. This is the single largest open question on the data.

**Customer numbers are scoped to a site, not global.** The site file makes the
pattern explicit:

| Source | `site_name` / Business Unit | Prefix | Example |
|---|---|---|---|
| Customer Master | Weinstadt | `001` | `0010002740` |
| Customer Master | IRNO | `007` | `0070931526` |
| Sales Data | IRNO | `007` | `0070000215` |
| Customer Master2 | — (not carried) | `000` | `0000037414` |
| Quote extract | — (not carried) | `000` | `0000071275` |

So Sales Data joins to the IRNO rows of the Customer Master, and the quote
extract joins to Customer Master2 — which it already does; that import works.
What is unresolved is whether `000` is a third site or a second numbering of
the same customers. **If ITT's quoting system numbers customers differently
from its invoicing system, quotes and invoices cannot be linked at all**, which
removes win rate by band position and every quote-to-invoice measure.

The practical consequence for the schema: a customer key is
`(site, customer_no)`, not `customer_no`. `customers.id` is currently the bare
number and would collide the moment a second site is loaded.

**Part numbers show three shapes.** Nine digits is one namespace; Sales Data is
not in it.

| Source | Shape | Example |
|---|---|---|
| Item master | 9 digits | `000000050` |
| Price lists | 9 digits (one row dashed) | `000000110`, `000-915640` |
| Sales Data | 6 digits + dash + 4 | `067478-0004` |
| Quote extract | alphanumeric | `MDM-37SSM5-A174` |

Ten digits do not become nine by trimming or padding, so these are different
identifiers rather than different formatting. The likely explanation is that
Sales Data carries base-plus-dash (`067478` + variant `0004`) while the master
carries a flat key, but that is a guess and needs confirming rather than
assuming — an earlier reading of these files called a join wrong in the other
direction, and the sample row sets are disjoint, so overlap counts prove
nothing either way.

Until this is settled, invoice lines cannot be joined to list price, which is
what section 4 of the target pricing specification computes realization from.

## Data issues found in the Sales Data sample

**Zero-price lines are real and destroy averages.** One of four sample rows is
a `Rework Item` billed at $0.009 against $9,477 of cost — a no-charge rework.
Its line margin is -105,299,900%. The target pricing specification already
calls for excluding zero-price lines, returns and credit memos (section 2.4);
this row is why that rule is not optional. `Billing Type` is the column to
exclude on, and only the value `Invoice` appears so far.

**Distribution shows higher margin than OEM in the sample.** 74.9% and 84.3%
against 65.6%. Three rows prove nothing, but it is worth establishing whether
`Extended Sell` to a distributor is what ITT invoices the distributor or the
distributor's resale, because the two give opposite readings of channel
profitability.

**Fields the specification needs and Sales Data does not carry:** ship-to,
order type beyond `Item Category` (Standard / Rework), SPA identifier and
debit amount. Without the last two, ship-and-debit cannot be matched to POS
and pocket price stops at invoice price.

**Formatting:** `customer_group_description` is space-padded to a fixed width
and needs trimming. `Extended Cost` carries three decimals on some rows and
none on others. Dates are `M/D/YYYY`, as in the quote extract.

## Structure of the other files (`Compiled_Structure.xlsx`)

Not yet imported. What the file shows, and what blocks each:

| Sheet | Content | Status |
|---|---|---|
| Sales Data | Invoiced lines: order, invoice, customer, item, extended sell/cost, qty | Needs its own tables — these are invoices, not quotes |
| Order Data | Distributor point-of-sale: part, cost, value, qty | Same; `CombinedCustName` packs end customer, distributor, branch, rep, city, state and postcode into one colon-delimited string that needs parsing |
| Item Master | Part number, description, 4-level product family hierarchy | **Imported** by `item-master.mjs`; `Column1` and `item master` are spreadsheet lookup artifacts (`#N/A`) |
| Customer Master | site_name, customer no, name, industry classification, CorpMarket | See key mismatch below |
| Customer Master2 | customer no, name, region, state, sales person, industry, channel | **Imported** by `customers.mjs`; matches the quote extract's customer numbers |
| Parent | Customer no → corporate parent | **Imported** by `customers.mjs --parents` |
| Quotes | — | In that workbook this sheet is a duplicate of `Parent`; the real format is the ECIW extract above |
| Price List Euro/NA × OE/Dist | Per-part price lists, 25 quantity-break slots | **Imported** by `price-lists.mjs`; see below |

### What still does not join

Part numbers do join, via the two namespaces described above — an earlier
reading of these files concluded they did not, which was wrong: the sample
sheets hold disjoint sets of rows, not incompatible identifiers.

What genuinely does not join:

- **Sales Data item numbers** (`067478-0004`) match neither the manufacturer
  nor the internal part number format.
- **Sales Data customer numbers** (`0070000215`) match neither customer
  master. `Customer Master` uses `0010002740` / `0070000215`;
  `Customer Master2` uses `0000037414`, which is the form the quote extract
  uses and the one `customers.mjs` loads.

So sales and order history cannot yet be tied to products or customers.

### Price lists

Four lists: Europe and North America, each OEM and Distribution. OEM sheets
carry resale prices in `QR1..QR25` / `R1..R25`; Distribution sheets carry cost
in `QC1..QC25` / `C1..C25`. Only 1–4 tiers are used in practice and the rest
are zero-padding, which must be ignored rather than loaded as zero-priced
breaks. `Class Code` is empty in all four. Currency is EUR for Europe and USD
for North America.

## Notes on the imports

**Quantity-break padding.** Each price-list row has 25 tier slots; one to four
are used and the rest are zero-filled. A zero quantity means "unused slot",
not a break starting at zero, so the padding is discarded. Loading it would
give every part dozens of zero-priced breaks and every quote would price at
zero. Break boundaries are derived so each tier runs until the next begins,
with the last left open-ended.

**No cost basis.** A Distribution list's "cost" is what the distributor pays —
ITT's revenue, not ITT's cost — so it loads as a price list and deliberately
does not populate `products.base_cost`. Combined with `Booked Cost` being
absent from nearly every quote line, there is currently no reliable cost basis
in any extract, so margin figures cannot be computed from this data.

**Multi-site customers.** A customer number can repeat, once per site, with
different state, sales person and industry. Those collapse to one customer row
and the extra sites are kept in `attributes.sites` rather than overwriting each
other.

**Family hierarchy.** Item Master's Product Family Level 1 is an internal
coding string (`VO   VOCO VOCO10 5`); levels 2–4 are readable names. The
hierarchy is built from levels 2 down, and level 1 is kept as an attribute.
