/*
  # On-premise bootstrap

  The 47 application migrations in supabase/migrations were authored against
  Supabase, so they reference objects Supabase provides out of the box:

    - the `authenticated` and `anon` roles that every RLS policy targets
    - the `auth` schema, `auth.users`, and `auth.uid()`
    - the `storage` schema (one migration registers a documents bucket)

  This migration creates local equivalents so those migrations apply unchanged
  to a stock PostgreSQL instance. Keeping them unchanged matters: it preserves
  all 206 row-level security policies, which continue to work as
  defense-in-depth behind the API rather than being deleted.

  `auth.uid()` reads the `app.current_user_id` session setting, which the API
  sets per request from the verified session cookie.
*/

-- Roles targeted by the application's RLS policies. NOLOGIN: nothing connects
-- as these directly; the API's own role assumes `authenticated` per request.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;

/*
  Local user store. Replaces Supabase Auth: `encrypted_password` holds a
  scrypt hash written by the API, never a plaintext or reversible value.
  Column names mirror Supabase's so the existing foreign keys and the one
  `SELECT email FROM auth.users` policy keep working verbatim.
*/
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  encrypted_password text NOT NULL,
  full_name text,
  is_active boolean NOT NULL DEFAULT true,
  last_sign_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users (lower(email));

/*
  The current request's user id, or NULL when unauthenticated.

  STABLE (not IMMUTABLE) because it varies with session state, and
  `missing_ok => true` so it returns NULL instead of erroring when the API
  has not set it. Kept out of the search_path to avoid shadowing.
*/
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

/*
  Minimal `storage` shim. On-premise, document bytes live on the server's
  filesystem and are served by the API, so these tables exist only so the
  document-storage migration applies cleanly; they stay empty. The bucket row
  records the configured bucket name for parity.
*/
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets (id),
  name text NOT NULL,
  owner uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Supabase helper used by the bucket's RLS policies: splits an object path
-- into its folder segments, dropping the trailing filename.
CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;
