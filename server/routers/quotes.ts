/**
 * Quote reads.
 *
 * Replaces the frontend's nested Supabase select, which pulled a quote's
 * customer and lines in one call. Postgrest built that nesting for us; here
 * the lines and customer are joined explicitly and aggregated into JSON so
 * the response keeps the same shape the components already expect.
 */
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc.js';
import { calculateDealScore } from '../dealScore.js';
import { decideApproval, quoteFinancials, submitForApproval } from '../approvals.js';

/*
 * json_agg over a LEFT JOIN would produce `[null]` for a quote with no
 * lines, so the lines are aggregated in a correlated subquery and coalesced
 * to an empty array instead.
 *
 * Columns here are the ones that actually exist. The Supabase-era query in
 * src/hooks/useQuotes.ts asked for customers.email plus quote_lines.
 * product_name, list_price, discount_percent and total_price -- none of
 * which are columns in this schema, so that query could only ever have
 * errored. (It was dead code: nothing imported the hook.) The real columns
 * are customers.contact_email and quote_lines.unit_price /
 * discount_applied / line_total.
 */
const QUOTE_SELECT = `
  SELECT q.*,
         CASE WHEN c.id IS NULL THEN NULL
              ELSE jsonb_build_object('name', c.name, 'email', c.contact_email)
         END AS customer,
         COALESCE((
           SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', l.id,
                      'product_id', l.product_id,
                      'quantity', l.quantity,
                      'unit_price', l.unit_price,
                      'discount_applied', l.discount_applied,
                      'line_total', l.line_total
                    )
                    ORDER BY l.id
                  )
             FROM quote_lines l
            WHERE l.quote_id = q.id
         ), '[]'::jsonb) AS quote_lines
    FROM quotes q
    LEFT JOIN customers c ON c.id = q.customer_id
`;

export const quotesRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.string().max(50).optional(),
          limit: z.number().int().min(1).max(500).default(100),
          offset: z.number().int().min(0).default(0),
        })
        .default({ limit: 100, offset: 0 })
    )
    .query(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        /*
         * The Supabase version fetched every quote unbounded. With ~3,800
         * demo quotes that is a multi-megabyte response, so this pages by
         * default. Callers that need everything must ask page by page.
         */
        const params: unknown[] = [];
        let where = '';
        if (input.status) {
          params.push(input.status);
          where = `WHERE q.status = $${params.length}`;
        }
        params.push(input.limit, input.offset);

        const { rows } = await db.query(
          `${QUOTE_SELECT} ${where}
             ORDER BY q.created_at DESC NULLS LAST
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params
        );
        return rows;
      })
    ),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(100) }))
    .query(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        const { rows } = await db.query(`${QUOTE_SELECT} WHERE q.id = $1`, [input.id]);
        return rows[0] ?? null;
      })
    ),

  /*
   * Scores a quote against comparable historical deals. See server/dealScore.ts
   * for why this cannot be done from the browser.
   */
  dealScore: protectedProcedure
    .input(
      z.object({
        customerId: z.string().min(1).max(100),
        lines: z
          .array(
            z.object({
              product_id: z.string().min(1).max(200),
              unit_price: z.number().nullable(),
              discount_applied: z.number().nullable(),
            })
          )
          .max(500),
      })
    )
    .query(({ ctx, input }) =>
      ctx.withDb((db) => calculateDealScore(db, input.customerId, input.lines))
    ),

  /*
   * What a quote's approval would require, without submitting it. Lets the
   * quote builder warn before Save rather than after.
   */
  approvalPreview: protectedProcedure
    .input(z.object({ quoteId: z.string().min(1).max(100) }))
    .query(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        const financials = await quoteFinancials(db, input.quoteId);
        const { rows } = await db.query<{ level: number }>(
          'SELECT determine_approval_level($1, $2, $3) AS level',
          [financials.discountPercent, financials.total, financials.marginPercent]
        );
        return { financials, requiredLevel: Number(rows[0]?.level ?? 0) };
      })
    ),

  /*
   * Submission recomputes the financials from the quote's own lines, so the
   * routing cannot be influenced by what the browser claims. See
   * server/approvals.ts.
   */
  submitForApproval: protectedProcedure
    .input(z.object({ quoteId: z.string().min(1).max(100) }))
    .mutation(({ ctx, input }) =>
      ctx.withDb((db) => submitForApproval(db, input.quoteId, ctx.user.id))
    ),

  decideApproval: protectedProcedure
    .input(
      z.object({
        approvalRequestId: z.string().min(1).max(200),
        action: z.enum(['approved', 'rejected']),
        comments: z.string().max(4000).nullable().default(null),
      })
    )
    .mutation(({ ctx, input }) =>
      ctx.withDb((db) =>
        decideApproval(db, input.approvalRequestId, ctx.user.id, input.action, input.comments)
      )
    ),

  /*
   * Comparable prices for one product, for the price guidance panel.
   *
   * This and winRate below replace browser queries that embedded
   * `quotes!inner(status)` and filtered on `quotes.status`. The compatibility
   * layer cannot serve embedded selects, so both failed on every call and the
   * features were silently dead -- the same fault that kept deal scoring from
   * ever running. PriceGuidance logged the error and rendered an empty panel;
   * win probability swallowed it and returned a hardcoded 0.5.
   */
  peerPrices: protectedProcedure
    .input(z.object({ productId: z.string().min(1).max(200) }))
    .query(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        const { rows } = await db.query(
          `SELECT ql.unit_price,
                  ql.quantity,
                  ql.discount_applied,
                  q.created_at,
                  q.status,
                  c.name    AS customer_name,
                  c.segment AS customer_segment
             FROM quote_lines ql
             JOIN quotes    q ON q.id = ql.quote_id
             LEFT JOIN customers c ON c.id = q.customer_id
            WHERE ql.product_id = $1
              AND q.status IN ('Approved', 'Rejected')
              AND ql.unit_price IS NOT NULL
            ORDER BY q.created_at DESC
            LIMIT 500`,
          [input.productId]
        );
        return rows;
      })
    ),

  /*
   * Historical win rates for the win-probability model. The discount band
   * reads `discount_applied`; the browser version asked for `discount_percent`,
   * which is not a column on quote_lines, so it could not have worked even
   * with the embedding fixed.
   *
   * "Won" is approximated by Approved and "lost" by Rejected, because ITT's
   * extract carries no outcome. Once outcome arrives this should read it
   * instead: an approved quote is not a won one.
   */
  winRate: protectedProcedure
    .input(
      z.object({
        discountPercent: z.number().nullable().default(null),
        quoteTotal: z.number().nullable().default(null),
      })
    )
    .query(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        const byDiscount =
          input.discountPercent === null
            ? null
            : (
                await db.query<{ approved: string; total: string }>(
                  `SELECT count(*) FILTER (WHERE q.status = 'Approved') AS approved,
                          count(*)                                      AS total
                     FROM quote_lines ql
                     JOIN quotes q ON q.id = ql.quote_id
                    WHERE q.status IN ('Approved', 'Rejected')
                      AND ql.discount_applied BETWEEN $1 AND $2`,
                  [Math.max(0, input.discountPercent - 5), input.discountPercent + 5]
                )
              ).rows[0];

        const bySize =
          input.quoteTotal === null
            ? null
            : (
                await db.query<{ approved: string; total: string }>(
                  `SELECT count(*) FILTER (WHERE status = 'Approved') AS approved,
                          count(*)                                    AS total
                     FROM quotes
                    WHERE status IN ('Approved', 'Rejected')
                      AND total BETWEEN $1 AND $2`,
                  [input.quoteTotal * 0.7, input.quoteTotal * 1.3]
                )
              ).rows[0];

        /* No comparable history means no opinion, which is not 50%. */
        const rate = (r: { approved: string; total: string } | null | undefined) => {
          if (!r || Number(r.total) === 0) return null;
          return Number(r.approved) / Number(r.total);
        };

        return {
          byDiscount: { rate: rate(byDiscount), sample: Number(byDiscount?.total ?? 0) },
          bySize: { rate: rate(bySize), sample: Number(bySize?.total ?? 0) },
        };
      })
    ),

  count: protectedProcedure.query(({ ctx }) =>
    ctx.withDb(async (db) => {
      const { rows } = await db.query<{ count: number }>('SELECT count(*)::bigint AS count FROM quotes');
      return rows[0]?.count ?? 0;
    })
  ),
});
