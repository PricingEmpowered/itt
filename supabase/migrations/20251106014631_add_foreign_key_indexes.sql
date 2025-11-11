/*
  # Add Foreign Key Indexes

  Adds missing indexes for all foreign keys to improve query performance.
  
  ## Performance Impact
  - Dramatically improves JOIN performance
  - Speeds up foreign key constraint checks
  - Reduces query execution time for related table lookups
  
  ## Tables Affected
  - 35+ tables with unindexed foreign keys
*/

-- Approval History indexes
CREATE INDEX IF NOT EXISTS idx_approval_history_actioned_by ON approval_history(actioned_by);
CREATE INDEX IF NOT EXISTS idx_approval_history_approval_request_id ON approval_history(approval_request_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_quote_id ON approval_history(quote_id);

-- Approval Requests indexes
CREATE INDEX IF NOT EXISTS idx_approval_requests_approved_by ON approval_requests(approved_by);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by ON approval_requests(requested_by);

-- Audit Logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by ON audit_logs(changed_by);

-- Commission Payments indexes
CREATE INDEX IF NOT EXISTS idx_commission_payments_created_by ON commission_payments(created_by);

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_industry ON customers(industry_id);
CREATE INDEX IF NOT EXISTS idx_customers_region ON customers(region_id);

-- Deal Score Config indexes
CREATE INDEX IF NOT EXISTS idx_deal_score_config_updated_by ON deal_score_config(updated_by);

-- Deal Score Recommendations indexes
CREATE INDEX IF NOT EXISTS idx_deal_score_recommendations_acknowledged_by ON deal_score_recommendations(acknowledged_by);

-- Discount Variance Tracking indexes
CREATE INDEX IF NOT EXISTS idx_discount_variance_tracking_approved_by ON discount_variance_tracking(approved_by);

-- Expected Cost Changes indexes
CREATE INDEX IF NOT EXISTS idx_expected_cost_changes_acknowledged_by ON expected_cost_changes(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_expected_cost_changes_created_by ON expected_cost_changes(created_by);
CREATE INDEX IF NOT EXISTS idx_expected_cost_changes_price_updated_by ON expected_cost_changes(price_updated_by);

-- Industries indexes
CREATE INDEX IF NOT EXISTS idx_industries_parent_industry_id ON industries(parent_industry_id);

-- Non-Standard Product Mapping indexes
CREATE INDEX IF NOT EXISTS idx_non_standard_product_mapping_created_by ON non_standard_product_mapping(created_by);

-- OEM Pricing Index indexes
CREATE INDEX IF NOT EXISTS idx_oem_pricing_index_created_by ON oem_pricing_index(created_by);

-- Price Lists indexes
CREATE INDEX IF NOT EXISTS idx_price_lists_currency_id ON price_lists(currency_id);

-- Price Simulations indexes
CREATE INDEX IF NOT EXISTS idx_price_simulations_created_by ON price_simulations(created_by);

-- Pricing Maturity Assessments indexes
CREATE INDEX IF NOT EXISTS idx_pricing_maturity_assessments_assessed_by ON pricing_maturity_assessments(assessed_by);

-- Pricing Rule Decisions indexes
CREATE INDEX IF NOT EXISTS idx_pricing_rule_decisions_created_by ON pricing_rule_decisions(created_by);
CREATE INDEX IF NOT EXISTS idx_pricing_rule_decisions_rules_config_id ON pricing_rule_decisions(rules_config_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rule_decisions_standard_product_id ON pricing_rule_decisions(standard_product_id);

-- Pricing Rules Config indexes
CREATE INDEX IF NOT EXISTS idx_pricing_rules_config_product_family_id ON pricing_rules_config(product_family_id);

-- Product Families indexes
CREATE INDEX IF NOT EXISTS idx_product_families_parent_family_id ON product_families(parent_family_id);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_family_id ON products(family_id);

-- Quote Lines indexes
CREATE INDEX IF NOT EXISTS idx_quote_lines_product_id ON quote_lines(product_id);

-- Quotes indexes
CREATE INDEX IF NOT EXISTS idx_quotes_currency_id ON quotes(currency_id);
CREATE INDEX IF NOT EXISTS idx_quotes_price_list_id ON quotes(price_list_id);

-- Regions indexes
CREATE INDEX IF NOT EXISTS idx_regions_parent_region_id ON regions(parent_region_id);

-- Sales Commissions indexes
CREATE INDEX IF NOT EXISTS idx_sales_commissions_commission_tier_id ON sales_commissions(commission_tier_id);

-- Simulation Results indexes
CREATE INDEX IF NOT EXISTS idx_simulation_results_simulation_id ON simulation_results(simulation_id);

-- Value Propositions indexes
CREATE INDEX IF NOT EXISTS idx_value_propositions_created_by ON value_propositions(created_by);

-- Win Loss Tracking indexes
CREATE INDEX IF NOT EXISTS idx_win_loss_tracking_recorded_by ON win_loss_tracking(recorded_by);
