/**
 * Session handling.
 *
 * Identity is local: a signed JWT in an httpOnly cookie, verified against the
 * `users` table on each request. There is no external identity provider.
 */
import { COOKIE_NAME } from "@shared/const";
import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";

const ALGORITHM = "HS256";

/** Encoded lazily so importing this module does not require the secret;
 * only signing or verifying a cookie does. */
let cachedKey: Uint8Array | undefined;
function secretKey(): Uint8Array {
  if (!cachedKey) {
    if (!ENV.sessionSecret || ENV.sessionSecret.length < 32) {
      throw new Error("SESSION_SECRET must be set and at least 32 characters.");
    }
    cachedKey = new TextEncoder().encode(ENV.sessionSecret);
  }
  return cachedKey;
}

export async function createSessionToken(userId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + ENV.sessionTtlMs))
    .sign(secretKey());
}

function readCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  return parseCookieHeader(header)[COOKIE_NAME];
}

/**
 * The signed-in user, or null. Returns null rather than throwing for a
 * missing, malformed, expired or wrongly-signed cookie, since public
 * procedures call this too.
 */
export async function authenticateRequest(req: Request): Promise<User | null> {
  const token = readCookie(req);
  if (!token) return null;

  let userId: number;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: [ALGORITHM],
    });
    userId = Number(payload.sub);
    if (!Number.isInteger(userId)) return null;
  } catch {
    return null;
  }

  const user = await db.getUserById(userId);
  // An account deactivated after the cookie was issued stops working now,
  // rather than at cookie expiry.
  return user && user.isActive ? user : null;
}

export function setSessionCookie(
  req: Request,
  res: Response,
  token: string
): void {
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: ENV.sessionTtlMs,
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    ...getSessionCookieOptions(req),
    maxAge: -1,
  });
}
