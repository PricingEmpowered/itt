/**
 * tRPC client, replacing the Supabase browser client.
 *
 * The API is same-origin (the server serves the built frontend in
 * production, and Vite proxies /api in development), so requests carry the
 * session cookie and no key or token is held in the browser.
 */
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../server/routers';

export const trpc = createTRPCReact<AppRouter>();
