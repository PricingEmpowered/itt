/*
  # Add Minimum Margin and Maximum Quote Size Authority

  ## Overview
  Extends user_profiles table to include minimum margin requirements and maximum quote size authority
  for discount approval workflows.

  ## Changes
  
  ### Modified Tables
  - `user_profiles`
    - Add `min_margin_percent` (numeric) - Minimum acceptable margin percentage user can approve
    - Add `max_quote_size` (numeric) - Maximum total quote value user can approve
  
  ## Notes
  - Default values are set based on typical approval hierarchies
  - These fields work in conjunction with max_discount_approval
  - All three criteria must be met for a user to approve a quote
*/

-- Add minimum margin and maximum quote size columns to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'min_margin_percent'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN min_margin_percent NUMERIC(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'max_quote_size'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN max_quote_size NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;

-- Update existing users with appropriate limits based on their role
UPDATE user_profiles
SET 
  min_margin_percent = CASE
    WHEN role = 'Sales Rep' THEN 20.00
    WHEN role = 'Sales Manager' THEN 15.00
    WHEN role = 'Director' THEN 10.00
    WHEN role = 'VP Sales' THEN 5.00
    WHEN role = 'Admin' THEN 0.00
    ELSE 20.00
  END,
  max_quote_size = CASE
    WHEN role = 'Sales Rep' THEN 50000.00
    WHEN role = 'Sales Manager' THEN 250000.00
    WHEN role = 'Director' THEN 1000000.00
    WHEN role = 'VP Sales' THEN 5000000.00
    WHEN role = 'Admin' THEN 999999999.99
    ELSE 50000.00
  END
WHERE min_margin_percent IS NULL OR max_quote_size IS NULL OR min_margin_percent = 0 OR max_quote_size = 0;
