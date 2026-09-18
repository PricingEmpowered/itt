/**
 * Deployment capabilities.
 *
 * Some features depend on things a given install may not have — notably
 * outbound network access. Rather than letting the frontend try and fail,
 * it asks what this deployment supports and adapts.
 */
import { TRPCError } from '@trpc/server';
import { aggregateStatus, refreshAggregates } from '../aggregates.js';
import { ENV } from '../env.js';
import { protectedProcedure, publicProcedure, router } from '../trpc.js';

export const systemRouter = router({
  capabilities: publicProcedure.query(() => ({
    /**
     * Natural-language analytics needs a reachable LLM endpoint. False on an
     * air-gapped server, which is the default assumption.
     */
    aiAnalytics: ENV.aiEnabled,
  })),

  /**
   * When the pre-aggregated analytics were last rebuilt, so the screens can
   * say "as of" rather than presenting stale figures as current.
   */
  aggregateStatus: protectedProcedure.query(() => aggregateStatus()),

  /**
   * Rebuild now. Offered because the schedule cannot know when ITT's nightly
   * ERP load finished, and someone looking at a dashboard that is clearly
   * behind should not have to wait up to an hour.
   */
  refreshAggregates: protectedProcedure.mutation(async () => {
    try {
      const rows = await refreshAggregates();
      return rows.map((r) => ({
        view: r.view_name,
        rows: Number(r.rows_written),
        durationMs: r.duration_ms,
      }));
    } catch (err) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: err instanceof Error ? err.message : 'Refresh failed.',
      });
    }
  }),
});
