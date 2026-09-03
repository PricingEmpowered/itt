/**
 * Natural-language analytics endpoint.
 *
 * Replaces the `ai-analytics` Supabase Edge Function, which took a question,
 * asked an LLM to write SQL for it, and executed whatever came back.
 *
 * That is unavailable here for two independent reasons, and both must be
 * resolved before this is switched on:
 *
 * 1. **No outbound network.** This deployment is on-premise and assumed
 *    air-gapped, so there is no reachable model. Setting AI_ENABLED=true and
 *    LLM_API_URL to an OpenAI-compatible endpoint (a locally hosted model
 *    counts) satisfies this part.
 *
 * 2. **Executing generated SQL is unsafe as it was built.** The old flow ran
 *    model-written SQL through `execute_analytics_query`, a SECURITY DEFINER
 *    function that bypassed row-level security entirely. That function has
 *    been dropped. Re-enabling the feature needs a safe execution path --
 *    running the generated statement as the requesting user, read-only, with
 *    a statement timeout, rather than as the table owner.
 *
 * Until then this returns a structured 503 the UI can explain, instead of a
 * failed fetch the user cannot interpret.
 */
import type { Express, Request, Response } from 'express';
import { ENV } from './env.js';
import { readSession } from './session.js';

export function registerAiAnalyticsRoutes(app: Express): void {
  app.post('/api/ai-analytics', async (req: Request, res: Response) => {
    const session = await readSession(req);
    if (!session) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }

    if (!ENV.aiEnabled) {
      res.status(503).json({
        error: 'Natural-language analytics is not available in this deployment',
        details:
          'This installation has no configured language model endpoint. ' +
          'The dashboards and reports elsewhere in the app read the same data.',
        unavailable: true,
      });
      return;
    }

    // Reaching here means an operator set AI_ENABLED and LLM_API_URL, but the
    // safe execution path described above is still outstanding. Failing
    // clearly beats silently reintroducing the old behaviour.
    res.status(501).json({
      error: 'Natural-language analytics is configured but not yet implemented',
      details:
        'A model endpoint is set, but generated SQL must be executed under the ' +
        'requesting user with read-only access before this can be enabled.',
      unavailable: true,
    });
  });
}
