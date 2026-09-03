/*
  # Application database role

  Run this once, as the role that owns the schema, after `npm run db:migrate`.
  Set the password first:

    psql "$DATABASE_URL" -v app_password="'choose-a-real-one'" -f db/app-role.sql

  The server must NOT connect as the owner or a superuser: both bypass
  row-level security, which would silently disable every policy the
  application relies on.
*/

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pricespace_app') THEN
    CREATE ROLE pricespace_app LOGIN;
  END IF;
END
$$;

ALTER ROLE pricespace_app WITH PASSWORD :app_password;

/*
  Application queries run as `authenticated` (the API switches with SET LOCAL
  ROLE per request), so the connecting role must be able to assume it.
*/
GRANT authenticated TO pricespace_app;

/*
  The credential table.

  The API authenticates users itself, so the role it connects as has to read
  `auth.users` to verify a password and stamp last_sign_in_at. This is
  deliberate and is not a hole in the least-privilege setup: `authenticated`
  is still denied this table, and every application query runs as
  `authenticated`. Only the login path, which never switches role, can reach
  it.

  No INSERT or DELETE: accounts are provisioned by `npm run create-user`,
  which connects as the owner.
*/
GRANT USAGE ON SCHEMA auth TO pricespace_app;
GRANT SELECT, UPDATE ON auth.users TO pricespace_app;

-- Documents are written by the API under the requesting user's identity.
GRANT USAGE ON SCHEMA public TO pricespace_app;
