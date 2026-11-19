/*
  # Quote lines carry configured parts, price bands and their rationale

  The pilot flow is: a user uploads the Channel Partners quote form, the whole
  quote prices at once, and every line comes back with a floor, a target, a
  ceiling and the reasoning behind each. The user then adjusts and exports.

  Three things in this table stopped that.

  ## 1. A configured part could not be stored at all

  `product_id` was NOT NULL with a foreign key to `products`. Configured
  products do not exist in the item master - that is what makes them
  configured - so the central case of the pilot could not be saved. Any
  upload containing one would fail on insert.

  `product_id` becomes nullable and a check requires a line to identify its
  part one way or the other: a catalogue product, or a source part number.
  The foreign key stays for catalogue lines. The alternative - inventing a
  `products` row per configured part - would put ad-hoc parts into what is
  meant to mirror ITT's item master, and the item master is their system of
  record, not ours to write to.

  ## 2. There was nowhere to put a band

  Price Space had no floor, target or ceiling anywhere in it. (The band logic
  in `configurator/` belongs to the separate configurator application and does
  not reach this schema.) The three are stored rather than recomputed on
  render because the user adjusts a price against the band they were shown,
  and the export has to carry what they saw. A band recomputed later - after a
  cost change or a rule edit - would not be that band.

  `ceiling_price` is nullable on purpose. A ceiling is derived from comparable
  history, and where there is not enough history there is no ceiling. Offering
  an invented one on a pilot that quotes to customers is worse than offering
  none, so the column records the absence rather than hiding it.

  ## 3. Rationale had nowhere to live

  "Why this number" is part of the deliverable, not a tooltip. It is stored as
  jsonb so the screen and the export render the same structure, and so a line
  priced in March can still explain itself in June when the rules have moved on.
*/

ALTER TABLE quote_lines
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE quote_lines
  /* Typed by the user for configured parts. Reporting only: it produces the
     discount-off-list figure and never moves floor, target or ceiling. */
  ADD COLUMN IF NOT EXISTS entered_list_price numeric,
  /* cost / (1 - minimum_margin). The walk-away. */
  ADD COLUMN IF NOT EXISTS floor_price numeric,
  /* Cost-plus at the configured rate, floored. What the desk should ask. */
  ADD COLUMN IF NOT EXISTS target_price numeric,
  /* Upper quartile of comparable won lines. Null where history is too thin. */
  ADD COLUMN IF NOT EXISTS ceiling_price numeric,
  /* Structured steps: label, value, basis, detail. Rendered by screen and export. */
  ADD COLUMN IF NOT EXISTS pricing_rationale jsonb,
  /* When the band above was computed. Bands go stale when cost or rules move. */
  ADD COLUMN IF NOT EXISTS priced_at timestamptz,
  /* Set when the user moves off the target. Free text, captured at export. */
  ADD COLUMN IF NOT EXISTS override_reason text;

/*
 * A line has to say what it is. Catalogue lines carry product_id; configured
 * lines carry the part number as it appeared in the uploaded form. Without
 * this check, dropping NOT NULL above would allow a line identifying nothing.
 */
ALTER TABLE quote_lines
  DROP CONSTRAINT IF EXISTS quote_lines_identifies_a_part;
ALTER TABLE quote_lines
  ADD CONSTRAINT quote_lines_identifies_a_part
    CHECK (product_id IS NOT NULL OR source_part_number IS NOT NULL);

/*
 * The band has to be a band. These are cheap to enforce and catch a whole
 * class of calculator defect at the point of write rather than on a quote.
 * Each comparison skips when either side is null, so a partial band - a floor
 * and target with no ceiling - is allowed, which is the common case.
 */
ALTER TABLE quote_lines
  DROP CONSTRAINT IF EXISTS quote_lines_band_is_ordered;
ALTER TABLE quote_lines
  ADD CONSTRAINT quote_lines_band_is_ordered
    CHECK (
      (floor_price IS NULL OR target_price IS NULL OR floor_price <= target_price)
      AND
      (target_price IS NULL OR ceiling_price IS NULL OR target_price <= ceiling_price)
    );

/* The queue and the export both read unpriced lines first. */
CREATE INDEX IF NOT EXISTS quote_lines_unpriced_idx
  ON quote_lines (quote_id)
  WHERE target_price IS NULL;

COMMENT ON COLUMN quote_lines.entered_list_price IS
  'List price typed by the user for a configured part. Reporting only - produces discount off list, never affects the band.';
COMMENT ON COLUMN quote_lines.ceiling_price IS
  'Upper quartile of comparable won lines. Null means insufficient comparable history, not an unlimited ceiling.';
COMMENT ON COLUMN quote_lines.pricing_rationale IS
  'Ordered rationale steps as stored at pricing time: [{label, value, basis, detail}]. Not recomputed on read.';
