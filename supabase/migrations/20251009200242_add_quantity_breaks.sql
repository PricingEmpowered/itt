/*
  # Add Quantity Breaks Feature

  ## Overview
  This migration adds quantity-based pricing breaks to the CPQ system. Quantity breaks
  allow products to have tiered pricing based on the quantity purchased. For example:
  - 1-10 units: $100 each
  - 11-50 units: $90 each (10% discount)
  - 51+ units: $80 each (20% discount)

  ## Changes

  ### 1. New Table: quantity_breaks
    - `id` (uuid, primary key) - Unique identifier
    - `product_id` (text, foreign key) - Links to products table
    - `price_list_id` (text, foreign key, nullable) - Optional link to specific price list
    - `min_quantity` (integer) - Minimum quantity for this break (inclusive)
    - `max_quantity` (integer, nullable) - Maximum quantity (inclusive), NULL means no upper limit
    - `discount_percent` (numeric) - Percentage discount from base/list price
    - `fixed_price` (numeric, nullable) - Alternative: fixed price per unit at this tier
    - `created_at` (timestamptz) - Record creation timestamp
    - `updated_at` (timestamptz) - Last update timestamp

  ### 2. Constraints
    - Ensure min_quantity is positive
    - Ensure max_quantity > min_quantity when not NULL
    - Ensure either discount_percent OR fixed_price is set, not both
    - Unique constraint on (product_id, price_list_id, min_quantity)

  ### 3. Indexes
    - Index on product_id for fast lookups
    - Index on price_list_id for filtered queries
    - Composite index on (product_id, price_list_id) for efficient queries

  ## Security
    - Enable RLS on quantity_breaks table
    - Allow authenticated users to read all quantity breaks
    - Allow authenticated users to insert/update/delete quantity breaks

  ## Usage Example
    Product A (base price $100):
    - Qty 1-10: 0% discount = $100/unit
    - Qty 11-50: 10% discount = $90/unit
    - Qty 51+: 20% discount = $80/unit
*/

-- Create quantity_breaks table
CREATE TABLE IF NOT EXISTS quantity_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_list_id TEXT REFERENCES price_lists(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL CHECK (min_quantity > 0),
  max_quantity INTEGER CHECK (max_quantity IS NULL OR max_quantity >= min_quantity),
  discount_percent NUMERIC(5,2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  fixed_price NUMERIC(12,2) CHECK (fixed_price IS NULL OR fixed_price >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT quantity_breaks_pricing_method CHECK (
    (discount_percent IS NOT NULL AND fixed_price IS NULL) OR
    (discount_percent IS NULL AND fixed_price IS NOT NULL)
  ),
  CONSTRAINT quantity_breaks_unique_range UNIQUE (product_id, price_list_id, min_quantity)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quantity_breaks_product ON quantity_breaks(product_id);
CREATE INDEX IF NOT EXISTS idx_quantity_breaks_price_list ON quantity_breaks(price_list_id);
CREATE INDEX IF NOT EXISTS idx_quantity_breaks_composite ON quantity_breaks(product_id, price_list_id);

-- Enable Row Level Security
ALTER TABLE quantity_breaks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quantity_breaks
CREATE POLICY "Authenticated users can read quantity breaks"
  ON quantity_breaks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert quantity breaks"
  ON quantity_breaks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update quantity breaks"
  ON quantity_breaks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete quantity breaks"
  ON quantity_breaks FOR DELETE
  TO authenticated
  USING (true);

-- Add helpful comments
COMMENT ON TABLE quantity_breaks IS 'Stores quantity-based pricing tiers for products. Allows volume discounts where pricing changes based on quantity ordered.';
COMMENT ON COLUMN quantity_breaks.min_quantity IS 'Minimum quantity (inclusive) for this pricing tier. Must be greater than 0.';
COMMENT ON COLUMN quantity_breaks.max_quantity IS 'Maximum quantity (inclusive) for this pricing tier. NULL means no upper limit (e.g., 51+).';
COMMENT ON COLUMN quantity_breaks.discount_percent IS 'Percentage discount from base price. Use this OR fixed_price, not both.';
COMMENT ON COLUMN quantity_breaks.fixed_price IS 'Fixed price per unit at this tier. Use this OR discount_percent, not both.';

-- Insert sample quantity breaks for demonstration
INSERT INTO quantity_breaks (product_id, price_list_id, min_quantity, max_quantity, discount_percent)
SELECT
  'PROD-001',
  NULL,
  1,
  10,
  0
WHERE EXISTS (SELECT 1 FROM products WHERE id = 'PROD-001')
ON CONFLICT (product_id, price_list_id, min_quantity) DO NOTHING;

INSERT INTO quantity_breaks (product_id, price_list_id, min_quantity, max_quantity, discount_percent)
SELECT
  'PROD-001',
  NULL,
  11,
  50,
  10
WHERE EXISTS (SELECT 1 FROM products WHERE id = 'PROD-001')
ON CONFLICT (product_id, price_list_id, min_quantity) DO NOTHING;

INSERT INTO quantity_breaks (product_id, price_list_id, min_quantity, max_quantity, discount_percent)
SELECT
  'PROD-001',
  NULL,
  51,
  NULL,
  15
WHERE EXISTS (SELECT 1 FROM products WHERE id = 'PROD-001')
ON CONFLICT (product_id, price_list_id, min_quantity) DO NOTHING;
