/**
 * Dashboard metrics.
 *
 * get_dashboard_metrics is a SECURITY DEFINER function that takes a typed
 * integer period, so it is kept as-is and called through here rather than
 * from the browser.
 */
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc.js';

export const dashboardRouter = router({
  metrics: protectedProcedure
    .input(z.object({ periodDays: z.number().int().min(1).max(3650).default(365) }).default({ periodDays: 365 }))
    .query(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        /*
         * The function returns a single jsonb value, so `SELECT *` would wrap
         * it in a column named after the function. Alias it and unwrap, so
         * callers get the metrics object itself.
         */
        const { rows } = await db.query<{ metrics: Record<string, number> | null }>(
          'SELECT get_dashboard_metrics($1) AS metrics',
          [input.periodDays]
        );
        return rows[0]?.metrics ?? null;
      })
    ),
});
