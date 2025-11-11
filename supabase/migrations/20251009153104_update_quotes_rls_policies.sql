/*
  # Update Quote Access Policies

  This migration updates the RLS policies for quotes to allow all authenticated users to view all quotes,
  while maintaining write restrictions to quote owners.

  1. Security Changes
    - DROP existing restrictive SELECT policy
    - CREATE new SELECT policy allowing all authenticated users to view all quotes
    - Keep existing INSERT, UPDATE policies for security
*/

DROP POLICY IF EXISTS "Users can view own quotes" ON quotes;

CREATE POLICY "Users can view all quotes"
  ON quotes
  FOR SELECT
  TO authenticated
  USING (true);
