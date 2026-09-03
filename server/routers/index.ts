import { router } from '../trpc.js';
import { analyticsRouter } from './analytics.js';
import { authRouter } from './auth.js';
import { dashboardRouter } from './dashboard.js';
import { dataRouter } from './data.js';
import { quotesRouter } from './quotes.js';
import { referenceRouter } from './reference.js';
import { systemRouter } from './system.js';

export const appRouter = router({
  auth: authRouter,
  analytics: analyticsRouter,
  reference: referenceRouter,
  data: dataRouter,
  quotes: quotesRouter,
  dashboard: dashboardRouter,
  system: systemRouter,
});

export type AppRouter = typeof appRouter;
