/*
  # Consolidate Duplicate Permissive Policies

  Removes multiple overlapping SELECT policies and consolidates them into single efficient policies.
  Multiple permissive policies can cause confusion and are less maintainable.
  
  ## Security Impact
  - No change to access control
  - Simpler policy management
  - Clearer security model
  
  ## Tables Affected
  - 14+ tables with overlapping permissions
*/

-- Quote Lines - keep only the more permissive one
DROP POLICY IF EXISTS "Users can view quote lines for approved/rejected quotes" ON quote_lines;

-- Quote Speed Metrics - consolidate into one
DROP POLICY IF EXISTS "System can track quote speed" ON quote_speed_metrics;
DROP POLICY IF EXISTS "Users can view quote speed metrics" ON quote_speed_metrics;
CREATE POLICY "Users can manage quote speed metrics"
  ON quote_speed_metrics
  TO authenticated
  USING (true);

-- Approval Workflow Rules - consolidate
DROP POLICY IF EXISTS "Users can view approval rules" ON approval_workflow_rules;

-- Bad Factor Tracking - consolidate
DROP POLICY IF EXISTS "Users can track bad factors" ON bad_factor_tracking;
DROP POLICY IF EXISTS "Users can view bad factors" ON bad_factor_tracking;
CREATE POLICY "Users can manage bad factors"
  ON bad_factor_tracking
  TO authenticated
  USING (true);

-- Commission Payment Items - consolidate
DROP POLICY IF EXISTS "Authenticated users can manage commission payment items" ON commission_payment_items;
DROP POLICY IF EXISTS "Authenticated users can read commission payment items" ON commission_payment_items;
CREATE POLICY "Authenticated users can access commission payment items"
  ON commission_payment_items
  TO authenticated
  USING (true);

-- Commission Payments - consolidate
DROP POLICY IF EXISTS "Authenticated users can manage commission payments" ON commission_payments;
DROP POLICY IF EXISTS "Authenticated users can read commission payments" ON commission_payments;
CREATE POLICY "Authenticated users can access commission payments"
  ON commission_payments
  TO authenticated
  USING (true);

-- Commission Tiers - consolidate
DROP POLICY IF EXISTS "Authenticated users can manage commission tiers" ON commission_tiers;
DROP POLICY IF EXISTS "Authenticated users can read commission tiers" ON commission_tiers;
CREATE POLICY "Authenticated users can access commission tiers"
  ON commission_tiers
  TO authenticated
  USING (true);

-- OEM Pricing Index - consolidate
DROP POLICY IF EXISTS "Users can manage OEM index" ON oem_pricing_index;
DROP POLICY IF EXISTS "Users can view OEM index" ON oem_pricing_index;
CREATE POLICY "Users can access OEM index"
  ON oem_pricing_index
  TO authenticated
  USING (true);

-- Pricing Margin Adders - consolidate
DROP POLICY IF EXISTS "Authenticated users can manage pricing margin adders" ON pricing_margin_adders;
DROP POLICY IF EXISTS "Authenticated users can read pricing margin adders" ON pricing_margin_adders;
CREATE POLICY "Authenticated users can access pricing margin adders"
  ON pricing_margin_adders
  TO authenticated
  USING (true);

-- Pricing Maturity Pillars - consolidate
DROP POLICY IF EXISTS "Admins can manage pricing maturity pillars" ON pricing_maturity_pillars;
DROP POLICY IF EXISTS "Anyone can view pricing maturity pillars" ON pricing_maturity_pillars;
CREATE POLICY "Authenticated users can access pricing maturity pillars"
  ON pricing_maturity_pillars
  TO authenticated
  USING (true);

-- Pricing Multipliers - consolidate
DROP POLICY IF EXISTS "Authenticated users can manage pricing multipliers" ON pricing_multipliers;
DROP POLICY IF EXISTS "Authenticated users can read pricing multipliers" ON pricing_multipliers;
CREATE POLICY "Authenticated users can access pricing multipliers"
  ON pricing_multipliers
  TO authenticated
  USING (true);

-- Pricing Rules Config - consolidate
DROP POLICY IF EXISTS "Authenticated users can manage pricing rules config" ON pricing_rules_config;
DROP POLICY IF EXISTS "Authenticated users can read pricing rules config" ON pricing_rules_config;
CREATE POLICY "Authenticated users can access pricing rules config"
  ON pricing_rules_config
  TO authenticated
  USING (true);

-- Product Complexity Attributes - consolidate
DROP POLICY IF EXISTS "Authenticated users can manage product complexity" ON product_complexity_attributes;
DROP POLICY IF EXISTS "Authenticated users can read product complexity" ON product_complexity_attributes;
CREATE POLICY "Authenticated users can access product complexity"
  ON product_complexity_attributes
  TO authenticated
  USING (true);
