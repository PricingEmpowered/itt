/*
  # Let the row policy agree with what the aggregates already publish

  `v_finalised_quote_lines`, and so every materialised view built on it,
  includes quotes with status Won and Lost. The SELECT policy on
  `quote_lines` grants line-level reads for Approved and Rejected only.

  The result was aggregated figures derived from rows a user could not read
  directly. The aggregates are monthly and coarse, so nothing identifiable
  leaked, but the two definitions of "finalised" disagreeing is the kind of
  gap that widens later - the next view built on this one might not be
  coarse.

  Won and Lost are more final than Approved, not less: they are the recorded
  outcome of a quote that already cleared approval. The policy is widened to
  match rather than the view narrowed, because the quote funnel needs those
  lines and `quotes` itself is already readable by every authenticated user.

  The `v_finalised_quote_lines` comment is corrected at the same time. It
  said RLS keeps drafts private, which is true of `quote_lines` - a draft
  belongs to its author - but not of `quotes`, whose SELECT policy is
  unconditional. Excluding drafts from the aggregates is a judgement about
  evidence, not a privacy control, and the comment should not imply
  otherwise.
*/

DROP POLICY IF EXISTS "Users can view quote lines for approved/rejected quotes" ON quote_lines;

CREATE POLICY "Users can view quote lines for finalised quotes"
  ON quote_lines FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotes
     WHERE quotes.id = quote_lines.quote_id
       AND quotes.status IN ('Approved', 'Rejected', 'Won', 'Lost')
  ));

COMMENT ON VIEW v_finalised_quote_lines IS
  'Finalised quote lines (Approved, Rejected, Won, Lost) with cost and effective price resolved. Drafts and in-flight quotes are excluded because they are not evidence of a price anyone agreed to - not as a privacy control. Every status included here is readable line-by-line by any authenticated user under the quote_lines SELECT policy, which is what makes the materialised views built on it safe to read without RLS.';
