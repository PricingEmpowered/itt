/*
  # Add Multi-Currency Support

  1. New Tables
    - `currencies`
      - `id` (uuid, primary key)
      - `code` (text) - ISO 4217 currency code (USD, EUR, GBP, etc.)
      - `name` (text) - Full currency name
      - `symbol` (text) - Currency symbol ($, €, £, etc.)
      - `is_active` (boolean) - Whether currency is available for use
      - `created_at` (timestamp)
    
    - `exchange_rates`
      - `id` (uuid, primary key)
      - `from_currency` (text) - Base currency code
      - `to_currency` (text) - Target currency code
      - `rate` (numeric) - Exchange rate
      - `date` (date) - Date of the exchange rate
      - `created_at` (timestamp)
      - Unique constraint on (from_currency, to_currency, date)

  2. Schema Changes
    - Add `currency_id` to `price_lists` table (references currencies)
    - Add `currency_id` to `quotes` table (references currencies)
    - Add `exchange_rate` to `quotes` table (for historical tracking)
    - Default currency is USD for existing records

  3. Security
    - Enable RLS on `currencies` table
    - Enable RLS on `exchange_rates` table
    - Add policies for authenticated users to read currency data
    - Add policies for authenticated users to read exchange rates

  4. Initial Data
    - Seed common currencies (USD, EUR, GBP, CAD, AUD, JPY, CNY)
*/

-- Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  symbol text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create exchange_rates table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric(20, 6) NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_currency, to_currency, date)
);

-- Add currency support to price_lists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_lists' AND column_name = 'currency_id'
  ) THEN
    ALTER TABLE price_lists ADD COLUMN currency_id uuid REFERENCES currencies(id);
  END IF;
END $$;

-- Add currency support to quotes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'currency_id'
  ) THEN
    ALTER TABLE quotes ADD COLUMN currency_id uuid REFERENCES currencies(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'exchange_rate'
  ) THEN
    ALTER TABLE quotes ADD COLUMN exchange_rate numeric(20, 6) DEFAULT 1.0;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Policies for currencies
CREATE POLICY "Authenticated users can read currencies"
  ON currencies FOR SELECT
  TO authenticated
  USING (true);

-- Policies for exchange_rates
CREATE POLICY "Authenticated users can read exchange rates"
  ON exchange_rates FOR SELECT
  TO authenticated
  USING (true);

-- Seed common currencies
INSERT INTO currencies (code, name, symbol, is_active)
VALUES
  ('USD', 'US Dollar', '$', true),
  ('EUR', 'Euro', '€', true),
  ('GBP', 'British Pound', '£', true),
  ('CAD', 'Canadian Dollar', 'C$', true),
  ('AUD', 'Australian Dollar', 'A$', true),
  ('JPY', 'Japanese Yen', '¥', true),
  ('CNY', 'Chinese Yuan', '¥', true),
  ('INR', 'Indian Rupee', '₹', true),
  ('CHF', 'Swiss Franc', 'CHF', true),
  ('MXN', 'Mexican Peso', 'MX$', true)
ON CONFLICT (code) DO NOTHING;

-- Set USD as default currency for existing price lists and quotes
DO $$
DECLARE
  usd_id uuid;
BEGIN
  SELECT id INTO usd_id FROM currencies WHERE code = 'USD';
  
  IF usd_id IS NOT NULL THEN
    UPDATE price_lists SET currency_id = usd_id WHERE currency_id IS NULL;
    UPDATE quotes SET currency_id = usd_id WHERE currency_id IS NULL;
  END IF;
END $$;