/*
  # Demo data prerequisites

  The four historical-quote seeds that run after this file were authored
  against the original Supabase project and assume two rows that no schema
  migration creates:

    - the `PL-2025-US` price list every seeded quote is priced against
    - the `auth.users` row their hardcoded `created_by` points at

  Without these the seeds fail on foreign keys. They are demo data, so they
  live here rather than in the schema chain: a production install skips this
  directory entirely and starts with an empty quote history.

  The demo user is deliberately unusable for login: `encrypted_password` holds
  a literal that is not a valid argon2 hash, so no password can verify against
  it, and `is_active` is false. Real accounts are created through the API.
*/

INSERT INTO auth.users (id, email, encrypted_password, full_name, is_active)
VALUES (
  'b2708753-66c1-4e2f-b5e9-fee23efab66f',
  'demo-seed@example.invalid',
  'disabled:seed-account-cannot-authenticate',
  'Demo Seed Account',
  false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO price_lists (id, name, currency, effective_from, version)
VALUES ('PL-2025-US', 'US List 2025', 'USD', DATE '2025-01-01', 1)
ON CONFLICT (id) DO NOTHING;
