/*
  # Add Annual Revenue to Customers

  This migration adds an annual revenue field to the customers table and populates it with
  realistic revenue data based on customer segments and regions.

  1. Changes
    - Add `annual_revenue` column to customers table
    - Populate realistic revenue values based on segment (Enterprise: $5M-$50M, SMB: $500K-$5M)
  
  2. Notes
    - Values are set to realistic annual revenue figures
    - Revenue correlates with customer segment and size
*/

-- Add annual_revenue column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'annual_revenue'
  ) THEN
    ALTER TABLE customers ADD COLUMN annual_revenue NUMERIC(15, 2) DEFAULT 0;
  END IF;
END $$;

-- Update customers with realistic revenue based on segment
UPDATE customers SET annual_revenue = 
  CASE 
    WHEN segment = 'Enterprise' THEN 
      -- Enterprise: $5M to $50M
      (5000000 + (RANDOM() * 45000000))::NUMERIC(15, 2)
    WHEN segment = 'SMB' THEN 
      -- SMB: $500K to $5M
      (500000 + (RANDOM() * 4500000))::NUMERIC(15, 2)
    ELSE 
      -- Default: $1M to $10M
      (1000000 + (RANDOM() * 9000000))::NUMERIC(15, 2)
  END
WHERE annual_revenue = 0 OR annual_revenue IS NULL;
