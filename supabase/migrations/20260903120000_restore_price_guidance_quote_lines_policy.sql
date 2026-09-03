/*
  # Restore quote-line visibility for price guidance

  ## What broke

  Migration 20251009181627 added a SELECT policy on `quote_lines` allowing
  authenticated users to read lines belonging to Approved or Rejected quotes.
  Its stated purpose: "enables the price guidance feature to show competitive
  pricing data".

  Migration 20251106014716 ("consolidate duplicate policies") then dropped
  that policy and did not replace it. The only remaining SELECT policy on
  `quote_lines` restricts rows to quotes where `created_by = auth.uid()`.

  ## Effect

  `quotes` is readable by every authenticated user (its SELECT policy is
  simply `true`), but since the consolidation a user can only see the *lines*
  of quotes they personally created. So:

    - Price guidance, used from the quote builder, sees only the current
      user's own history instead of the organisation's, which defeats its
      purpose of showing comparable pricing.
    - Any quote list shows headers and totals with empty line items for every
      quote the viewer did not create.

  ## Fix

  Re-create the dropped policy with its original definition. This restores
  the intended model, in which finalised quotes are shared reference data
  while drafts and pending quotes stay private to their author. Write access
  is unchanged: the INSERT/UPDATE/DELETE policies still require ownership.
*/

DROP POLICY IF EXISTS "Users can view quote lines for approved/rejected quotes" ON quote_lines;

CREATE POLICY "Users can view quote lines for approved/rejected quotes"
  ON quote_lines
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM quotes
      WHERE quotes.id = quote_lines.quote_id
        AND quotes.status IN ('Approved', 'Rejected')
    )
  );
