/*
  # Add Services and SLA Support

  1. New Tables
    - `services`
      - Core service catalog with SLA levels
      - Pricing based on days, hours, and response time
      - Active/inactive status
    
    - `service_sla_tiers`
      - Defines SLA tier combinations
      - Coverage days (5 or 7 days/week)
      - Hours per day (8, 12, or 24 hours)
      - Response time guarantees (6h, 1d, 2d)
    
    - `quote_services`
      - Links services to quotes
      - Tracks pricing and discounts like products
      - Supports deal scoring

  2. Changes
    - Extend quotes to support mixed product and service line items
    - Add service-specific fields for SLA tracking

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
*/

-- Service SLA Tiers Table
CREATE TABLE IF NOT EXISTS service_sla_tiers (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  coverage_days integer CHECK (coverage_days IN (5, 7)) NOT NULL,
  hours_per_day integer CHECK (hours_per_day IN (8, 12, 24)) NOT NULL,
  response_time_hours integer CHECK (response_time_hours IN (6, 24, 48)) NOT NULL,
  response_time_label text NOT NULL,
  list_price_annual decimal(15,2) NOT NULL,
  list_price_monthly decimal(15,2) NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE service_sla_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view SLA tiers"
  ON service_sla_tiers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert SLA tiers"
  ON service_sla_tiers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update SLA tiers"
  ON service_sla_tiers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Services Table
CREATE TABLE IF NOT EXISTS services (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text DEFAULT 'Support Services',
  sla_tier_id text REFERENCES service_sla_tiers(id),
  base_price_annual decimal(15,2) NOT NULL,
  base_price_monthly decimal(15,2) NOT NULL,
  unit text DEFAULT 'per contract',
  is_active boolean DEFAULT true,
  features jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view services"
  ON services FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update services"
  ON services FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Quote Services (Line Items)
CREATE TABLE IF NOT EXISTS quote_services (
  id bigserial PRIMARY KEY,
  quote_id text REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  service_id text REFERENCES services(id) NOT NULL,
  billing_period text CHECK (billing_period IN ('monthly', 'annual')) DEFAULT 'annual',
  quantity integer DEFAULT 1,
  unit_price decimal(15,2) NOT NULL,
  discount_applied decimal(15,2) DEFAULT 0,
  line_total decimal(15,2) NOT NULL,
  contract_term_months integer DEFAULT 12,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quote_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quote services"
  ON quote_services FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert quote services"
  ON quote_services FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update quote services"
  ON quote_services FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete quote services"
  ON quote_services FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_services_sla_tier ON services(sla_tier_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);
CREATE INDEX IF NOT EXISTS idx_quote_services_quote_id ON quote_services(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_services_service_id ON quote_services(service_id);

-- Insert SLA Tiers
INSERT INTO service_sla_tiers (id, name, description, coverage_days, hours_per_day, response_time_hours, response_time_label, list_price_annual, list_price_monthly, is_active)
VALUES
  -- 5 Days / 8 Hours
  ('SLA-5D-8H-2D', 'Business Hours Basic', '5 days/week, 8 hours/day, 2-day response', 5, 8, 48, 'Within 2 Days', 12000.00, 1100.00, true),
  ('SLA-5D-8H-1D', 'Business Hours Standard', '5 days/week, 8 hours/day, 1-day response', 5, 8, 24, 'Within 1 Day', 18000.00, 1650.00, true),
  ('SLA-5D-8H-6H', 'Business Hours Premium', '5 days/week, 8 hours/day, 6-hour response', 5, 8, 6, 'Within 6 Hours', 24000.00, 2200.00, true),
  
  -- 5 Days / 12 Hours
  ('SLA-5D-12H-2D', 'Extended Hours Basic', '5 days/week, 12 hours/day, 2-day response', 5, 12, 48, 'Within 2 Days', 18000.00, 1650.00, true),
  ('SLA-5D-12H-1D', 'Extended Hours Standard', '5 days/week, 12 hours/day, 1-day response', 5, 12, 24, 'Within 1 Day', 27000.00, 2475.00, true),
  ('SLA-5D-12H-6H', 'Extended Hours Premium', '5 days/week, 12 hours/day, 6-hour response', 5, 12, 6, 'Within 6 Hours', 36000.00, 3300.00, true),
  
  -- 5 Days / 24 Hours
  ('SLA-5D-24H-2D', 'Weekday 24/7 Basic', '5 days/week, 24 hours/day, 2-day response', 5, 24, 48, 'Within 2 Days', 30000.00, 2750.00, true),
  ('SLA-5D-24H-1D', 'Weekday 24/7 Standard', '5 days/week, 24 hours/day, 1-day response', 5, 24, 24, 'Within 1 Day', 45000.00, 4125.00, true),
  ('SLA-5D-24H-6H', 'Weekday 24/7 Premium', '5 days/week, 24 hours/day, 6-hour response', 5, 24, 6, 'Within 6 Hours', 60000.00, 5500.00, true),
  
  -- 7 Days / 8 Hours
  ('SLA-7D-8H-2D', 'Every Day Basic', '7 days/week, 8 hours/day, 2-day response', 7, 8, 48, 'Within 2 Days', 16800.00, 1540.00, true),
  ('SLA-7D-8H-1D', 'Every Day Standard', '7 days/week, 8 hours/day, 1-day response', 7, 8, 24, 'Within 1 Day', 25200.00, 2310.00, true),
  ('SLA-7D-8H-6H', 'Every Day Premium', '7 days/week, 8 hours/day, 6-hour response', 7, 8, 6, 'Within 6 Hours', 33600.00, 3080.00, true),
  
  -- 7 Days / 12 Hours
  ('SLA-7D-12H-2D', 'Extended 7-Day Basic', '7 days/week, 12 hours/day, 2-day response', 7, 12, 48, 'Within 2 Days', 25200.00, 2310.00, true),
  ('SLA-7D-12H-1D', 'Extended 7-Day Standard', '7 days/week, 12 hours/day, 1-day response', 7, 12, 24, 'Within 1 Day', 37800.00, 3465.00, true),
  ('SLA-7D-12H-6H', 'Extended 7-Day Premium', '7 days/week, 12 hours/day, 6-hour response', 7, 12, 6, 'Within 6 Hours', 50400.00, 4620.00, true),
  
  -- 7 Days / 24 Hours
  ('SLA-7D-24H-2D', 'Full 24/7 Basic', '7 days/week, 24 hours/day, 2-day response', 7, 24, 48, 'Within 2 Days', 42000.00, 3850.00, true),
  ('SLA-7D-24H-1D', 'Full 24/7 Standard', '7 days/week, 24 hours/day, 1-day response', 7, 24, 24, 'Within 1 Day', 63000.00, 5775.00, true),
  ('SLA-7D-24H-6H', 'Full 24/7 Premium', '7 days/week, 24 hours/day, 6-hour response', 7, 24, 6, 'Within 6 Hours', 84000.00, 7700.00, true)
ON CONFLICT (id) DO NOTHING;

-- Insert Sample Services
INSERT INTO services (id, name, description, category, sla_tier_id, base_price_annual, base_price_monthly, features)
VALUES
  ('SVC-5D-8H-2D', 'Business Hours Basic Support', 'Standard business hours support with 2-day response SLA', 'Support Services', 'SLA-5D-8H-2D', 12000.00, 1100.00, 
   '["Email support", "Phone support (business hours)", "Knowledge base access", "Monthly reports", "Quarterly reviews"]'::jsonb),
  
  ('SVC-5D-8H-1D', 'Business Hours Standard Support', 'Enhanced business hours support with 1-day response SLA', 'Support Services', 'SLA-5D-8H-1D', 18000.00, 1650.00,
   '["Email support", "Priority phone support", "Knowledge base access", "Bi-weekly reports", "Monthly reviews", "Dedicated support contact"]'::jsonb),
  
  ('SVC-5D-8H-6H', 'Business Hours Premium Support', 'Premium business hours support with 6-hour response SLA', 'Support Services', 'SLA-5D-8H-6H', 24000.00, 2200.00,
   '["Priority email support", "Priority phone support", "24/7 emergency escalation", "Weekly reports", "Bi-weekly reviews", "Named account manager", "Custom training sessions"]'::jsonb),
  
  ('SVC-7D-24H-1D', 'Full 24/7 Standard Support', 'Around-the-clock support with 1-day response SLA', 'Support Services', 'SLA-7D-24H-1D', 63000.00, 5775.00,
   '["24/7 email support", "24/7 phone support", "Instant emergency escalation", "Real-time monitoring", "Daily reports", "Weekly reviews", "Dedicated team", "Proactive maintenance"]'::jsonb),
  
  ('SVC-7D-24H-6H', 'Full 24/7 Premium Support', 'Enterprise-grade 24/7 support with 6-hour response SLA', 'Support Services', 'SLA-7D-24H-6H', 84000.00, 7700.00,
   '["24/7 priority support all channels", "Instant emergency response", "Real-time monitoring with alerts", "Daily detailed reports", "Daily reviews", "Dedicated senior team", "Proactive maintenance", "Architecture consulting", "Custom SLA terms"]'::jsonb)
ON CONFLICT (id) DO NOTHING;
