/*
  # Fields for quotes imported from ECIW

  ITT's quote extract carries columns the schema has no home for, and leaves
  empty several the schema insists on. Both are addressed here.

  ## Relaxed NOT NULL constraints

  The extract is a price quotation, not an order, so some values genuinely do
  not exist on a line:

    - `quote_lines.unit_price` is absent on roughly half the sample rows
      (a quote raised but not yet priced).
    - `quote_lines.quantity` does not apply; the extract carries a minimum
      order quantity instead, which is a different thing and gets its own
      column below.
    - `quote_lines.line_total` cannot be derived without both of the above.
    - `quotes.price_list_id` has no counterpart in the extract at all.

  Leaving these NOT NULL would force the importer to invent zeros, which
  would then be indistinguishable from a real zero price and would silently
  skew every margin and discount average.

  ## Added columns

  Quote-level dates are distinct in the source and are worth keeping apart:
  `request_date` (when the customer asked), `quote_date` (when it was
  issued), `effective_date` and `expiration_date` (the validity window).

  `outcome` records won/lost. It is nullable and, in the sample provided, is
  NULL on every row — see db/import/README.md, since win rate and deal
  scoring depend on it.

  Source identifiers are kept alongside the resolved foreign keys so an
  imported row can always be traced back to the extract, and so rows whose
  part or customer could not be matched still record what they referred to.
*/

ALTER TABLE quotes ALTER COLUMN price_list_id DROP NOT NULL;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS quote_date date,
  ADD COLUMN IF NOT EXISTS request_date date,
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS expiration_date date,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS source_customer_name text,
  ADD COLUMN IF NOT EXISTS source_system text;

ALTER TABLE quote_lines ALTER COLUMN unit_price DROP NOT NULL;
ALTER TABLE quote_lines ALTER COLUMN line_total DROP NOT NULL;
ALTER TABLE quote_lines ALTER COLUMN quantity DROP NOT NULL;

ALTER TABLE quote_lines
  /* Cost booked against the line at quote time; margin is unavailable without it. */
  ADD COLUMN IF NOT EXISTS booked_cost numeric,
  /* Minimum order quantity the quoted price applies at. Not a quantity ordered. */
  ADD COLUMN IF NOT EXISTS min_qty integer,
  /* The part number exactly as it appeared in the extract. */
  ADD COLUMN IF NOT EXISTS source_part_number text;

CREATE INDEX IF NOT EXISTS idx_quotes_quote_date ON quotes (quote_date DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_outcome ON quotes (outcome) WHERE outcome IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quote_lines_source_part ON quote_lines (source_part_number);
