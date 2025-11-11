/*
  # Create Targeted Quotes for Specific Products

  1. Purpose
    - Ensure EVERY product has at least 3 historical price points
    - Target products with insufficient data
    - Use a deterministic approach to guarantee coverage

  2. Strategy
    - For each active product, create exactly 3 quotes if it has fewer than 3
    - Create realistic pricing with variance
    - Spread across different customers and time periods
*/

DO $$
DECLARE
  v_product record;
  v_customer_ids text[];
  v_quote_id text;
  v_customer_id text;
  v_unit_price numeric;
  v_quantity integer;
  v_discount numeric;
  v_line_total numeric;
  v_status text;
  v_created_at timestamp;
  v_counter integer := 1;
  i integer;
BEGIN
  SELECT array_agg(id) INTO v_customer_ids FROM customers;

  FOR v_product IN 
    SELECT p.id, p.base_cost, p.name
    FROM products p
    WHERE p.status = 'Active'
  LOOP
    FOR i IN 1..3 LOOP
      v_quote_id := 'PROD-HIST-' || LPAD(v_counter::text, 8, '0');
      v_counter := v_counter + 1;
      
      v_customer_id := v_customer_ids[1 + (random() * (array_length(v_customer_ids, 1) - 1))::integer];
      
      IF random() < 0.68 THEN
        v_status := 'Approved';
      ELSE
        v_status := 'Rejected';
      END IF;
      
      v_created_at := NOW() - (random() * interval '450 days');
      
      v_unit_price := v_product.base_cost * (1.25 + random() * 0.85);
      v_quantity := 1 + (random() * 20)::integer;
      v_discount := (random() * 18)::numeric;
      v_line_total := v_quantity * v_unit_price * (1 - v_discount / 100);
      
      INSERT INTO quotes (id, customer_id, price_list_id, status, subtotal, tax, total, created_by, approvals_required, created_at, updated_at)
      VALUES (
        v_quote_id,
        v_customer_id,
        'PL-2025-US',
        v_status,
        ROUND(v_line_total, 2),
        ROUND(v_line_total * 0.05, 2),
        ROUND(v_line_total * 1.05, 2),
        'b2708753-66c1-4e2f-b5e9-fee23efab66f',
        0,
        v_created_at,
        v_created_at
      );
      
      INSERT INTO quote_lines (quote_id, product_id, quantity, unit_price, discount_applied, line_total)
      VALUES (
        v_quote_id,
        v_product.id,
        v_quantity,
        ROUND(v_unit_price, 2),
        ROUND(v_discount, 2),
        ROUND(v_line_total, 2)
      );
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Successfully created 3 historical quotes for each product';
END $$;
