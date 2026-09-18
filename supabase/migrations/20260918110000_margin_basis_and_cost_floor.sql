/*
  # Make the pricing basis explicit, and add a cost floor

  Written because the rules engine is going into a pilot where sales quote
  from it. Both changes exist to stop a wrong number reaching a customer.

  ## 1. Margin or markup is now a stated choice, not an accident

  The cost-plus path computed:

      price = cost x (1 + 0.40 + adders)

  The variable is named `standardMargin`, the column is `margin_adder`, and
  the arithmetic is a markup. On a $100 part "40%" returns $140, which earns
  a 28.6% margin. To earn 40% the formula divides: $100 / 0.60 = $166.67.

  ITT's own SPA system computes margin on price - `MARGIN_n` reconciles to
  (price - cost) / price on every sample tier, exactly. So margin is the more
  likely intent.

  That is still not enough to switch silently. Changing the basis reprices
  every cost-plus quote by roughly 19%, and whoever configured the 0.40 may
  have meant markup. So the basis becomes an explicit column with no default
  that hides the choice: `margin_basis` is 'margin' or 'markup', it is shown
  on the calculation, and the number it applies to is configurable instead of
  being a literal in a React component.

  Existing rule sets are set to 'markup' - which is what they have been doing -
  so nothing reprices on deploy. Changing it is then a deliberate act with a
  visible effect, which is the point.

  ## 2. A cost floor

  Nothing stopped the engine returning a price below cost. Section 7.2 of the
  target pricing specification puts a floor at cost / (1 - minimum margin),
  defaulting to 20%. On a pilot that quotes to customers, that guardrail is
  worth having before the sophisticated parts of the model arrive.
*/

ALTER TABLE pricing_rules_config
  /* 'margin' -> price = cost / (1 - rate). 'markup' -> price = cost * (1 + rate). */
  ADD COLUMN IF NOT EXISTS margin_basis text
    CHECK (margin_basis IN ('margin', 'markup')),
  /* The rate the basis applies to. Was hardcoded 0.40 in RulesPricingModal. */
  ADD COLUMN IF NOT EXISTS standard_rate numeric
    CHECK (standard_rate >= 0 AND standard_rate < 1),
  /* Section 7.2: floor = cost / (1 - minimum_margin). */
  ADD COLUMN IF NOT EXISTS minimum_margin numeric DEFAULT 0.20
    CHECK (minimum_margin >= 0 AND minimum_margin < 1);

COMMENT ON COLUMN pricing_rules_config.margin_basis IS
  'Whether standard_rate and the adders are a margin on price or a markup on cost. Set deliberately; there is no safe default.';
COMMENT ON COLUMN pricing_rules_config.standard_rate IS
  'The base rate for cost-plus pricing, interpreted per margin_basis.';
COMMENT ON COLUMN pricing_rules_config.minimum_margin IS
  'Cost floor: no price below cost / (1 - minimum_margin). Spec 7.2.';

/*
 * Existing rule sets keep doing exactly what they did. 0.40 as a markup is
 * the behaviour that has been in force, so recording it preserves prices;
 * recording 'margin' would raise every cost-plus quote by about 19% the
 * moment this deploys, which is not a migration's decision to make.
 */
UPDATE pricing_rules_config
   SET margin_basis  = COALESCE(margin_basis, 'markup'),
       standard_rate = COALESCE(standard_rate, 0.40)
 WHERE margin_basis IS NULL OR standard_rate IS NULL;
