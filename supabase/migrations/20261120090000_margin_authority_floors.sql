/*
  # Minimum margins before a quote needs approval

  An analyst may quote at or above a minimum margin on their own authority.
  Below it, the quote has to be escalated for approval. ITT sets that margin
  by product line and region, and it differs by level of authority (the
  delegation of authority is still to come, which is why the level is part of
  the key and not an assumption).

  ## What this replaces

  `pricing_rules_config.minimum_margin` held one figure for everything,
  defaulting to 20% from the original specification. Nothing ever confirmed
  it, and a single number cannot express "57% for one product line, 20% for
  another". That column is left in place but the pricing path no longer reads
  it.

  ## The placeholder

  ITT's table of margins by product line has not been fully supplied: some
  cells point at an Asia column that has not been sent. Until it is, one
  default row applies to every product line and region at 30%. It is flagged
  `is_placeholder` so that the screen can say so, and so that nobody mistakes
  it for a confirmed figure.

  ## Which row applies

  Most specific wins. For a line in a given product line and region the order
  is: that product line in that region, that product line anywhere, any
  product line in that region, then the default. '*' means "any".

  ## Not a hard stop

  The margin is the point below which approval is needed, not a price nobody
  may quote. A price under it can still go out once it has been escalated.
  Nothing here prevents that, and pricing does not raise a recommendation up
  to it.
*/

CREATE TABLE IF NOT EXISTS margin_authority_floors (
  authority_level text NOT NULL DEFAULT 'analyst',
  /* Matched ignoring case and spacing. '*' means any product line. */
  product_line    text NOT NULL DEFAULT '*',
  region          text NOT NULL DEFAULT '*'
    CHECK (region IN ('*', 'North America', 'Europe', 'Asia Pacific')),
  /* A fraction: 0.30 means 30%. */
  minimum_margin  numeric NOT NULL
    CHECK (minimum_margin >= 0 AND minimum_margin < 1),
  is_placeholder  boolean NOT NULL DEFAULT false,
  note            text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (authority_level, product_line, region)
);

COMMENT ON TABLE margin_authority_floors IS
  'Minimum margin at which a level of authority may quote without approval. Most specific row wins; ''*'' means any.';
COMMENT ON COLUMN margin_authority_floors.minimum_margin IS
  'Fraction, not a percentage: 0.30 is 30%.';
COMMENT ON COLUMN margin_authority_floors.is_placeholder IS
  'True for a stand-in figure that ITT has not confirmed.';

INSERT INTO margin_authority_floors
  (authority_level, product_line, region, minimum_margin, is_placeholder, note)
VALUES
  ('analyst', '*', '*', 0.30, true,
   'Placeholder for every product line and region until ITT confirms margins by product line.')
ON CONFLICT (authority_level, product_line, region) DO NOTHING;

ALTER TABLE margin_authority_floors ENABLE ROW LEVEL SECURITY;

/* Everyone signed in needs to read it, since every priced quote does. */
DROP POLICY IF EXISTS "Authenticated users can read margin floors" ON margin_authority_floors;
CREATE POLICY "Authenticated users can read margin floors"
  ON margin_authority_floors FOR SELECT
  TO authenticated
  USING (true);

/*
 * Only administrators change what counts as within someone's authority. The
 * check is case-insensitive because both 'Admin' and 'admin' exist in
 * user_profiles.role, and a policy that matched only one would lock out the
 * other without any error.
 */
DROP POLICY IF EXISTS "Admins can insert margin floors" ON margin_authority_floors;
CREATE POLICY "Admins can insert margin floors"
  ON margin_authority_floors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
       WHERE id = (SELECT auth.uid()) AND lower(role) = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update margin floors" ON margin_authority_floors;
CREATE POLICY "Admins can update margin floors"
  ON margin_authority_floors FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
       WHERE id = (SELECT auth.uid()) AND lower(role) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
       WHERE id = (SELECT auth.uid()) AND lower(role) = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete margin floors" ON margin_authority_floors;
CREATE POLICY "Admins can delete margin floors"
  ON margin_authority_floors FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
       WHERE id = (SELECT auth.uid()) AND lower(role) = 'admin'
    )
  );
