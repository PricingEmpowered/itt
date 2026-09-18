/*
  # Stage A, part two: booking lines, SPA proposals and their tiers

  Continues 20260918100000_transaction_foundation.sql, which established the
  identity model and invoice lines. Split because the first part was already
  applied; the migration runner refuses an edited file, which is the behaviour
  you want from it.

  Same constraint as part one: ITT cannot share extracts, so this is modelled
  from column definitions and a handful of sample rows. Types stay permissive
  and the checking happens in the import diagnostics, where a failure can say
  something useful instead of aborting a load at 3am.
*/

-- ---------------------------------------------------------------------------
-- Booking lines (Booking Data)
-- ---------------------------------------------------------------------------

/*
 * Booking Data is the bridge. It is the only extract carrying both customer
 * keys and both part keys on the same row, so it is what links a quote
 * (raised against a bill-to) to the invoice that followed (cut against a
 * ship-to), and an internal part number to its catalog number.
 *
 * The sample rows carry Order Qty and Order Value of zero against a non-zero
 * Order Cost, one of them negative and one at 1.36e-12. Whether that is the
 * sample or the feed is unknown, so nothing here assumes a sign or a
 * relationship between the three; the diagnostics report on it instead.
 */
CREATE TABLE IF NOT EXISTS booking_lines (
  id                  bigserial PRIMARY KEY,
  booking_date        date,
  organization        text,
  region              text,
  /* Distribution / OEM etc. Spec 3.1 channel. */
  market_type         text,
  order_number        text,
  source_part_number  text,
  /* Booking's Item Description is the catalog number. */
  source_part_description text,
  product_id          text REFERENCES products(id) ON DELETE SET NULL,
  /* Spec 3.2 sub-family: 'D Sub', 'MIL-DTL 5015 Series I', 'Trinity MKJ'. */
  product_segment     text,
  key_account_name    text,
  bill_to_no          text,
  bill_to_name        text,
  customer_id         text REFERENCES customers(id) ON DELETE SET NULL,
  ship_to_no          text,
  ship_to_name        text,
  ship_to_site        text,
  salesman            text,
  /* Spec 2.4 excludes intercompany from peer statistics. */
  intercompany        boolean,
  order_qty           numeric,
  order_value_usd     numeric,
  order_cost_usd      numeric,
  excluded            boolean DEFAULT false,
  exclusion_reason    text,
  attributes          jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (order_number, source_part_number, booking_date)
);

CREATE INDEX IF NOT EXISTS idx_booking_lines_order ON booking_lines (order_number);
CREATE INDEX IF NOT EXISTS idx_booking_lines_date ON booking_lines (booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_booking_lines_product ON booking_lines (product_id);
CREATE INDEX IF NOT EXISTS idx_booking_lines_customer ON booking_lines (customer_id);
/* The bridge lookup: bill-to for a given ship-to, and the reverse. */
CREATE INDEX IF NOT EXISTS idx_booking_lines_bridge ON booking_lines (ship_to_no, bill_to_no);

-- ---------------------------------------------------------------------------
-- SPA proposals and items
-- ---------------------------------------------------------------------------

/*
 * ITT's quoting system, not a side dataset about special pricing. The source
 * views carry roughly 250 columns; what is modelled here is what the target
 * pricing specification actually reads, plus the identifiers needed to trace
 * a row back. Everything else lands in `attributes` rather than being
 * discarded, so a column that turns out to matter can be promoted without
 * reloading.
 */
CREATE TABLE IF NOT EXISTS spa_proposals (
  proposal_id       text PRIMARY KEY,
  proposal_name     text,
  quote_type        text,
  status            text,
  itt_site          text,
  region            text,
  quoting_region    text,
  sales_rep         text,
  /* Bill-to on the quote. May be a prospect rather than an ERP customer. */
  cust_id           text,
  customer_id       text REFERENCES customers(id) ON DELETE SET NULL,
  cust_name         text,
  cust_country_code text,
  cust_state_code   text,
  /* Spec 3.1 separates these three channel roles; the view carries all. */
  dist_name         text,
  cem_name          text,
  is_erp_customer   boolean,
  /* Spec 3.2 competitive exposure: 'Bid for Bid', 'Bid for Buy'. */
  opp_category      text,
  /* Spec 8.4 design win. */
  design_registration text,
  program_name      text,
  currency_code     text,
  exchange_rate_to_usd numeric,
  total_value       numeric,
  estimated_total_value numeric,
  requested_on      timestamptz,
  submitted_on      timestamptz,
  completed_on      timestamptz,
  requested_validity_date timestamptz,
  response_validity_date  timestamptz,
  order_number      text,
  is_deleted        boolean DEFAULT false,
  inactive          boolean DEFAULT false,
  excluded          boolean DEFAULT false,
  exclusion_reason  text,
  attributes        jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spa_proposals_customer ON spa_proposals (customer_id);
CREATE INDEX IF NOT EXISTS idx_spa_proposals_submitted ON spa_proposals (submitted_on DESC);
CREATE INDEX IF NOT EXISTS idx_spa_proposals_order ON spa_proposals (order_number);

CREATE TABLE IF NOT EXISTS spa_items (
  id                bigserial PRIMARY KEY,
  item_id           text,
  proposal_id       text REFERENCES spa_proposals(proposal_id) ON DELETE CASCADE,
  item_index        integer,
  /* PART_NO is the catalog number; PART_NO_MANUF is the internal one. */
  part_no           text,
  part_no_manuf     text,
  part_no_descr     text,
  part_no_customer  text,
  part_no_competitor text,
  /* ITT's own normalisation, kept verbatim rather than recomputed, because
     the price list and the SPA views disagree on it. */
  part_no_alpha_num text,
  product_id        text REFERENCES products(id) ON DELETE SET NULL,
  product_line      text,
  product_series    text,
  product_category  text,
  qty               numeric,
  qty_moq           numeric,
  pkg_qty           numeric,
  /* Verified against the sample: MARGIN_n reconciles to
     (price - cost_estimated) / price. BOOK_COST is a different basis - 402.39
     against a cost_estimated of 56.70 on one line - and is kept separate
     until ITT defines it. */
  cost_estimated    numeric,
  book_cost         numeric,
  disty_cost_given  numeric,
  price_given_oem   numeric,
  req_target_price_distr  numeric,
  req_target_price_resale numeric,
  itt_margin        numeric,
  distr_resale_margin numeric,
  total_line_value  numeric,
  currency_given    text,
  /* Spec 6.1 should-cost inputs. */
  eng_hours         numeric,
  eng_cycletime     numeric,
  qual_hours        numeric,
  qual_cycle_time   numeric,
  ship_debit_build_cost numeric,
  status            text,
  order_status      text,
  /* Spec 2.1 win/loss. */
  has_booked        boolean,
  number_of_time_booked integer,
  lost_reason       text,
  competitor_code   text,
  competitor_name   text,
  reject_reason     text,
  order_number      text,
  line_order_number text,
  is_deleted        boolean DEFAULT false,
  obsolete          boolean DEFAULT false,
  excluded          boolean DEFAULT false,
  exclusion_reason  text,
  attributes        jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (proposal_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_spa_items_proposal ON spa_items (proposal_id);
CREATE INDEX IF NOT EXISTS idx_spa_items_product ON spa_items (product_id);
CREATE INDEX IF NOT EXISTS idx_spa_items_order ON spa_items (order_number);
CREATE INDEX IF NOT EXISTS idx_spa_items_alpha ON spa_items (part_no_alpha_num);

/*
 * Six quantity-break slots per item, unpivoted. The source repeats
 * QTY_MOQ_1..6 / PRICE_GIVEN_OEM_1..6 / MARGIN_1..6 / DISCOUNT_1..6 across
 * columns; a tier per row is what every query downstream wants.
 *
 * DISCOUNT_n is the step down from the tier above, NOT a discount off list -
 * verified on the sample, where tier 3 states -11.8 against -11.84 from the
 * previous tier and -19.14 from tier 1. Named accordingly so nothing reads it
 * as a list discount.
 */
CREATE TABLE IF NOT EXISTS spa_item_tiers (
  id              bigserial PRIMARY KEY,
  spa_item_id     bigint REFERENCES spa_items(id) ON DELETE CASCADE,
  tier_index      integer NOT NULL,
  qty_moq         numeric,
  price_given_oem numeric,
  qty_release     numeric,
  total_value     numeric,
  margin_percent  numeric,
  step_from_previous_tier_percent numeric,
  UNIQUE (spa_item_id, tier_index)
);

COMMENT ON COLUMN spa_item_tiers.step_from_previous_tier_percent IS
  'Source DISCOUNT_n. The price step from the tier above, not a discount off list.';

CREATE INDEX IF NOT EXISTS idx_spa_item_tiers_item ON spa_item_tiers (spa_item_id);
