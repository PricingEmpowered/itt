/**
 * Server configuration, read once at startup.
 *
 * Everything here is required in production; the process exits rather than
 * booting half-configured, which is easier to diagnose on a client server
 * than an app that starts and then fails every request.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. See .env.example for the variables this server needs.`
    );
  }
  return value;
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number, got ${JSON.stringify(raw)}`);
  }
  return parsed;
}

const isProduction = process.env.NODE_ENV === 'production';

/**
 * The session cookie is signed with this secret. A short secret makes session
 * forgery cheap, so it is length-checked rather than merely present.
 *
 * Resolved lazily: the command-line tools (create-user, migrations) talk to
 * the database but never sign cookies, and requiring a secret they do not use
 * would block an operator from provisioning the first account.
 */
let cachedSessionSecret: string | undefined;

function sessionSecret(): string {
  if (cachedSessionSecret === undefined) {
    const secret = required('SESSION_SECRET');
    if (secret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters.');
    }
    cachedSessionSecret = secret;
  }
  return cachedSessionSecret;
}

export const ENV = {
  isProduction,
  port: optionalNumber('PORT', 3000),
  databaseUrl: required('DATABASE_URL'),
  get sessionSecret(): string {
    return sessionSecret();
  },
  /** How long a session cookie stays valid. */
  sessionTtlMs: optionalNumber('SESSION_TTL_HOURS', 12) * 60 * 60 * 1000,
  /**
   * Natural-language analytics ("Ask AI") requires an outbound LLM endpoint.
   * An air-gapped install has none, so the feature is off unless explicitly
   * enabled and pointed at a reachable model. The frontend asks the server
   * whether it is available rather than assuming.
   */
  aiEnabled: process.env.AI_ENABLED === 'true' && Boolean(process.env.LLM_API_URL),
  llmApiUrl: process.env.LLM_API_URL ?? null,
  llmApiKey: process.env.LLM_API_KEY ?? null,

  /**
   * Where uploaded documents are written. Only metadata lives in the
   * database; the bytes live here on the server's own disk.
   */
  documentRoot: process.env.DOCUMENT_ROOT ?? './var/documents',
} as const;
