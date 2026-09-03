/**
 * Current-user lookup for code outside React components.
 *
 * Replaces `supabase.auth.getUser()`. The session is an httpOnly cookie, so
 * the browser cannot read it; the server is asked instead. The return shape
 * mirrors the Supabase call so existing call sites destructure unchanged.
 *
 * Inside components prefer `trpc.auth.me.useQuery()`, which is cached and
 * re-renders on change.
 */
import { trpcClient } from './trpcClient';

export type CurrentUser = { id: string; email: string; fullName: string | null };

export async function getCurrentUser(): Promise<{ data: { user: CurrentUser | null } }> {
  try {
    const user = await trpcClient.auth.me.query();
    return { data: { user: user ?? null } };
  } catch {
    // Treat an unreachable or unauthenticated session as signed out; callers
    // already handle a null user.
    return { data: { user: null } };
  }
}
