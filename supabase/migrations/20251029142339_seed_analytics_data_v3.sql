/*
  # Seed Analytics Data

  Populates the analytics tables with sample data for the past 12 months to support
  all four analytics modules: Business Performance, Price Performance, Quote Funnel, 
  and Price Waterfall Analysis.
*/

-- Seed Business Performance (last 12 months)
INSERT INTO analytics_business_performance (
  period_start, period_end, period_type, product_family, region, channel,
  revenue, revenue_change_pct, active_quotes, active_quotes_change_pct,
  win_rate, win_rate_change_pct, active_customers, active_customers_change_pct,
  price_index, cost_index, value_gap_pct, margin_total,
  margin_from_price, margin_from_cost, margin_from_volume,
  margin_from_new_business, margin_from_lost_business
) VALUES
-- March 2023
('2023-03-01', '2023-03-31', 'month', NULL, NULL, NULL, 1850000, NULL, 220, NULL, 72.5, NULL, 1205, NULL, 98.5, 97.2, 1.34, 647500, 185000, -75000, 125000, 145000, -95000),
-- April 2023
('2023-04-01', '2023-04-30', 'month', NULL, NULL, NULL, 1925000, 4.05, 225, 2.27, 73.2, 0.96, 1218, 1.08, 99.8, 97.8, 2.04, 673750, 198000, -68000, 135000, 158000, -88000),
-- May 2023
('2023-05-01', '2023-05-31', 'month', NULL, NULL, NULL, 2000000, 3.90, 230, 2.22, 73.8, 0.82, 1225, 0.57, 101.2, 98.5, 2.74, 700000, 215000, -55000, 142000, 175000, -82000),
-- June 2023
('2023-06-01', '2023-06-30', 'month', NULL, NULL, NULL, 2075000, 3.75, 235, 2.17, 74.3, 0.68, 1231, 0.49, 102.5, 99.1, 3.43, 726250, 228000, -48000, 148000, 185000, -78000),
-- July 2023
('2023-07-01', '2023-07-31', 'month', NULL, NULL, NULL, 2150000, 3.61, 240, 2.13, 74.8, 0.67, 1238, 0.57, 103.8, 99.8, 4.01, 752500, 242000, -42000, 155000, 195000, -75000),
-- August 2023
('2023-08-01', '2023-08-31', 'month', NULL, NULL, NULL, 2200000, 2.33, 242, 0.83, 75.2, 0.53, 1242, 0.32, 105.1, 100.5, 4.58, 770000, 255000, -35000, 162000, 205000, -72000),
-- September 2023
('2023-09-01', '2023-09-30', 'month', NULL, NULL, NULL, 2250000, 2.27, 245, 1.24, 75.5, 0.40, 1245, 0.24, 106.4, 101.2, 5.14, 787500, 268000, -28000, 168000, 218000, -68000),
-- October 2023
('2023-10-01', '2023-10-31', 'month', NULL, NULL, NULL, 2300000, 2.22, 248, 1.22, 75.8, 0.40, 1248, 0.24, 107.7, 101.9, 5.69, 805000, 280000, -22000, 175000, 228000, -65000),
-- November 2023
('2023-11-01', '2023-11-30', 'month', NULL, NULL, NULL, 2350000, 2.17, 250, 0.81, 76.0, 0.26, 1250, 0.16, 109.0, 102.6, 6.24, 822500, 295000, -18000, 182000, 238000, -62000),
-- December 2023
('2023-12-01', '2023-12-31', 'month', NULL, NULL, NULL, 2400000, 2.13, 245, -2.00, 75.0, -1.32, 1242, -0.64, 110.3, 103.3, 6.78, 840000, 308000, -12000, 188000, 248000, -58000)
ON CONFLICT DO NOTHING;

-- Seed Quote Funnel (last 6 months)
INSERT INTO analytics_quote_funnel (
  period_start, period_end, period_type, region, channel, segment,
  business_type, stage, quote_count, quote_value, average_value,
  win_rate, average_cycle_time_days, conversion_rate
) VALUES
-- August 2023 - New Business
('2023-08-01', '2023-08-31', 'month', NULL, NULL, NULL, 'new', 'technical_review', 155, 2450000, 15806, 28.0, 45, 28.0),
('2023-08-01', '2023-08-31', 'month', NULL, NULL, NULL, 'new', 'negotiation', 108, 1715000, 15880, 28.0, 45, 28.0),
('2023-08-01', '2023-08-31', 'month', NULL, NULL, NULL, 'new', 'won', 43, 686000, 15953, 28.0, 45, 28.0),
('2023-08-01', '2023-08-31', 'month', NULL, NULL, NULL, 'new', 'lost', 65, 1029000, 15831, 28.0, 45, 28.0),
-- August 2023 - Repeat Business
('2023-08-01', '2023-08-31', 'month', NULL, NULL, NULL, 'repeat', 'technical_review', 285, 4850000, 17018, 42.0, 32, 42.0),
('2023-08-01', '2023-08-31', 'month', NULL, NULL, NULL, 'repeat', 'negotiation', 199, 3395000, 17060, 42.0, 32, 42.0),
('2023-08-01', '2023-08-31', 'month', NULL, NULL, NULL, 'repeat', 'won', 119, 2037000, 17117, 42.0, 32, 42.0),
('2023-08-01', '2023-08-31', 'month', NULL, NULL, NULL, 'repeat', 'lost', 80, 1358000, 16975, 42.0, 32, 42.0),
-- October 2023 - New Business
('2023-10-01', '2023-10-31', 'month', NULL, NULL, NULL, 'new', 'technical_review', 158, 2480000, 15696, 28.0, 45, 28.0),
('2023-10-01', '2023-10-31', 'month', NULL, NULL, NULL, 'new', 'negotiation', 110, 1736000, 15782, 28.0, 45, 28.0),
('2023-10-01', '2023-10-31', 'month', NULL, NULL, NULL, 'new', 'won', 44, 694000, 15773, 28.0, 45, 28.0),
('2023-10-01', '2023-10-31', 'month', NULL, NULL, NULL, 'new', 'lost', 66, 1042000, 15788, 28.0, 45, 28.0),
-- October 2023 - Repeat Business
('2023-10-01', '2023-10-31', 'month', NULL, NULL, NULL, 'repeat', 'technical_review', 288, 4900000, 17014, 42.0, 32, 42.0),
('2023-10-01', '2023-10-31', 'month', NULL, NULL, NULL, 'repeat', 'negotiation', 201, 3430000, 17065, 42.0, 32, 42.0),
('2023-10-01', '2023-10-31', 'month', NULL, NULL, NULL, 'repeat', 'won', 120, 2058000, 17150, 42.0, 32, 42.0),
('2023-10-01', '2023-10-31', 'month', NULL, NULL, NULL, 'repeat', 'lost', 81, 1372000, 16938, 42.0, 32, 42.0),
-- December 2023 - New Business
('2023-12-01', '2023-12-31', 'month', NULL, NULL, NULL, 'new', 'technical_review', 156, 2450000, 15705, 28.0, 45, 28.0),
('2023-12-01', '2023-12-31', 'month', NULL, NULL, NULL, 'new', 'negotiation', 109, 1715000, 15734, 28.0, 45, 28.0),
('2023-12-01', '2023-12-31', 'month', NULL, NULL, NULL, 'new', 'won', 43, 686000, 15814, 28.0, 45, 28.0),
('2023-12-01', '2023-12-31', 'month', NULL, NULL, NULL, 'new', 'lost', 66, 1029000, 15591, 28.0, 45, 28.0),
-- December 2023 - Repeat Business
('2023-12-01', '2023-12-31', 'month', NULL, NULL, NULL, 'repeat', 'technical_review', 284, 4850000, 17077, 42.0, 32, 42.0),
('2023-12-01', '2023-12-31', 'month', NULL, NULL, NULL, 'repeat', 'negotiation', 198, 3395000, 17146, 42.0, 32, 42.0),
('2023-12-01', '2023-12-31', 'month', NULL, NULL, NULL, 'repeat', 'won', 119, 2037000, 17118, 42.0, 32, 42.0),
('2023-12-01', '2023-12-31', 'month', NULL, NULL, NULL, 'repeat', 'lost', 79, 1358000, 17190, 42.0, 32, 42.0)
ON CONFLICT DO NOTHING;

-- Seed Price Waterfall (current period)
INSERT INTO analytics_price_waterfall (
  period_start, period_end, product_family, region, channel, segment,
  list_price, volume_discount, contract_discount, promotional_discount,
  invoice_price, rebates, payment_terms, freight, pocket_price
) VALUES
('2023-12-01', '2023-12-31', NULL, NULL, NULL, NULL, 1000000, 65000, 48000, 22000, 865000, 26000, 13000, 21000, 805000)
ON CONFLICT DO NOTHING;

-- Seed Price Performance (sample products for Pareto analysis)
DO $$
DECLARE
  product_record RECORD;
  idx INTEGER := 1;
  cumulative_pct NUMERIC := 0;
  total_sales NUMERIC := 14165000;
  sales_val NUMERIC;
  sales_pct NUMERIC;
  pareto_cat TEXT;
BEGIN
  FOR product_record IN 
    SELECT id, name 
    FROM products 
    WHERE id IS NOT NULL
    ORDER BY random()
    LIMIT 50
  LOOP
    sales_val := CASE 
      WHEN idx <= 5 THEN 950000 - (idx - 1) * 100000
      WHEN idx <= 10 THEN 500000 - (idx - 6) * 50000
      WHEN idx <= 20 THEN 250000 - (idx - 11) * 20000
      WHEN idx <= 35 THEN 70000 - (idx - 21) * 5000
      ELSE 30000 - (idx - 36) * 2000
    END;

    sales_pct := (sales_val / total_sales) * 100;
    cumulative_pct := cumulative_pct + sales_pct;
      
    IF cumulative_pct <= 68.6 THEN
      pareto_cat := 'A';
    ELSIF cumulative_pct <= 89.2 THEN
      pareto_cat := 'B';
    ELSIF cumulative_pct <= 96.6 THEN
      pareto_cat := 'C';
    ELSE
      pareto_cat := 'D';
    END IF;

    INSERT INTO analytics_price_performance (
      period_start, period_end, product_id, product_family, product_category,
      part_number, sales, margin_at_list_pct, price_premium_vs_comp_a,
      price_premium_vs_comp_b, price_premium_vs_comp_c, price_premium_vs_comp_d,
      pareto_category, pareto_cumulative_pct, average_discount_pct,
      discount_type, discount_type_sales_pct
    ) VALUES (
      '2023-12-01', '2023-12-31', product_record.id,
      (ARRAY['Aerospace & Defense', 'Automotive Technologies', 'Industrial Process', 'Motion Technologies', 'Connect & Control'])[(idx % 5) + 1],
      'Category ' || chr(65 + (idx % 5)),
      'PART-' || product_record.id || '-' || lpad(idx::text, 4, '0'),
      sales_val,
      20 + (random() * 55)::numeric,
      -15 + (random() * 33)::numeric,
      -12 + (random() * 27)::numeric,
      -10 + (random() * 30)::numeric,
      -18 + (random() * 30)::numeric,
      pareto_cat,
      ROUND(cumulative_pct::numeric, 2),
      (5 + (random() * 25))::numeric,
      (ARRAY['list_price', 'standard', 'custom'])[(idx % 3) + 1],
      (20 + (random() * 40))::numeric
    );

    idx := idx + 1;
  END LOOP;
END $$;