/**
 * Transitional Supabase stand-in.
 *
 * Supabase is being removed: this deployment is on-premise with no Supabase
 * project to talk to. Components are being moved to the tRPC client in
 * src/lib/trpc.ts one at a time.
 *
 * Until that finishes, unported components still import `supabase`. This
 * module used to throw at import time when the environment variables were
 * absent, which meant a single unported import prevented the whole app from
 * booting. It now fails on *use* instead, so ported screens work while
 * unported ones raise a clear error naming what needs doing.
 *
 * Delete this file, and the @supabase/supabase-js dependency, once no
 * imports remain.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

function unported(operation: string): never {
  throw new Error(
    `Supabase has been removed from this deployment (attempted: ${operation}). ` +
      'This component still needs porting to the tRPC API in src/lib/trpc.ts.'
  );
}

/**
 * Reports every access as an error rather than returning undefined, so a
 * missed call site surfaces immediately instead of failing later as an
 * unrelated "cannot read property of undefined".
 */
function createUnportedProxy(path: string): any {
  return new Proxy(function () {} as any, {
    get(_target, property) {
      if (property === Symbol.toPrimitive || property === 'toString') {
        return () => `[unported supabase: ${path}]`;
      }
      return createUnportedProxy(`${path}.${String(property)}`);
    },
    apply() {
      unported(path);
    },
  });
}

/*
 * Typed as the real client so that unported components keep their existing
 * type inference while the port is in progress -- only the runtime behaviour
 * changes. Without this the proxy would be `any` and every callback across
 * the unported files would silently lose its types.
 */
export const supabase = createUnportedProxy('supabase') as SupabaseClient;
