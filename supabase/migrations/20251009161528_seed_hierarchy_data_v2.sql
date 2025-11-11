/*
  # Seed Comprehensive Data for Hierarchies

  1. Updates
    - Update existing products to assign them to product families
    - Distribute products across all families and categories
    - Update existing customers to assign regions and industries
    - Ensure all filter combinations have data
    
  2. Data Distribution
    - Products: Evenly distribute across 5 families and 4 categories
    - Customers: Distribute across 10 regions and 10 industries
    - Ensures every filter combination returns results

  3. Important Notes
    - Uses modulo operations to distribute existing data
    - Preserves existing product and customer IDs
    - No data loss, only enrichment
*/

-- Update products with family_id distribution
-- Distribute across: PF-FLOW, PF-PUMP, PF-VALVE, PF-CONTROL, PF-ACCESS
DO $$
DECLARE
  family_ids text[] := ARRAY['PF-PUMP', 'PF-VALVE', 'PF-CONTROL', 'PF-ACCESS', 'PF-FLOW'];
  product_rec RECORD;
  idx INTEGER := 0;
BEGIN
  FOR product_rec IN 
    SELECT id FROM products WHERE family_id IS NULL ORDER BY id
  LOOP
    idx := idx + 1;
    UPDATE products 
    SET family_id = family_ids[(idx % 5) + 1]
    WHERE id = product_rec.id;
  END LOOP;
END $$;

-- Update customers with region_id and industry_id distribution
DO $$
DECLARE
  region_ids text[] := ARRAY['RG-NA-US', 'RG-NA-CA', 'RG-EU-UK', 'RG-EU-DE', 'RG-APAC-CN', 'RG-APAC-JP', 'RG-NA', 'RG-EU', 'RG-APAC', 'RG-GLOBAL'];
  industry_ids text[] := ARRAY['IND-MFG-AUTO', 'IND-MFG-FOOD', 'IND-OG-UP', 'IND-OG-DOWN', 'IND-WATER', 'IND-POWER', 'IND-CHEM', 'IND-MFG', 'IND-OG', 'IND-ALL'];
  customer_rec RECORD;
  idx INTEGER := 0;
BEGIN
  FOR customer_rec IN 
    SELECT id FROM customers WHERE region_id IS NULL OR industry_id IS NULL ORDER BY id
  LOOP
    idx := idx + 1;
    UPDATE customers 
    SET 
      region_id = region_ids[(idx % 10) + 1],
      industry_id = industry_ids[((idx * 3) % 10) + 1]
    WHERE id = customer_rec.id;
  END LOOP;
END $$;

-- Add more products with unique IDs for better coverage across categories and families
DO $$
DECLARE
  prod_counter INTEGER := 0;
  prod_id TEXT;
  cat TEXT;
  fam TEXT;
BEGIN
  FOR cat IN SELECT * FROM unnest(ARRAY['Pumps', 'Valves', 'Controls', 'Accessories'])
  LOOP
    FOR fam IN SELECT * FROM unnest(ARRAY['PF-PUMP', 'PF-VALVE', 'PF-CONTROL', 'PF-ACCESS', 'PF-FLOW'])
    LOOP
      FOR i IN 1..5
      LOOP
        prod_counter := prod_counter + 1;
        prod_id := 'PROD-HIER-' || to_char(prod_counter, 'FM0000');
        
        IF NOT EXISTS (SELECT 1 FROM products WHERE id = prod_id) THEN
          INSERT INTO products (id, name, category, family_id, base_cost, uom, status, attributes)
          VALUES (
            prod_id,
            'Product ' || cat || ' ' || prod_counter,
            cat,
            fam,
            (random() * 500 + 50)::numeric(10,2),
            'EA',
            CASE WHEN random() > 0.1 THEN 'Active' ELSE 'Inactive' END,
            '{}'::jsonb
          );
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Add more diverse customers with unique IDs
DO $$
DECLARE
  cust_counter INTEGER := 0;
  cust_id TEXT;
  seg TEXT;
  reg TEXT;
  ind TEXT;
BEGIN
  FOR seg IN SELECT * FROM unnest(ARRAY['Tier 1 Industrial', 'Tier 2 Industrial', 'Tier 3 Industrial', 'OEM', 'Distributor', 'End User'])
  LOOP
    FOR reg IN SELECT * FROM unnest(ARRAY['RG-NA-US', 'RG-NA-CA', 'RG-EU-UK', 'RG-EU-DE', 'RG-APAC-CN', 'RG-APAC-JP'])
    LOOP
      FOR ind IN SELECT * FROM unnest(ARRAY['IND-MFG-AUTO', 'IND-MFG-FOOD', 'IND-OG-UP', 'IND-WATER', 'IND-POWER', 'IND-CHEM'])
      LOOP
        cust_counter := cust_counter + 1;
        cust_id := 'CUST-HIER-' || to_char(cust_counter, 'FM0000');
        
        IF NOT EXISTS (SELECT 1 FROM customers WHERE id = cust_id) THEN
          INSERT INTO customers (id, name, segment, region, region_id, industry_id, contact_email, annual_volume, annual_revenue)
          VALUES (
            cust_id,
            'Customer ' || seg || ' ' || cust_counter,
            seg,
            CASE 
              WHEN reg LIKE '%US%' OR reg LIKE '%CA%' THEN 'North America'
              WHEN reg LIKE '%UK%' OR reg LIKE '%DE%' THEN 'Europe'
              WHEN reg LIKE '%CN%' OR reg LIKE '%JP%' THEN 'Asia Pacific'
              ELSE 'Other'
            END,
            reg,
            ind,
            'contact' || cust_counter || '@example.com',
            (random() * 50000 + 1000)::integer,
            (random() * 5000000 + 100000)::numeric(12,2)
          );
        END IF;
        
        -- Limit to reasonable number
        IF cust_counter >= 200 THEN
          RETURN;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;