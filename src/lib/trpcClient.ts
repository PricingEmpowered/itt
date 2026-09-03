/**
 * Concrete client and query-client instances, kept out of trpc.ts so that
 * importing the typed hooks does not drag in link configuration.
 */
import { QueryClient } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { trpc } from './trpc';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // This is an internal tool over a LAN; refetching on every window focus
      // is noise rather than freshness.
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      transformer: superjson,
      /**
       * The session is an httpOnly cookie, so it must be sent explicitly:
       * fetch omits credentials by default for same-origin requests made
       * with a relative URL only when configured otherwise, and being
       * explicit here keeps it correct behind a reverse proxy too.
       */
      fetch(url, options) {
        return fetch(url, { ...options, credentials: 'include' });
      },
    }),
  ],
});
