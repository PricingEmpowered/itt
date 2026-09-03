/**
 * tRPC setup: context, and the two procedure kinds.
 *
 * `protectedProcedure` is the default choice. It resolves the session, loads
 * the user, and hands the resolver a `db` already scoped to that user, so a
 * router cannot accidentally query without an identity attached.
 */
import { TRPCError, initTRPC } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import superjson from 'superjson';
import { asOwner, asUser, type Queryable } from './db.js';
import { readSession } from './session.js';

export type AppUser = {
  id: string;
  email: string;
  fullName: string | null;
};

export async function createContext({ req, res }: CreateExpressContextOptions) {
  return { req, res, user: null as AppUser | null };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Requires a valid session whose user still exists and is active, so
 * deactivating an account takes effect immediately rather than at cookie
 * expiry.
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const session = await readSession(ctx.req);
  if (!session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not signed in' });
  }

  // auth.users is not readable by the request-scoped role, so this lookup
  // runs as the connecting role.
  const user = await asOwner(async (db) => {
    const { rows } = await db.query<{ id: string; email: string; full_name: string | null }>(
      'SELECT id, email, full_name FROM auth.users WHERE id = $1 AND is_active',
      [session.userId]
    );
    return rows[0] ?? null;
  });

  if (!user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Account is no longer active' });
  }

  const appUser: AppUser = { id: user.id, email: user.email, fullName: user.full_name };

  return next({
    ctx: {
      ...ctx,
      user: appUser,
      /** Runs a callback against the database as this user, under RLS. */
      withDb: <T>(fn: (db: Queryable) => Promise<T>) => asUser(appUser.id, fn),
    },
  });
});
