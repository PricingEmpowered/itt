/**
 * Create or update an account from the command line.
 *
 * There is no self-service sign-up: accounts are provisioned by whoever runs
 * the server.
 *
 *   pnpm create-user alice@example.com "Alice Smith"
 *   ADMIN=true pnpm create-user boss@example.com "Dana Boss"
 *
 * The password is read from the PASSWORD environment variable, or generated
 * and printed if unset. It is never passed as an argument, which would leave
 * it in shell history and in `ps` output.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { hashPassword } from "./_core/password";
import { getUserByEmail, upsertUser } from "./db";

async function main() {
  const [emailArg, nameArg] = process.argv.slice(2);
  if (!emailArg) {
    console.error('Usage: pnpm create-user <email> ["Full Name"]');
    console.error("Set PASSWORD=... to choose the password, otherwise one is generated.");
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`Not a valid email address: ${emailArg}`);
    process.exit(1);
  }

  const provided = process.env.PASSWORD;
  if (provided && provided.length < 12) {
    console.error("PASSWORD must be at least 12 characters.");
    process.exit(1);
  }
  const password = provided ?? randomBytes(18).toString("base64url");
  const role = process.env.ADMIN === "true" ? "admin" : "user";

  const existing = await getUserByEmail(email);
  await upsertUser({
    email,
    passwordHash: await hashPassword(password),
    name: nameArg?.trim() || null,
    role,
  });

  console.log(`Account ${existing ? "updated" : "created"}: ${email} (role: ${role})`);
  if (!provided) {
    console.log(`Password: ${password}`);
    console.log("Store it now; it is not recoverable from the database.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
