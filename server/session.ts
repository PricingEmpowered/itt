/**
 * Session cookies.
 *
 * A signed JWT in an httpOnly cookie. There is no refresh-token dance: this
 * is a ~10 user on-premise deployment, so a single short-lived signed cookie
 * is the right amount of machinery.
 */
import { SignJWT, jwtVerify } from 'jose';
import type { Request, Response } from 'express';
import { ENV } from './env.js';

export const COOKIE_NAME = 'ps_session';

const ALGORITHM = 'HS256';

/**
 * Encoded lazily so that importing this module does not require
 * SESSION_SECRET; only actually signing or verifying a cookie does.
 */
let cachedKey: Uint8Array | undefined;
function secretKey(): Uint8Array {
  cachedKey ??= new TextEncoder().encode(ENV.sessionSecret);
  return cachedKey;
}

export type SessionPayload = {
  userId: string;
  email: string;
};

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + ENV.sessionTtlMs))
    .sign(secretKey());
}

/** Returns null for a missing, malformed, expired or wrongly-signed cookie. */
export async function readSession(req: Request): Promise<SessionPayload | null> {
  const token = req.cookies?.[COOKIE_NAME];
  if (typeof token !== 'string' || token.length === 0) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALGORITHM] });
    const userId = payload.sub;
    const email = payload.email;
    if (typeof userId !== 'string' || typeof email !== 'string') return null;
    return { userId, email };
  } catch {
    return null;
  }
}

/**
 * `secure` is set only in production: an on-premise install is often reached
 * over plain HTTP on an internal network during setup, and a secure cookie
 * would silently never be sent.
 *
 * `sameSite: 'lax'` suits a single-origin deployment where the API and the
 * built frontend are served by the same process.
 */
function cookieOptions() {
  return {
    httpOnly: true,
    secure: ENV.isProduction,
    sameSite: 'lax' as const,
    path: '/',
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: ENV.sessionTtlMs });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}
