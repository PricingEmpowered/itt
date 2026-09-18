/**
 * Quote submission and approval routing.
 *
 * ## Why this is on the server
 *
 * The approval level is derived from the quote's discount, value and margin.
 * If the browser supplied those figures, anyone who can open developer tools
 * could submit a 60%-discount quote claiming 5% and route it to nobody. So the
 * numbers are recomputed here from the quote's own lines, and the client's
 * opinion of them is not consulted.
 *
 * This matters more than usual for the pilot: sales quote from this system,
 * and an approval that can be skipped is not an approval.
 *
 * ## What "margin unknown" means
 *
 * Many ITT parts carry no cost, so a quote's margin is frequently
 * unknowable. An unknown margin must not quietly satisfy a margin rule and
 * lower the approval level, so `determine_approval_level` skips margin rules
 * when margin is null, and the result records that it did. A human then sees
 * "margin unknown" on the request rather than an approval level that looks
 * authoritative and was computed from absent data.
 */
import { TRPCError } from '@trpc/server';
import type { Queryable } from './db.js';

export interface QuoteFinancials {
  quoteId: string;
  total: number;
  /** Quantity-weighted mean discount across priced lines. */
  discountPercent: number;
  /** Null when no line carries a cost. */
  marginPercent: number | null;
  linesPriced: number;
  linesCosted: number;
  linesTotal: number;
}

export interface SubmissionResult {
  quoteId: string;
  requiredLevel: number;
  status: string;
  approvalRequestId: string | null;
  financials: QuoteFinancials;
  /** Things a human should know before approving. */
  notes: string[];
}

/**
 * Recomputes a quote's financials from its lines.
 *
 * Discount is quantity-weighted rather than a plain mean, so a 50% discount on
 * one unit does not outweigh a 5% discount on a thousand.
 */
export async function quoteFinancials(
  db: Queryable,
  quoteId: string
): Promise<QuoteFinancials> {
  const { rows } = await db.query<{
    total: string | null;
    discount_percent: string | null;
    margin_percent: string | null;
    lines_priced: string;
    lines_costed: string;
    lines_total: string;
  }>(
    `WITH line AS (
       SELECT COALESCE(ql.quantity, 1)                        AS qty,
              ql.unit_price,
              COALESCE(ql.discount_applied, 0)                AS discount,
              COALESCE(ql.booked_cost, p.base_cost)           AS cost,
              ql.unit_price * (1 - COALESCE(ql.discount_applied, 0) / 100)
                                                              AS effective
         FROM quote_lines ql
         JOIN products p ON p.id = ql.product_id
        WHERE ql.quote_id = $1
     )
     SELECT (SELECT total FROM quotes WHERE id = $1)          AS total,
            /* FILTER binds to the aggregate, so both halves carry it. */
            sum(discount * qty) FILTER (WHERE unit_price IS NOT NULL)
              / NULLIF(sum(qty) FILTER (WHERE unit_price IS NOT NULL), 0)
                                                              AS discount_percent,
            CASE WHEN count(*) FILTER (WHERE cost IS NOT NULL AND cost > 0
                                         AND effective > 0) = 0
                 THEN NULL
                 ELSE sum((effective - cost) * qty)
                        FILTER (WHERE cost IS NOT NULL AND cost > 0 AND effective > 0)
                      / NULLIF(sum(effective * qty)
                        FILTER (WHERE cost IS NOT NULL AND cost > 0 AND effective > 0), 0)
                      * 100
            END                                               AS margin_percent,
            count(*) FILTER (WHERE unit_price IS NOT NULL)    AS lines_priced,
            count(*) FILTER (WHERE cost IS NOT NULL AND cost > 0) AS lines_costed,
            count(*)                                          AS lines_total
       FROM line`,
    [quoteId]
  );

  const r = rows[0];
  if (!r) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Quote ${quoteId} not found.` });
  }

  const num = (v: string | null) => (v === null ? null : Number(v));
  return {
    quoteId,
    total: num(r.total) ?? 0,
    discountPercent: num(r.discount_percent) ?? 0,
    marginPercent: num(r.margin_percent),
    linesPriced: Number(r.lines_priced),
    linesCosted: Number(r.lines_costed),
    linesTotal: Number(r.lines_total),
  };
}

/**
 * Submits a quote for approval, creating the request and its history entry.
 *
 * Idempotent: resubmitting a quote that already has a pending request returns
 * the existing one rather than stacking duplicates in the queue.
 */
export async function submitForApproval(
  db: Queryable,
  quoteId: string,
  userId: string
): Promise<SubmissionResult> {
  const financials = await quoteFinancials(db, quoteId);
  const notes: string[] = [];

  if (financials.linesTotal === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'A quote with no lines cannot be submitted for approval.',
    });
  }
  if (financials.linesPriced < financials.linesTotal) {
    notes.push(
      `${financials.linesTotal - financials.linesPriced} of ${financials.linesTotal} line(s) carry no price.`
    );
  }
  if (financials.marginPercent === null) {
    notes.push(
      'Margin is unknown: no line on this quote carries a cost, so margin rules were not applied. ' +
        'The approval level reflects discount and value only.'
    );
  } else if (financials.linesCosted < financials.linesPriced) {
    notes.push(
      `Margin is computed from ${financials.linesCosted} of ${financials.linesPriced} priced line(s); ` +
        'the rest carry no cost.'
    );
  }

  const { rows: levelRows } = await db.query<{ level: number }>(
    'SELECT determine_approval_level($1, $2, $3) AS level',
    [financials.discountPercent, financials.total, financials.marginPercent]
  );
  const requiredLevel = Number(levelRows[0]?.level ?? 0);

  /* Nothing to approve: the quote goes straight to Sent. */
  if (requiredLevel === 0) {
    const { rowCount } = await db.query(
      `UPDATE quotes
          SET status = 'Sent',
              approvals_required = 0,
              max_approval_level_required = 0,
              current_approval_level = 0,
              updated_at = now()
        WHERE id = $1`,
      [quoteId]
    );
    /* A quote someone else raised is invisible to this UPDATE under RLS. */
    if (rowCount === 0) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Quote ${quoteId} could not be updated. You can only submit quotes you raised.`,
      });
    }
    return {
      quoteId,
      requiredLevel: 0,
      status: 'Sent',
      approvalRequestId: null,
      financials,
      notes: [...notes, 'No approval required: within all thresholds.'],
    };
  }

  /* Already queued. Return it rather than creating a second request. */
  const { rows: existing } = await db.query<{ id: string }>(
    `SELECT id FROM approval_requests
      WHERE quote_id = $1 AND status = 'Pending'
      ORDER BY requested_at DESC LIMIT 1`,
    [quoteId]
  );
  if (existing[0]) {
    return {
      quoteId,
      requiredLevel,
      status: 'Pending Approval',
      approvalRequestId: existing[0].id,
      financials,
      notes: [...notes, 'This quote already has a pending approval request.'],
    };
  }

  const { rows: roleRows } = await db.query<{ approval_role: string }>(
    `SELECT approval_role FROM approval_workflow_rules
      WHERE is_active AND approval_level = $1
      ORDER BY priority LIMIT 1`,
    [requiredLevel]
  );
  const approverRole = roleRows[0]?.approval_role ?? `Level ${requiredLevel}`;

  const requestId = `AR-${quoteId}-${Date.now()}`;
  const reason =
    `Discount ${financials.discountPercent.toFixed(1)}%, ` +
    `value ${financials.total.toFixed(2)}, ` +
    `margin ${financials.marginPercent === null ? 'unknown' : `${financials.marginPercent.toFixed(1)}%`}`;

  await db.query(
    /*
     * approval_level_required must be set explicitly. It defaults to 1, so
     * omitting it would file a level 4 exception in the queue as a routine
     * level 1 request - exactly the failure this whole feature exists to
     * prevent.
     */
    `INSERT INTO approval_requests
       (id, quote_id, requested_by, approver_role, approval_level_required, status, reason, comments)
     VALUES ($1, $2, $3, $4, $5, 'Pending', $6, $7)`,
    [requestId, quoteId, userId, approverRole, requiredLevel, reason, notes.join(' ') || null]
  );

  await db.query(
    `INSERT INTO approval_history
       (quote_id, approval_request_id, approval_level, action, actioned_by,
        comments, quote_total, quote_discount_percent, quote_margin_percent)
     VALUES ($1, $2, $3, 'requested', $4, $5, $6, $7, $8)`,
    [
      quoteId,
      requestId,
      requiredLevel,
      userId,
      reason,
      financials.total,
      financials.discountPercent,
      financials.marginPercent,
    ]
  );

  await db.query(
    `UPDATE quotes
        SET status = 'Pending Approval',
            approvals_required = 1,
            max_approval_level_required = $2,
            current_approval_level = 0,
            approval_requested_at = now(),
            updated_at = now()
      WHERE id = $1`,
    [quoteId, requiredLevel]
  );

  return {
    quoteId,
    requiredLevel,
    status: 'Pending Approval',
    approvalRequestId: requestId,
    financials,
    notes,
  };
}

export interface DecisionResult {
  quoteId: string;
  approvalRequestId: string;
  action: 'approved' | 'rejected';
  quoteStatus: string;
}

/**
 * Approves or rejects a pending request.
 *
 * Authority is checked here rather than by hiding a button. The approver's
 * level comes from `user_profiles`, not from the request, so a client cannot
 * claim a level it does not have. Self-approval is refused: the person who
 * asked for the approval is not the person who grants it.
 */
export async function decideApproval(
  db: Queryable,
  approvalRequestId: string,
  userId: string,
  action: 'approved' | 'rejected',
  comments: string | null
): Promise<DecisionResult> {
  const { rows: reqRows } = await db.query<{
    id: string;
    quote_id: string;
    status: string;
    requested_by: string | null;
    required_level: number | null;
  }>(
    `SELECT ar.id, ar.quote_id, ar.status, ar.requested_by::text,
            q.max_approval_level_required AS required_level
       FROM approval_requests ar
       JOIN quotes q ON q.id = ar.quote_id
      WHERE ar.id = $1`,
    [approvalRequestId]
  );

  const request = reqRows[0];
  if (!request) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Approval request not found.' });
  }
  if (request.status !== 'Pending') {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `This request was already ${request.status.toLowerCase()}.`,
    });
  }
  if (request.requested_by && request.requested_by === userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You cannot approve a quote you submitted yourself.',
    });
  }

  const { rows: approverRows } = await db.query<{ role: string; approval_level: number | null }>(
    'SELECT role, approval_level FROM user_profiles WHERE id = $1',
    [userId]
  );
  const approver = approverRows[0];
  const approverLevel = Number(approver?.approval_level ?? 0);
  const requiredLevel = Number(request.required_level ?? 0);

  if (approverLevel < requiredLevel) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message:
        `This quote needs level ${requiredLevel} approval and your authority is level ${approverLevel}.`,
    });
  }

  await db.query(
    `UPDATE approval_requests
        SET status = $2, approved_by = $3, approved_at = now(), comments = $4
      WHERE id = $1`,
    [approvalRequestId, action === 'approved' ? 'Approved' : 'Rejected', userId, comments]
  );

  await db.query(
    `INSERT INTO approval_history
       (quote_id, approval_request_id, approval_level, action, actioned_by,
        actioned_by_role, actioned_by_level, comments)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      request.quote_id,
      approvalRequestId,
      requiredLevel,
      action,
      userId,
      approver?.role ?? null,
      approverLevel,
      comments,
    ]
  );

  const quoteStatus = action === 'approved' ? 'Approved' : 'Rejected';
  /*
   * Through the workflow function, not a direct UPDATE. The approver has no
   * UPDATE rights on a quote they did not raise - correctly - so a plain
   * UPDATE here matched zero rows and silently did nothing while every layer
   * above reported success. See the migration for why the fix is a narrow
   * definer function rather than a wider policy.
   */
  const { rows: moved } = await db.query<{ ok: boolean }>(
    'SELECT set_quote_approval_status($1, $2, $3) AS ok',
    [request.quote_id, quoteStatus, action === 'approved' ? requiredLevel : 0]
  );
  if (!moved[0]?.ok) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Decision recorded but quote ${request.quote_id} did not change status.`,
    });
  }

  return { quoteId: request.quote_id, approvalRequestId, action, quoteStatus };
}
