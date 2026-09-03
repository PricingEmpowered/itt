/**
 * Create or update a user account from the command line.
 *
 * There is no self-service sign-up: this is an internal tool for ~10 named
 * users, so accounts are provisioned by whoever runs the server.
 *
 *   npm run create-user -- alice@example.com "Alice Smith"
 *   ADMIN=true npm run create-user -- boss@example.com "Dana Boss"
 *
 * Creates (or updates) both the login account and the user_profiles row that
 * drives the approval workflow. ADMIN=true grants full approval authority;
 * ROLE, APPROVAL_LEVEL, MAX_DISCOUNT, MAX_QUOTE_SIZE and MIN_MARGIN override
 * individual fields.
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

  /*
   * Approval authority for the profile. Defaults are deliberately modest;
   * an administrator raises them with ADMIN=true or the explicit variables.
   */
  const isAdmin = process.env.ADMIN === 'true';
  const role = process.env.ROLE?.trim() || (isAdmin ? 'admin' : 'Sales Manager');
  const approvalLevel = Number(process.env.APPROVAL_LEVEL ?? (isAdmin ? 5 : 1));
  const maxDiscount = Number(process.env.MAX_DISCOUNT ?? (isAdmin ? 100 : 15));
  const maxQuoteSize = Number(process.env.MAX_QUOTE_SIZE ?? (isAdmin ? 100000000 : 100000));
  const minMargin = Number(process.env.MIN_MARGIN ?? 20);

  for (const [name, value] of Object.entries({
    APPROVAL_LEVEL: approvalLevel,
    MAX_DISCOUNT: maxDiscount,
    MAX_QUOTE_SIZE: maxQuoteSize,
    MIN_MARGIN: minMargin,
  })) {
    if (!Number.isFinite(value)) {
      console.error(`${name} must be a number.`);
      process.exit(1);
    }
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
      const { rows } = await db.query<{ id: string; inserted: boolean }>(
        `INSERT INTO auth.users (email, encrypted_password, full_name, is_active)
              VALUES ($1, $2, $3, true)
         ON CONFLICT (email) DO UPDATE
                SET encrypted_password = EXCLUDED.encrypted_password,
                    full_name = COALESCE(EXCLUDED.full_name, auth.users.full_name),
                    is_active = true,
                    updated_at = now()
           RETURNING id, (xmax = 0) AS inserted`,
        [email, hash, fullNameArg?.trim() || null]
      );
      const user = rows[0];

      /*
       * Also give the account its approval profile.
       *
       * user_profiles drives the approval workflow, and its INSERT policy
       * only permits admins -- where "admin" means already having a
       * user_profiles row with role 'admin'. That is unsatisfiable for the
       * first account, so a profile can never be created from inside the app.
       * Provisioning it here, alongside the account, is the way out of that
       * circle. Defaults match what the approvals screen used to attempt.
       */
      await db.query(
        `INSERT INTO user_profiles
           (id, email, full_name, role, approval_level, max_discount_approval,
            max_quote_size, min_margin_percent, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         ON CONFLICT (id) DO UPDATE
                SET email = EXCLUDED.email,
                    full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
                    active = true`,
        [
          user.id,
          email,
          fullNameArg?.trim() || email.split('@')[0],
          role,
          approvalLevel,
          maxDiscount,
          maxQuoteSize,
          minMargin,
        ]
      );

      return user.inserted ? 'created' : 'updated';
    });

    console.log(`Account ${action}: ${email} (role: ${role}, approval level ${approvalLevel})`);
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
