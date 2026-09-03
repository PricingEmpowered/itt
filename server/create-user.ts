/**
 * Create or update a user account from the command line.
 *
 * There is no self-service sign-up: this is an internal tool for ~10 named
 * users, so accounts are provisioned by whoever runs the server.
 *
 *   npm run create-user -- alice@example.com "Alice Smith"
 *
 * The password is read from the PASSWORD environment variable, or generated
 * and printed if unset. It is never taken as an argv value, which would leave
 * it in the shell history and in `ps` output.
 */
import { randomBytes } from 'node:crypto';
import { asOwner, closePool } from './db.js';
import { hashPassword } from './password.js';

function generatePassword(): string {
  // base64url of 18 bytes: 24 characters, no ambiguous escaping.
  return randomBytes(18).toString('base64url');
}

async function main() {
  const [emailArg, fullNameArg] = process.argv.slice(2);
  if (!emailArg) {
    console.error('Usage: npm run create-user -- <email> ["Full Name"]');
    console.error('Set PASSWORD=... to choose the password, otherwise one is generated.');
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`Not a valid email address: ${emailArg}`);
    process.exit(1);
  }

  const provided = process.env.PASSWORD;
  if (provided && provided.length < 12) {
    console.error('PASSWORD must be at least 12 characters.');
    process.exit(1);
  }
  const password = provided ?? generatePassword();
  const hash = await hashPassword(password);

  try {
    const action = await asOwner(async (db) => {
      const { rows } = await db.query<{ inserted: boolean }>(
        `INSERT INTO auth.users (email, encrypted_password, full_name, is_active)
              VALUES ($1, $2, $3, true)
         ON CONFLICT (email) DO UPDATE
                SET encrypted_password = EXCLUDED.encrypted_password,
                    full_name = COALESCE(EXCLUDED.full_name, auth.users.full_name),
                    is_active = true,
                    updated_at = now()
           RETURNING (xmax = 0) AS inserted`,
        [email, hash, fullNameArg?.trim() || null]
      );
      return rows[0]?.inserted ? 'created' : 'updated';
    });

    console.log(`Account ${action}: ${email}`);
    if (!provided) {
      console.log(`Password: ${password}`);
      console.log('Store it now; it is not recoverable from the database.');
    }
  } finally {
    await closePool();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
