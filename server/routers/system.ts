/**
 * Deployment capabilities.
 *
 * Some features depend on things a given install may not have — notably
 * outbound network access. Rather than letting the frontend try and fail,
 * it asks what this deployment supports and adapts.
 */
import { ENV } from '../env.js';
import { publicProcedure, router } from '../trpc.js';

export const systemRouter = router({
  capabilities: publicProcedure.query(() => ({
    /**
     * Natural-language analytics needs a reachable LLM endpoint. False on an
     * air-gapped server, which is the default assumption.
     */
    aiAnalytics: ENV.aiEnabled,
  })),
});
