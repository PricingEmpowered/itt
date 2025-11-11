/*
  # Allow viewing historical quote lines for price guidance

  1. Changes
    - Add new SELECT policy on quote_lines table to allow authenticated users to view 
      quote lines from Approved or Rejected quotes for price guidance purposes
    - This enables the price guidance feature to show competitive pricing data
  
  2. Security
    - Only allows viewing quote lines from finalized quotes (Approved/Rejected status)
    - Does not expose draft or pending quotes
    - Users still can only modify their own quote lines (existing policies unchanged)
*/

-- Add policy to allow viewing quote lines from approved/rejected quotes for price guidance
CREATE POLICY "Users can view quote lines for approved/rejected quotes"
  ON quote_lines
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM quotes
      WHERE quotes.id = quote_lines.quote_id
      AND quotes.status IN ('Approved', 'Rejected')
    )
  );