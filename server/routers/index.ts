import { router } from '../trpc.js';
import { authRouter } from './auth.js';
import { dashboardRouter } from './dashboard.js';
import { quotesRouter } from './quotes.js';
import { referenceRouter } from './reference.js';

export const appRouter = router({
  auth: authRouter,
  reference: referenceRouter,
  quotes: quotesRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
