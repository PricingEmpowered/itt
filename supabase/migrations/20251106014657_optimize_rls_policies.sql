/*
  # Optimize RLS Policies for Performance

  Wraps auth.uid() calls in SELECT to prevent re-evaluation for each row.
  This dramatically improves query performance at scale.
  
  ## Performance Impact
  - Prevents auth function re-evaluation per row
  - Reduces CPU usage on large result sets
  - Improves query planning and execution
  
  ## Tables Affected
  - quotes, quote_lines, approval_requests
  - user_profiles, price_simulations, simulation_results
  - pricing_documents, approval_workflow_rules, approval_history
*/

-- Quotes table policies
DROP POLICY IF EXISTS "Users can insert own quotes" ON quotes;
CREATE POLICY "Users can insert own quotes"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;
CREATE POLICY "Users can update own quotes"
  ON quotes FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Quote Lines policies
DROP POLICY IF EXISTS "Users can view quote lines for their quotes" ON quote_lines;
CREATE POLICY "Users can view quote lines for their quotes"
  ON quote_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes 
      WHERE quotes.id = quote_lines.quote_id 
      AND quotes.created_by = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert quote lines for their quotes" ON quote_lines;
CREATE POLICY "Users can insert quote lines for their quotes"
  ON quote_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes 
      WHERE quotes.id = quote_lines.quote_id 
      AND quotes.created_by = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update quote lines for their quotes" ON quote_lines;
CREATE POLICY "Users can update quote lines for their quotes"
  ON quote_lines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes 
      WHERE quotes.id = quote_lines.quote_id 
      AND quotes.created_by = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete quote lines for their quotes" ON quote_lines;
CREATE POLICY "Users can delete quote lines for their quotes"
  ON quote_lines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes 
      WHERE quotes.id = quote_lines.quote_id 
      AND quotes.created_by = (SELECT auth.uid())
    )
  );

-- Approval Requests policies
DROP POLICY IF EXISTS "Users can insert approval requests" ON approval_requests;
CREATE POLICY "Users can insert approval requests"
  ON approval_requests FOR INSERT
  TO authenticated
  WITH CHECK (requested_by = (SELECT auth.uid()));

-- User Profiles policies
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can insert user profiles" ON user_profiles;
CREATE POLICY "Admins can insert user profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete profiles" ON user_profiles;
CREATE POLICY "Admins can delete profiles"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  );

-- Price Simulations policies
DROP POLICY IF EXISTS "Users can view own simulations" ON price_simulations;
CREATE POLICY "Users can view own simulations"
  ON price_simulations FOR SELECT
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create own simulations" ON price_simulations;
CREATE POLICY "Users can create own simulations"
  ON price_simulations FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own simulations" ON price_simulations;
CREATE POLICY "Users can update own simulations"
  ON price_simulations FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own simulations" ON price_simulations;
CREATE POLICY "Users can delete own simulations"
  ON price_simulations FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Simulation Results policies
DROP POLICY IF EXISTS "Users can view results for their simulations" ON simulation_results;
CREATE POLICY "Users can view results for their simulations"
  ON simulation_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM price_simulations 
      WHERE price_simulations.id = simulation_results.simulation_id 
      AND price_simulations.created_by = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create results for their simulations" ON simulation_results;
CREATE POLICY "Users can create results for their simulations"
  ON simulation_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM price_simulations 
      WHERE price_simulations.id = simulation_results.simulation_id 
      AND price_simulations.created_by = (SELECT auth.uid())
    )
  );

-- Pricing Documents policies
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON pricing_documents;
CREATE POLICY "Authenticated users can upload documents"
  ON pricing_documents FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own documents" ON pricing_documents;
CREATE POLICY "Users can update own documents"
  ON pricing_documents FOR UPDATE
  TO authenticated
  USING (uploaded_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own documents" ON pricing_documents;
CREATE POLICY "Users can delete own documents"
  ON pricing_documents FOR DELETE
  TO authenticated
  USING (uploaded_by = (SELECT auth.uid()));

-- Approval Workflow Rules policies
DROP POLICY IF EXISTS "Admins can manage approval rules" ON approval_workflow_rules;
CREATE POLICY "Admins can manage approval rules"
  ON approval_workflow_rules
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  );

-- Approval History policies
DROP POLICY IF EXISTS "Users can insert approval history" ON approval_history;
CREATE POLICY "Users can insert approval history"
  ON approval_history FOR INSERT
  TO authenticated
  WITH CHECK (actioned_by = (SELECT auth.uid()));
