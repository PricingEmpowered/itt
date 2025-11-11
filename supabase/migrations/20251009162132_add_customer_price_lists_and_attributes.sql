/*
  # Add Customer Price Lists and Attributes

  1. New Tables
    - `customer_price_lists`
      - `id` (bigint, primary key, auto-increment)
      - `customer_id` (text, foreign key to customers)
      - `price_list_id` (text, foreign key to price_lists)
      - `is_default` (boolean) - Whether this is the default price list for customer
      - `priority` (integer) - Priority order if multiple price lists
      - `created_at` (timestamptz) - Creation timestamp
      - Unique constraint on (customer_id, price_list_id)

  2. Table Modifications
    - Add `attributes` column to `customers` table for custom attributes

  3. Security
    - Enable RLS on customer_price_lists table
    - Add policies for authenticated users to manage assignments

  4. Important Notes
    - Customers can have multiple price lists assigned
    - One price list can be marked as default per customer
    - Custom attributes stored as JSONB for flexibility
*/

-- Add attributes column to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'attributes'
  ) THEN
    ALTER TABLE customers ADD COLUMN attributes jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create customer_price_lists junction table
CREATE TABLE IF NOT EXISTS customer_price_lists (
  id bigserial PRIMARY KEY,
  customer_id text NOT NULL,
  price_list_id text NOT NULL,
  is_default boolean DEFAULT false,
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE CASCADE,
  UNIQUE (customer_id, price_list_id)
);

ALTER TABLE customer_price_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customer price lists"
  ON customer_price_lists FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert customer price lists"
  ON customer_price_lists FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update customer price lists"
  ON customer_price_lists FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete customer price lists"
  ON customer_price_lists FOR DELETE
  TO authenticated
  USING (true);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_customer_price_lists_customer_id 
  ON customer_price_lists(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_price_lists_price_list_id 
  ON customer_price_lists(price_list_id);

-- Seed some sample customer-price list assignments
INSERT INTO customer_price_lists (customer_id, price_list_id, is_default, priority)
SELECT 
  c.id,
  pl.id,
  true,
  1
FROM customers c
CROSS JOIN LATERAL (
  SELECT id FROM price_lists ORDER BY random() LIMIT 1
) pl
WHERE NOT EXISTS (
  SELECT 1 FROM customer_price_lists WHERE customer_id = c.id
)
LIMIT 100;

-- Add some sample attributes to customers
UPDATE customers
SET attributes = jsonb_build_object(
  'payment_terms', CASE (random() * 3)::int
    WHEN 0 THEN 'Net 30'
    WHEN 1 THEN 'Net 60'
    ELSE 'Net 90'
  END,
  'credit_limit', (random() * 500000 + 50000)::int,
  'preferred_shipping', CASE (random() * 2)::int
    WHEN 0 THEN 'Ground'
    WHEN 1 THEN 'Express'
    ELSE '2-Day'
  END,
  'account_manager', 'Manager ' || (random() * 10 + 1)::int,
  'vip_customer', random() > 0.8
)
WHERE attributes = '{}'::jsonb OR attributes IS NULL;