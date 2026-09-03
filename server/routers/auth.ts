/**
 * Authentication: the replacement for Supabase Auth.
 *
 * `auth.users` is not readable by the request-scoped role (password hashes
 * live there), so everything here runs via `asOwner`.
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { asOwner } from '../db.js';
import { hashPassword, verifyPassword } from '../password.js';
import {
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
} from '../session.js';
import { protectedProcedure, publicProcedure, router } from '../trpc.js';

const emailSchema = z.string().trim().min(3).max(320).email().toLowerCase();
/**
 * 12 characters with no composition rules. Length beats character classes,
 * and for ~10 named users on an internal server, rules mostly produce
 * predictable substitutions.
 */
const passwordSchema = z.string().min(12).max(200);

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  encrypted_password: string;
  is_active: boolean;
};

export const authRouter = router({
  /** The signed-in user, or null. Safe to call unauthenticated. */
  me: publicProcedure.query(async ({ ctx }) => {
    const { readSession } = await import('../session.js');
    const session = await readSession(ctx.req);
    if (!session) return null;

    return asOwner(async (db) => {
      const { rows } = await db.query<{ id: string; email: string; full_name: string | null }>(
        'SELECT id, email, full_name FROM auth.users WHERE id = $1 AND is_active',
        [session.userId]
      );
      const user = rows[0];
      return user ? { id: user.id, email: user.email, fullName: user.full_name } : null;
    });
  }),

  signIn: publicProcedure
    .input(z.object({ email: emailSchema, password: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const user = await asOwner(async (db) => {
        const { rows } = await db.query<UserRow>(
          `SELECT id, email, full_name, encrypted_password, is_active
             FROM auth.users
            WHERE lower(email) = $1`,
          [input.email]
        );
        return rows[0] ?? null;
      });

      /*
       * Verify against a dummy hash when the account is missing or inactive,
       * so the response time does not reveal which emails exist. The message
       * stays identical for every failure reason for the same reason.
       */
      const storedHash = user?.is_active
        ? user.encrypted_password
        : 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

      const passwordMatches = await verifyPassword(input.password, storedHash);

      if (!user || !user.is_active || !passwordMatches) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
      }

      await asOwner((db) =>
        db.query('UPDATE auth.users SET last_sign_in_at = now() WHERE id = $1', [user.id])
      );

      const token = await createSessionToken({ userId: user.id, email: user.email });
      setSessionCookie(ctx.res, token);

      return { id: user.id, email: user.email, fullName: user.full_name };
    }),

  signOut: publicProcedure.mutation(({ ctx }) => {
    clearSessionCookie(ctx.res);
    return { success: true } as const;
  }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1).max(200),
        newPassword: passwordSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await asOwner(async (db) => {
        const { rows } = await db.query<Pick<UserRow, 'encrypted_password'>>(
          'SELECT encrypted_password FROM auth.users WHERE id = $1',
          [ctx.user.id]
        );
        return rows[0] ?? null;
      });

      if (!user || !(await verifyPassword(input.currentPassword, user.encrypted_password))) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Current password is incorrect' });
      }

      const hash = await hashPassword(input.newPassword);
      await asOwner((db) =>
        db.query(
          'UPDATE auth.users SET encrypted_password = $2, updated_at = now() WHERE id = $1',
          [ctx.user.id, hash]
        )
      );

      return { success: true } as const;
    }),
});
