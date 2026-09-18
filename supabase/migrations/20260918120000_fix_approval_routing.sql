/*
  # Make approval routing work

  The approval queue has never had anything in it. Three separate faults, each
  of which alone would be enough.

  ## 1. The routing function queries columns that do not exist

      SELECT MIN(required_approval_level) FROM approval_workflow_rules
       WHERE ... max_quote_value ...

  `approval_workflow_rules` has `approval_level` and `max_quote_size`. Calling
  `determine_approval_level(10, 50000, 30)` raises
  `column "required_approval_level" does not exist`. It has presumably never
  been called, because a caller would have noticed.

  ## 2. Nothing calls it

  The quote builder writes `approvals_required: 0` and creates no approval
  request. `Approvals.tsx` only ever reads and updates the table. So even a
  working function would route nothing.

  ## 3. The margin rules encode no margin

  Three rules are named for a margin threshold -- "Low Margin (< 20%)",
  "Critical Margin (< 15%)", "Below Cost (< 10%)" -- and carry NULL in both
  `min_margin_percent` and `max_margin_percent`. As written they constrain
  nothing, so they either match every quote or none depending on the query.
  The thresholds below are **inferred from the rule names**, which is the
  least surprising reading, but it is an inference and ITT should confirm it.

  ## Routing by level, not by role name

  The rules name approvers `Sales Manager`, `Regional Manager`,
  `Sales Director`, `VP Sales`. The roles that exist on `user_profiles` are
  `Sales Rep`, `Sales Manager`, `Director`, `VP Sales`, `Admin`. Two of the
  four rule roles have no matching profile role, so routing on the name would
  drop those quotes. Levels do line up, so routing is by
  `approval_level`: a quote needing level N goes to anyone at or above N.
  The role text on a rule is kept for display only.

  ## The rule is now "highest matching level"

  A rule matches when the quote sits inside every bound the rule specifies;
  unspecified bounds do not constrain. The required level is the highest level
  among matching rules, because these are escalating thresholds -- a 40%
  discount must reach level 4, not stop at level 1 because it also satisfies
  "0 to 15%" being merely bounded above at 100.
*/

/* Thresholds these three rules are named for but never carried. */
UPDATE approval_workflow_rules SET max_margin_percent = 20
 WHERE rule_name = 'Level 2: Low Margin (< 20%)' AND max_margin_percent IS NULL;
UPDATE approval_workflow_rules SET max_margin_percent = 15
 WHERE rule_name = 'Level 3: Critical Margin (< 15%)' AND max_margin_percent IS NULL;
UPDATE approval_workflow_rules SET max_margin_percent = 10
 WHERE rule_name = 'Level 4: Below Cost (< 10%)' AND max_margin_percent IS NULL;

DROP FUNCTION IF EXISTS determine_approval_level(numeric, numeric, numeric) CASCADE;

/*
 * Returns the approval level a quote requires, or 0 when it needs none.
 * Integer rather than the previous text, because every caller compares it
 * against user_profiles.approval_level, which is an integer.
 *
 * A null margin means margin is unknown -- ITT parts frequently have no cost
 * basis -- and an unknown margin must not silently satisfy a margin rule. Such
 * rules are skipped, and the caller is told the margin was unknown so a human
 * can decide rather than the absence of data lowering the approval level.
 */
CREATE FUNCTION determine_approval_level(
  p_discount_percent numeric,
  p_quote_total numeric,
  p_margin_percent numeric
) RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(approval_level), 0)
    FROM approval_workflow_rules
   WHERE is_active
     AND (min_discount_percent IS NULL OR p_discount_percent >= min_discount_percent)
     AND (max_discount_percent IS NULL OR p_discount_percent <= max_discount_percent)
     AND (min_quote_size      IS NULL OR p_quote_total     >= min_quote_size)
     AND (max_quote_size      IS NULL OR p_quote_total     <= max_quote_size)
     AND (min_margin_percent  IS NULL OR (p_margin_percent IS NOT NULL AND p_margin_percent >= min_margin_percent))
     AND (max_margin_percent  IS NULL OR (p_margin_percent IS NOT NULL AND p_margin_percent <= max_margin_percent));
$$;

COMMENT ON FUNCTION determine_approval_level(numeric, numeric, numeric) IS
  'Highest approval level whose rule the quote matches, 0 if none. Routing is by level; rule role names are display only.';

GRANT EXECUTE ON FUNCTION determine_approval_level(numeric, numeric, numeric) TO authenticated;

/* The queue reads by level and status on every page load. */
CREATE INDEX IF NOT EXISTS idx_approval_requests_status
  ON approval_requests (status, requested_at DESC);
