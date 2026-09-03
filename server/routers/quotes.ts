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

  count: protectedProcedure.query(({ ctx }) =>
    ctx.withDb(async (db) => {
      const { rows } = await db.query<{ count: number }>('SELECT count(*)::bigint AS count FROM quotes');
      return rows[0]?.count ?? 0;
    })
  ),
});
