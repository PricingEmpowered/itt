/** Server configuration. */
export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** Signs the session cookie. Must be at least 32 characters. */
  sessionSecret: process.env.SESSION_SECRET ?? "",
  sessionTtlMs:
    Number(process.env.SESSION_TTL_HOURS ?? 12) * 60 * 60 * 1000,
  isProduction: process.env.NODE_ENV === "production",
};
