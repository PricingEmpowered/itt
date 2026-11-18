/*
  # The pricing basis is margin on price

  The previous migration (20260918110000) made the basis an explicit column
  and recorded every existing rule set as 'markup', because that is what the
  engine had been doing and a migration is the wrong place to reprice a
  pilot. It said the switch should be a deliberate act with a visible effect.

  This is that act. ITT has confirmed the basis is margin on price, always.

  ## What changes

  price = cost / (1 - rate), not cost x (1 + rate).

  At the standard rate of 0.40 this raises every cost-plus price by 19%:
  a $100 cost priced at $140 now prices at $166.67. That is the intended
  correction - $140 earns a 28.6% margin, not 40% - but it means any quote
  produced before this migration and re-run after it will return a higher
  number, and the difference is not a bug.

  ## The rate itself is a separate question

  standard_rate stays at 0.40. Whether 40% is the right standard rate when
  it is read as a margin rather than a markup has not been confirmed, and
  this migration does not assume it. It changes the arithmetic to match the
  stated basis and nothing else.
*/

UPDATE pricing_rules_config
   SET margin_basis = 'margin'
 WHERE margin_basis IS DISTINCT FROM 'margin';

/*
 * New rule sets default to margin rather than coming up blank. The earlier
 * migration left this with no default on purpose, so that the choice could
 * not be made by accident. The choice has now been made on the record.
 */
ALTER TABLE pricing_rules_config
  ALTER COLUMN margin_basis SET DEFAULT 'margin';

COMMENT ON COLUMN pricing_rules_config.margin_basis IS
  'Whether standard_rate and the adders are a margin on price or a markup on cost. ITT confirmed margin on price; markup remains valid only for historical rule sets.';
