/*
  # Stage A: transaction foundation and identity model

  Section 2 of the target pricing specification computes every peer statistic
  on pocket price derived from invoice lines and distributor point-of-sale
  data. The schema had neither, which is why sections 3 through 8 could not be
  built. This adds them, and fixes two identity problems that would otherwise
  make the data unjoinable.

  ## Written without access to the data

  ITT cannot share extracts, so these tables are modelled from the column
  definitions and the handful of sample rows in db/import/samples. Types are
  deliberately permissive - text where a code vocabulary is unknown, numeric
  without precision where a unit is unconfirmed - because a constraint built on
  a guess rejects real rows at 3am. The checking happens in the import
  diagnostics instead, where a failure produces a message someone can act on
  rather than a transaction abort.

  Columns whose meaning is not yet settled carry a comment saying so.

  ## Identity, part one: a customer number means nothing on its own

  Booking Data carries `CustKey Billto` and `CustKey Shipto` on the same row,
  with different prefixes - PEI-GENESIS is 0000071354 as bill-to and
  0070000484 as ship-to. They are roles, not sites. Quotes are raised against
  a bill-to; invoices are cut against a ship-to. `customers.id` being a bare
  number cannot represent that, and would collide the moment a second site
  loads, because ship-to numbers are scoped by manufacturing site
  (Weinstadt 001, IRNO 007).

  So `customers` keeps its meaning as the commercial entity - the bill-to -
  and ship-to locations get their own table keyed by (site, number), linked to
  their bill-to where a booking row establishes it.

  ## Identity, part two: one product has many part numbers

  The same physical part appears as a catalog number (`CIR06F-20-3P-F80`), a
  site-scoped internal number (`000000110` at VEAM, `155521-3005` at IRNO), a
  customer part number, and a competitor part number. Each also has a
  normalised form, and ITT's own systems disagree on that normalisation: the
  SPA views keep the letter O in a `-VO` suffix while the price list writes
  `V0`.

  A single `products.id` cannot hold that, and picking one namespace loses the
  others. `product_part_numbers` carries them all, so an incoming row can be
  resolved by whichever identifier it happens to use, and the disagreement
  becomes visible rather than becoming silent non-matches.
*/

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customer_ship_to (
  /* Ship-to numbers repeat across sites, so neither column is a key alone. */
  site          text NOT NULL,
  ship_to_no    text NOT NULL,
  name          text,
  /* The bill-to this ship-to belongs to. Only Booking Data establishes it,
     so it stays null until a booking row is loaded. */
  customer_id   text REFERENCES customers(id) ON DELETE SET NULL,
  country_code  text,
  state_code    text,
  city          text,
  attributes    jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now(),
  PRIMARY KEY (site, ship_to_no)
);

COMMENT ON TABLE customer_ship_to IS
  'Ship-to locations, keyed by (site, number). Invoices are cut against these; quotes are raised against customers (bill-to).';

CREATE INDEX IF NOT EXISTS idx_customer_ship_to_customer ON customer_ship_to (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_ship_to_no ON customer_ship_to (ship_to_no);

CREATE TABLE IF NOT EXISTS product_part_numbers (
  id            bigserial PRIMARY KEY,
  product_id    text REFERENCES products(id) ON DELETE CASCADE,
  /* catalog | internal | customer | competitor | manufacturer */
  kind          text NOT NULL,
  /* Internal numbers are site-scoped; the rest are not. Null means global. */
  site          text,
  part_number   text NOT NULL,
  /* Uppercased with non-alphanumerics removed. Reproduces the SPA views'
     _ALPHA_NUM fields on every sample row; does NOT reproduce the price
     list's Stripped Description on -VO parts. That disagreement is reported
     by the diagnostics rather than resolved here. */
  normalised    text NOT NULL,
  /* Which extract this identifier came from, for tracing a bad match. */
  source        text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (kind, site, part_number)
);

COMMENT ON TABLE product_part_numbers IS
  'Every identifier a product is known by. Lets an incoming row resolve on whichever namespace it uses.';

CREATE INDEX IF NOT EXISTS idx_ppn_normalised ON product_part_numbers (normalised);
CREATE INDEX IF NOT EXISTS idx_ppn_product ON product_part_numbers (product_id);

-- ---------------------------------------------------------------------------
-- Invoice lines (Sales Data)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoice_lines (
  id                bigserial PRIMARY KEY,
  business_unit     text,
  order_no          text,
  invoice_number    text,
  invoice_date      date,
  /* Sales Data's Customer No is a ship-to. Kept as text plus a resolved
     reference, so an unresolved row is still loaded and still reportable. */
  ship_to_no        text,
  ship_to_site      text,
  customer_id       text REFERENCES customers(id) ON DELETE SET NULL,
  source_customer_name text,
  /* Sales Data carries the internal part number and no catalog number. */
  source_part_number   text,
  product_id        text REFERENCES products(id) ON DELETE SET NULL,
  customer_part     text,
  item_category     text,
  /* 'Invoice' in every sample row. Section 2.4 excludes returns and credit
     memos, and this is the column to exclude on. */
  billing_type      text,
  channel           text,
  qty_sold          numeric,
  uom               text,
  extended_sell     numeric,
  extended_cost     numeric,
  document_currency text,
  /* Set by the importer from the exclusion rules, with the reason. Rows are
     loaded and marked rather than dropped, so the exclusions are auditable. */
  excluded          boolean DEFAULT false,
  exclusion_reason  text,
  attributes        jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (invoice_number, order_no, source_part_number, invoice_date)
);

COMMENT ON COLUMN invoice_lines.extended_cost IS
  'Extended, not per unit - confirmed by the sample, where dividing by Qty Sold gives unit costs consistent with quoted margins.';

CREATE INDEX IF NOT EXISTS idx_invoice_lines_date ON invoice_lines (invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_product ON invoice_lines (product_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_customer ON invoice_lines (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_order ON invoice_lines (order_no);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_live ON invoice_lines (invoice_date DESC) WHERE NOT excluded;
