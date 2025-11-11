/*
  # Add Deal Score Configuration Table

  1. New Tables
    - `deal_score_config`
      - `id` (integer, primary key) - Configuration record ID (always 1, singleton pattern)
      - `margin_weight` (integer) - Weight percentage for margin factor (0-100)
      - `discount_weight` (integer) - Weight percentage for discount factor (0-100)
      - `price_competitiveness_weight` (integer) - Weight percentage for price competitiveness (0-100)
      - `updated_at` (timestamptz) - Last update timestamp
      - `updated_by` (uuid) - User who last updated the configuration

  2. Security
    - Enable RLS on `deal_score_config` table
    - Add policy for authenticated users to read configuration
    - Add policy for authenticated users to update configuration (no insert/delete, single row only)

  3. Data
    - Insert default configuration with balanced weights (40/30/30)

  ## Notes
  - Uses singleton pattern (single configuration row with id=1)
  - Weights must sum to 100% (enforced at application level)
  - Configuration applies to all future deal score calculations
*/

-- Create deal_score_config table
CREATE TABLE IF NOT EXISTS deal_score_config (
  id integer PRIMARY KEY DEFAULT 1,
  margin_weight integer NOT NULL DEFAULT 40,
  discount_weight integer NOT NULL DEFAULT 30,
  price_competitiveness_weight integer NOT NULL DEFAULT 30,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT singleton_config CHECK (id = 1),
  CONSTRAINT valid_margin_weight CHECK (margin_weight >= 0 AND margin_weight <= 100),
  CONSTRAINT valid_discount_weight CHECK (discount_weight >= 0 AND discount_weight <= 100),
  CONSTRAINT valid_price_weight CHECK (price_competitiveness_weight >= 0 AND price_competitiveness_weight <= 100)
);

-- Insert default configuration
INSERT INTO deal_score_config (id, margin_weight, discount_weight, price_competitiveness_weight)
VALUES (1, 40, 30, 30)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE deal_score_config ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read the configuration
CREATE POLICY "Authenticated users can read deal score config"
  ON deal_score_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: All authenticated users can update the configuration (no insert/delete)
CREATE POLICY "Authenticated users can update deal score config"
  ON deal_score_config
  FOR UPDATE
  TO authenticated
  USING (id = 1)
  WITH CHECK (id = 1);