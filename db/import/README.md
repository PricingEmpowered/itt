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

> **Superseded in part.** This section describes how the first import was
> built. Two later findings change it and are recorded below under *Identifier
> namespaces across the extracts* and *The extracts cover two different
> business units*. Read those before relying on this.

Two kinds of identifier appear across the files:

| Identifier | Format | Appears in |
|---|---|---|
| Manufacturer (catalog) part number | `CIR06F-20-3P-F80` | Item Master (`Part Description`), price lists (`Description`), quote extract (`Part Number`), Booking (`Item Description`) |
| Internal part number, scoped to a site | `000000110` (VEAM), `155521-3005` (IRNO) | Item Master (`Part Number`), price lists (`Global Manufacturing Part Number`), Booking (`Item Number`), Sales Data (`item_number`) |

`products.id` is the **manufacturer** part number. The internal number is kept
in `attributes.global_part_number`.

What this section originally claimed, and where it was wrong:

- It treated `067478-0004` as a third, unmatched format. It is not a separate
  kind of identifier — it is the internal part number as IRNO writes it, and
  Booking Data pairs it with a catalog number in the same row.
- It implied the quote extract and the price lists share parts because both
  carry catalog numbers. They carry the same *kind* of identifier but describe
  different business units, so in practice they do not overlap.

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

Booking Data resolves what the Sales Data sample alone made look like a
namespace incompatibility. It is the only extract that carries both customer
keys and both part keys in the same row, so it is the bridge between every
other file.

### Customer numbers are roles, not sites

| Role | Prefix | Carried by |
|---|---|---|
| Bill-to | `000` | Booking `CustKey Billto`, Customer Master2, the quote extract |
| Ship-to | `007` (IRNO), `001` (Weinstadt) | Booking `CustKey Shipto`, Sales Data, the site-scoped Customer Master |

One booking row shows both at once: PEI-GENESIS is `0000071354` as bill-to and
`0070000484` as ship-to. Same company, two keys, two roles. The site prefix on
the ship-to side is the manufacturing site, which is why the Customer Master
splits Weinstadt (`001`) from IRNO (`007`).

Quotes are raised against a bill-to; invoices are cut against a ship-to.
**Booking Data is therefore the only way to link a quote to the invoice that
resulted from it**, which section 9.5 of the target pricing specification needs
for win rate by band position.

A customer key is `(role, number)` and a ship-to key is `(site, number)`.
`customers.id` is currently the bare number, which cannot represent either.

### Part numbers: every site has its own internal key, the catalog number is the common language

| Extract | Internal key | Catalog part number | Site |
|---|---|---|---|
| Item master | `Part Number` 9 digits, e.g. `000001750` | `Part Description`, e.g. `VBN-PG16BL20T39` | VEAM |
| Price lists | `000-915640` | `Description`, e.g. `46179-201T12` | VEAM |
| Booking Data | `Item Number` e.g. `155521-3005` | `Item Description`, e.g. `MKJ1A1T6-7SA` | IRNO |
| Sales Data | `item_number` e.g. `067478-0004` | not carried | IRNO |
| Quote extract | not carried | `Part Number`, e.g. `MDM-37SSM5-A174` | IRNO |

The catalog part number joins across extracts. The numeric keys do not, because
they are per-site.

## The extracts cover two different business units

This is the finding that matters most, and it corrects an earlier conclusion
recorded here.

| Extract | Business unit | Evidence |
|---|---|---|
| Item master | **VEAM** | Families are `VEAM Other`, `VEAM VBN`, `VEAM CIR/FRCIR` |
| Price lists | **VEAM** | Series `Circular`, descriptions `CIR06F-20-3P-F80`, `46179-201T12` |
| Quote extract | **IRNO** | `MDM-37SSM5-A174`, `MM38999-12S-20188` are Cannon micro-D and 38999 parts |
| Sales Data | **IRNO** | `Business Unit` column |
| Booking Data | **IRNO** | `Organization L2` column; segments `D Sub`, `MIL-DTL 5015 Series I`, `Trinity MKJ` |

So the reference data loaded so far (item master, price lists) describes VEAM,
while every transactional extract describes IRNO. They were never going to
join.

**This is the real reason no quoted product appears on a price list.** That was
previously recorded as the extracts not overlapping on part numbers, which
described the symptom rather than the cause. Net price realization is
uncomputable today not because of identifier formats but because there is no
IRNO price list and no IRNO item master.

What is needed to close it: an **IRNO item master** (catalog part number,
internal number, family hierarchy) and **IRNO price lists**. Alternatively, a
decision that the project is VEAM-scoped, in which case VEAM transactions are
needed instead.

## SPA proposals: ITT's quoting system

`proposals.SPA_PROPOSALS` and `proposals.vw_SPA_PROPOSALS_ITEMS` arrived as
column listings, not data. Everything below is read off the schema, so nothing
is verified: population rates, code vocabularies and join behaviour are all
unknown until rows are supplied. Full listing in
`samples/schemas/spa-proposals-columns.txt`.

This is not a side dataset about special pricing. It is a quoting system, with
validity periods, a multi-stage approval workflow through engineering,
qualification and QA, competitor capture and win/loss. It answers more of the
target pricing specification than everything else supplied put together.

### What it unblocks

| Spec requirement | Columns |
|---|---|
| §2.1 quotes won and lost, loss reason, competitor | `LOST_REASON_DESCR`, `COMMENTS_LOST`, `COMPETITOR_CODE/_DESCR`, `PART_NO_COMPETITOR`, `HAS_BOOKED`, `NUMBER_OF_TIME_BOOKED` |
| §2.2 ship-and-debit matched by SPA id | `PROPOSALID` is that id; `SHIP_DEBIT_BUILD_COST`, `DISTY_COST_GIVEN` |
| §3.1 channel | `CUST_NAME`, `CEM_NAME` (contract manufacturer) and `DIST_NAME` in one row — the three channel roles the spec separates |
| §3.1 end market | `OPP_CATEGORIES_CODE/_DESCR`, plus `Industry/Type` on the bill-to master |
| §3.2 family and sub-family | `PRODUCT_LINE`, `PRODUCT_SERIES`, `PRODUCT_CATEGORY`, `INTERNAL_PRODUCT_LINE` |
| §4.5 SPA net to distributor | `REQ_TARGET_PRICE_DISTR`, `REQ_TARGET_PRICE_RESALE`, `DISTY_COST_GIVEN`, `DISTR_RESALE_MARGIN` |
| §5.5 MOQ and small lot | `QTY_MOQ`, `QTY_MOQ_RESPONSE`, `PKG_QTY` |
| §6.1 should-cost | `ENG_HOURS`, `ENG_CYCLETIME`, `QUAL_HOURS`, `QUAL_CYCLE_TIME`, `COST_MAKE_UP`, `COST_ESTIMATED`, `BOOK_COST` |
| §6.3 program life | `PROGRAM_NAME` |
| §8.4 design win | `OPP_DESIGN_REGISTRATION` |
| §9.1 approval routing | `STATUS_CODE`, `ENG_APPROVAL_STATUS`, `QUAL_APPROVAL_STATUS`, `QA_APPROVAL_STATUS`, `REJECT_REASON_CODE`, and reroute/reopen comment trails |
| §2.3 currency | `EXCHANGE_RATE_TO_USD`, `CURRENCY_TARGET`, `CURRENCY_GIVEN`, `OFFER_CUR_CODE` |
| §2.4 exclusions | `IS_DELETED`, `INACTIVE`, `OBSOLETE`, `REJECT` and their item-level twins |
| Quantity breaks | Six slots: `QTY_MOQ_1..6`, `PRICE_GIVEN_OEM_1..6`, `QTY_RELEASE_1..6`, `TOTAL_VALUE_1..6`, `MARGIN_1..6`, `DISCOUNT_1..6` |

`ITT_MARGIN` and `DISTR_RESALE_MARGIN` mean ITT already computes margin on a
quoted line. Worth comparing against margin derived from `BOOK_COST` before
deciding which to trust.

### Two columns that change the plan

**`PART_NO_ALPHA_NUM`.** Every part number field has an `_ALPHA_NUM` twin —
`PART_NO`, `PART_NO_MANUF`, `PART_NO_CUSTOMER`, `PART_NO_COMPETITOR` and
`PART_NO_DESCR` all do. ITT already stores a normalized form of each part
number for matching. **That is the answer to the part-number join problem, and
it should be reused rather than reinvented** — whatever normalization they
apply is the one their own systems already agree on. Ask for the rule, or
derive it from a sample carrying both forms.

**`ORDER_NUMBER` and `LINE_ORDER_NUMBER`.** These link an SPA line to an order,
and Booking Data carries `Order Number` while Sales Data carries `Order No`.
That completes the chain the specification needs end to end:

```
SPA proposal  ->  order  ->  booking  ->  invoice
quoted price      committed             invoiced price and cost
```

With it, win rate by band position (§9.5) and realization against what was
actually quoted both become computable. Nothing else supplied connects a quote
to its invoice.

### Still missing after this

- **Commodity indices and metal content per part.** Nothing in any extract.
  §2.3's commodity restatement and §5.2's plating adders both need them.
- **Rebates and allowances.** `UNIT_DISCOUNT` and `TOTAL_DISCOUNT` are
  quote-time discounts, not accrued rebate programmes. §2.2's pocket price
  needs the latter.
- **IRNO item master and IRNO price lists.** Unchanged, and still the largest
  gap.

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
