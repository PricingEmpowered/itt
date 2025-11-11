/*
  # Add Product Families and Customer Hierarchies

  1. New Tables
    - `product_families`
      - `id` (text, primary key) - Family identifier
      - `name` (text) - Family name
      - `description` (text) - Family description
      - `parent_family_id` (text, nullable) - Self-referencing for hierarchy
      - `created_at` (timestamptz) - Creation timestamp
    
    - `regions`
      - `id` (text, primary key) - Region identifier
      - `name` (text) - Region name
      - `parent_region_id` (text, nullable) - Self-referencing for hierarchy
      - `created_at` (timestamptz) - Creation timestamp
    
    - `industries`
      - `id` (text, primary key) - Industry identifier
      - `name` (text) - Industry name
      - `parent_industry_id` (text, nullable) - Self-referencing for hierarchy
      - `created_at` (timestamptz) - Creation timestamp

  2. Table Modifications
    - Add `family_id` to `products` table
    - Add `region_id` and `industry_id` to `customers` table

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to read their data
*/

-- Create product_families table
CREATE TABLE IF NOT EXISTS product_families (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text DEFAULT '',
  parent_family_id text,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (parent_family_id) REFERENCES product_families(id) ON DELETE SET NULL
);

ALTER TABLE product_families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view product families"
  ON product_families FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert product families"
  ON product_families FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update product families"
  ON product_families FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete product families"
  ON product_families FOR DELETE
  TO authenticated
  USING (true);

-- Create regions table
CREATE TABLE IF NOT EXISTS regions (
  id text PRIMARY KEY,
  name text NOT NULL,
  parent_region_id text,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (parent_region_id) REFERENCES regions(id) ON DELETE SET NULL
);

ALTER TABLE regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view regions"
  ON regions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert regions"
  ON regions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update regions"
  ON regions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete regions"
  ON regions FOR DELETE
  TO authenticated
  USING (true);

-- Create industries table
CREATE TABLE IF NOT EXISTS industries (
  id text PRIMARY KEY,
  name text NOT NULL,
  parent_industry_id text,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (parent_industry_id) REFERENCES industries(id) ON DELETE SET NULL
);

ALTER TABLE industries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view industries"
  ON industries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert industries"
  ON industries FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update industries"
  ON industries FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete industries"
  ON industries FOR DELETE
  TO authenticated
  USING (true);

-- Add family_id to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'family_id'
  ) THEN
    ALTER TABLE products ADD COLUMN family_id text;
    ALTER TABLE products ADD CONSTRAINT fk_products_family
      FOREIGN KEY (family_id) REFERENCES product_families(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add region_id and industry_id to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'region_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN region_id text;
    ALTER TABLE customers ADD CONSTRAINT fk_customers_region
      FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'industry_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN industry_id text;
    ALTER TABLE customers ADD CONSTRAINT fk_customers_industry
      FOREIGN KEY (industry_id) REFERENCES industries(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Insert sample product families
INSERT INTO product_families (id, name, description, parent_family_id) VALUES
  ('PF-FLOW', 'Flow Control', 'Flow control equipment and systems', NULL),
  ('PF-PUMP', 'Pumps', 'Various pump types and models', 'PF-FLOW'),
  ('PF-VALVE', 'Valves', 'Control and isolation valves', 'PF-FLOW'),
  ('PF-CONTROL', 'Controls & Automation', 'Control systems and automation equipment', NULL),
  ('PF-ACCESS', 'Accessories', 'Supporting equipment and accessories', NULL)
ON CONFLICT (id) DO NOTHING;

-- Insert sample regions
INSERT INTO regions (id, name, parent_region_id) VALUES
  ('RG-GLOBAL', 'Global', NULL),
  ('RG-NA', 'North America', 'RG-GLOBAL'),
  ('RG-NA-US', 'United States', 'RG-NA'),
  ('RG-NA-CA', 'Canada', 'RG-NA'),
  ('RG-EU', 'Europe', 'RG-GLOBAL'),
  ('RG-EU-UK', 'United Kingdom', 'RG-EU'),
  ('RG-EU-DE', 'Germany', 'RG-EU'),
  ('RG-APAC', 'Asia Pacific', 'RG-GLOBAL'),
  ('RG-APAC-CN', 'China', 'RG-APAC'),
  ('RG-APAC-JP', 'Japan', 'RG-APAC')
ON CONFLICT (id) DO NOTHING;

-- Insert sample industries
INSERT INTO industries (id, name, parent_industry_id) VALUES
  ('IND-ALL', 'All Industries', NULL),
  ('IND-MFG', 'Manufacturing', 'IND-ALL'),
  ('IND-MFG-AUTO', 'Automotive', 'IND-MFG'),
  ('IND-MFG-FOOD', 'Food & Beverage', 'IND-MFG'),
  ('IND-OG', 'Oil & Gas', 'IND-ALL'),
  ('IND-OG-UP', 'Upstream', 'IND-OG'),
  ('IND-OG-DOWN', 'Downstream', 'IND-OG'),
  ('IND-WATER', 'Water & Wastewater', 'IND-ALL'),
  ('IND-POWER', 'Power Generation', 'IND-ALL'),
  ('IND-CHEM', 'Chemical Processing', 'IND-ALL')
ON CONFLICT (id) DO NOTHING;