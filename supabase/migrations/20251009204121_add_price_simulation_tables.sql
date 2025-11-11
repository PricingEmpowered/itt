/*
  # Price Simulation Tables

  1. New Tables
    - `price_simulations`
      - `id` (uuid, primary key)
      - `name` (text) - Name of the simulation
      - `description` (text) - Description of what's being tested
      - `created_by` (uuid) - User who created it
      - `created_at` (timestamptz)
      - `price_change_percent` (numeric) - Price increase/decrease percentage
      - `applies_to_families` (text[]) - Array of product family IDs
      - `applies_to_products` (text[]) - Array of specific product IDs
      - `applies_to_customer_segments` (text[]) - Array of customer segment IDs
      - `status` (text) - draft, running, completed
    
    - `simulation_results`
      - `id` (uuid, primary key)
      - `simulation_id` (uuid, foreign key)
      - `scenario_type` (text) - best_case, mid_case, worst_case
      - `projected_revenue` (numeric)
      - `projected_margin` (numeric)
      - `revenue_change_percent` (numeric)
      - `volume_impact_percent` (numeric)
      - `affected_customers` (integer)
      - `affected_products` (integer)
      - `confidence_score` (numeric) - 0-100
      - `rationale` (jsonb) - Detailed reasoning
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Authenticated users can create and view their own simulations
    - Authenticated users can view results for their simulations
*/

CREATE TABLE IF NOT EXISTS price_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  price_change_percent numeric NOT NULL,
  applies_to_families text[] DEFAULT '{}',
  applies_to_products text[] DEFAULT '{}',
  applies_to_customer_segments text[] DEFAULT '{}',
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed'))
);

CREATE TABLE IF NOT EXISTS simulation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id uuid REFERENCES price_simulations(id) ON DELETE CASCADE NOT NULL,
  scenario_type text NOT NULL CHECK (scenario_type IN ('best_case', 'mid_case', 'worst_case')),
  projected_revenue numeric NOT NULL DEFAULT 0,
  projected_margin numeric NOT NULL DEFAULT 0,
  revenue_change_percent numeric NOT NULL DEFAULT 0,
  volume_impact_percent numeric NOT NULL DEFAULT 0,
  affected_customers integer NOT NULL DEFAULT 0,
  affected_products integer NOT NULL DEFAULT 0,
  confidence_score numeric NOT NULL DEFAULT 0,
  rationale jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE price_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for price_simulations
CREATE POLICY "Users can view own simulations"
  ON price_simulations FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create own simulations"
  ON price_simulations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own simulations"
  ON price_simulations FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own simulations"
  ON price_simulations FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policies for simulation_results
CREATE POLICY "Users can view results for their simulations"
  ON simulation_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM price_simulations
      WHERE price_simulations.id = simulation_results.simulation_id
      AND price_simulations.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create results for their simulations"
  ON simulation_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM price_simulations
      WHERE price_simulations.id = simulation_results.simulation_id
      AND price_simulations.created_by = auth.uid()
    )
  );
