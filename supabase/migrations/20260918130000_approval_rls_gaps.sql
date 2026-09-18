/*
  # Two row-level security gaps that made approvals impossible

  Found by watching a VP approve a quote and seeing the quote stay
  "Pending Approval" afterwards, with no error anywhere.

  ## 1. An approver cannot write to the quote they are approving

  The only UPDATE policy on `quotes` is:

      created_by = auth.uid()

  So when an approver sets a quote to Approved, the UPDATE matches no rows and
  affects nothing. **It does not raise** - a row filtered out by RLS is simply
  not there - so the approval was recorded in approval_requests and
  approval_history while the quote itself never moved. Every layer reported
  success.

  Widening the policy to let approvers update quotes is the obvious fix and
  the wrong one: it would let anyone with approval authority rewrite the
  totals and discounts of quotes they did not raise, which is a larger hole
  than the one being closed.

  Instead a narrow SECURITY DEFINER function moves a quote through the
  workflow and touches nothing else. It can set only the approval columns, and
  only to statuses that are part of the workflow, so authority to approve does
  not become authority to edit.

  ## 2. Ordinary users cannot read the approval rules

  `approval_workflow_rules` carries one policy, "Admins can manage approval
  rules", covering ALL commands. A sales user therefore cannot read the
  thresholds that govern their own quotes, and the server's lookup of which
  role approves a level returned nothing - which is why queued requests were
  filed against "Level 2" rather than "Regional Manager".

  The thresholds are not sensitive. Everyone quoting should be able to see
  what needs approval; only admins should be able to change it.
*/

CREATE POLICY "Authenticated users can read approval rules"
  ON approval_workflow_rules FOR SELECT TO authenticated USING (true);

/*
 * Moves a quote through the approval workflow.
 *
 * SECURITY DEFINER because the caller is an approver who, correctly, has no
 * UPDATE rights on a quote they did not raise. Deliberately narrow: it writes
 * only the approval columns, and only workflow statuses, so it cannot be used
 * to alter a quote's commercial content.
 *
 * Authority is checked by the caller (server/approvals.ts) before this runs.
 * The status allowlist here is the second line, not the first.
 */
CREATE OR REPLACE FUNCTION set_quote_approval_status(
  p_quote_id text,
  p_status   text,
  p_level    integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_status NOT IN ('Draft', 'Sent', 'Pending Approval', 'Under Review', 'Approved', 'Rejected') THEN
    RAISE EXCEPTION 'set_quote_approval_status: % is not a workflow status', p_status;
  END IF;

  UPDATE quotes
     SET status                 = p_status,
         current_approval_level = COALESCE(p_level, current_approval_level),
         final_approval_at      = CASE WHEN p_status = 'Approved' THEN now()
                                       ELSE final_approval_at END,
         updated_at             = now()
   WHERE id = p_quote_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

COMMENT ON FUNCTION set_quote_approval_status(text, text, integer) IS
  'Workflow-only status transition for approvers, who have no UPDATE rights on quotes they did not raise. Writes approval columns only.';

GRANT EXECUTE ON FUNCTION set_quote_approval_status(text, text, integer) TO authenticated;
