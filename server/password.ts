/**
 * Password hashing.
 *
 * Uses scrypt from Node's own crypto module rather than bcrypt or argon2.
 * Both of those are native addons that need a compiler at install time, which
 * is a poor assumption for an on-premise client server that may have no build
 * toolchain and no registry access. scrypt is a memory-hard KDF built into
 * Node, so there is nothing to compile.
 *
 * Stored format: scrypt$N$r$p$<salt-b64>$<hash-b64>
 * Parameters are stored per hash so they can be raised later without
 * invalidating existing passwords.
 */
import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

/**
 * promisify() cannot express scrypt's options overload, so wrap it directly.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/** cost=2^15 keeps verification a few tens of milliseconds on modest hardware. */
const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

// scrypt needs roughly 128 * N * r bytes; Node's default maxmem is lower.
const MAX_MEM = 256 * COST * BLOCK_SIZE;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
    maxmem: MAX_MEM,
  });

  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

/**
 * Verify a password against a stored hash.
 *
 * Returns false for malformed or non-scrypt values rather than throwing, so
 * that disabled accounts (whose stored value is deliberately not a valid
 * hash) simply fail to authenticate.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, costRaw, blockRaw, parallelRaw, saltB64, expectedB64] = parts;
  const cost = Number(costRaw);
  const blockSize = Number(blockRaw);
  const parallelism = Number(parallelRaw);
  if (!Number.isFinite(cost) || !Number.isFinite(blockSize) || !Number.isFinite(parallelism)) {
    return false;
  }

  let expected: Buffer;
  let salt: Buffer;
  try {
    expected = Buffer.from(expectedB64, 'base64');
    salt = Buffer.from(saltB64, 'base64');
  } catch {
    return false;
  }
  if (expected.length === 0 || salt.length === 0) return false;

  let actual: Buffer;
  try {
    actual = await scrypt(password, salt, expected.length, {
      N: cost,
      r: blockSize,
      p: parallelism,
      maxmem: 256 * cost * blockSize,
    });
  } catch {
    return false;
  }

  // Lengths match by construction, so this is a constant-time comparison.
  return timingSafeEqual(actual, expected);
}
