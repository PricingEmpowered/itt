/*
  # Privileges for the application role

  Supabase granted table privileges to `authenticated` at the platform level,
  so the application migrations almost never issue GRANTs (only 12, all for
  specific views and functions). On a stock PostgreSQL instance the role is
  therefore created with no privileges at all, which would make every query
  fail regardless of RLS.

  This file runs after the schema is in place and grants `authenticated` the
  DML it needs. Row-level security still constrains *which rows* it can touch;
  these grants only decide which tables and operations are reachable.

  Note there is no GRANT for schema-level DDL: the application role cannot
  create, alter or drop objects. Migrations run as the owning role instead.
*/

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO authenticated;

-- Needed for any serial/identity column defaults.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

/*
  Future objects created by the owning role are covered automatically, so a
  later migration that adds a table does not silently become unreadable.
  FOR ROLE names the creating role, which is the role that runs migrations.
*/
DO $$
DECLARE
  owner_role text := current_user;
BEGIN
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public
       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated',
    owner_role
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public
       GRANT USAGE, SELECT ON SEQUENCES TO authenticated',
    owner_role
  );
END
$$;

-- The local auth table: the API reads users to verify logins and updates
-- last_sign_in_at. It must never be readable by the RLS-constrained role,
-- because password hashes live here.
REVOKE ALL ON auth.users FROM authenticated, anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;

/*
  # Remove execute_analytics_query

  This function is a privilege-escalation path and is dropped outright.

  It accepts arbitrary SQL as text and runs it via `EXECUTE format(...)` with
  no validation, under SECURITY DEFINER -- so it executes as the owning role,
  which owns every table and therefore bypasses row-level security completely.
  Its own header comment claims "Only SELECT operations allowed" and
  "Automatically enforces RLS"; neither is true. The Supabase-era frontend
  called it directly from the browser with interpolated query strings.

  Verified against this schema: as `authenticated`, the call
    SELECT execute_analytics_query('SELECT count(*) FROM auth.users')
  returns a count, reading the password-hash table that the REVOKE above
  explicitly denies to that role.

  Revoking EXECUTE is not sufficient, because PostgreSQL grants EXECUTE on
  functions to PUBLIC by default. Dropping it is the only reliable fix. The
  four analytics call sites that used it need typed endpoints instead.

  The other four SECURITY DEFINER functions here (get_dashboard_metrics,
  determine_approval_level, calculate_quote_turnaround_time and
  calculate_deal_score_accuracy) take typed arguments and build no dynamic
  SQL from caller input, so they are left in place.
*/
DROP FUNCTION IF EXISTS execute_analytics_query(text);
