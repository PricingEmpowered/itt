/*
  # Quote lines keep what Channel Partners sent, and a target may sit below the floor

  ## 1. Source fields

  A quote built from a Channel Partners export has to carry some of that
  export's own values through to the quote and back out again.

  `source_item_id` is the one that matters most. Channel Partners keys every
  line on its ITEMID, and the returned price, the monthly win/loss file and the
  escalation file can only be matched to the line they describe if that key
  survives. It is stored per line because the export identifies lines, not
  requests.

  The rest record what the line was priced against: the product line and region
  the approval margin was looked up by, the currency the amounts are in, and
  the prices the requester asked for. The requested prices are kept apart from
  anything we calculate. They are what a distributor or its customer asked for,
  not ITT's selling price, and nothing here compares one with the other.

  ## 2. The band constraint was wrong

  `quote_lines_band_is_ordered` required floor <= target <= ceiling. That held
  while the floor was a minimum the target was raised to meet. The floor is now
  the margin below which an analyst needs approval, and the target is whatever
  comparable business achieved. Where that is lower, the target correctly sits
  under the floor, and the quote says it needs approval. The old constraint
  would have rejected such a line on save, which is the one case the screen
  exists to show.

  The remaining constraint is the one that is still true by construction: a
  ceiling is never below the target it is a stretch beyond.
*/

ALTER TABLE quote_lines
  ADD COLUMN IF NOT EXISTS source_item_id text,
  ADD COLUMN IF NOT EXISTS source_product_line text,
  ADD COLUMN IF NOT EXISTS source_region text,
  ADD COLUMN IF NOT EXISTS source_currency text,
  ADD COLUMN IF NOT EXISTS requested_resale_price numeric,
  ADD COLUMN IF NOT EXISTS requested_distributor_price numeric;

COMMENT ON COLUMN quote_lines.source_item_id IS
  'Channel Partners ITEMID for the line. Must be returned unchanged so results can be matched back.';
COMMENT ON COLUMN quote_lines.source_product_line IS
  'Product line as Channel Partners named it. The approval margin is looked up by this.';
COMMENT ON COLUMN quote_lines.source_region IS
  'Quoting region as Channel Partners named it, such as EMEA.';
COMMENT ON COLUMN quote_lines.source_currency IS
  'Currency code the amounts on this line are in, as the export stated it.';
COMMENT ON COLUMN quote_lines.requested_resale_price IS
  'Per-unit resale price asked for. Information only: not ITT''s selling price.';
COMMENT ON COLUMN quote_lines.requested_distributor_price IS
  'Per-unit distributor price asked for. Information only: not ITT''s selling price.';

/* Returned files are matched on this key. */
CREATE INDEX IF NOT EXISTS quote_lines_source_item_idx
  ON quote_lines (source_item_id)
  WHERE source_item_id IS NOT NULL;

ALTER TABLE quote_lines
  DROP CONSTRAINT IF EXISTS quote_lines_band_is_ordered;
ALTER TABLE quote_lines
  DROP CONSTRAINT IF EXISTS quote_lines_target_within_ceiling;
ALTER TABLE quote_lines
  ADD CONSTRAINT quote_lines_target_within_ceiling
    CHECK (target_price IS NULL OR ceiling_price IS NULL OR target_price <= ceiling_price);
