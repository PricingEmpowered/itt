/*
  # Add INSERT policies for analytics tables

  Allows authenticated users to insert analytics data for seeding and updates.
*/

CREATE POLICY "Authenticated users can insert business performance"
  ON analytics_business_performance FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert price performance"
  ON analytics_price_performance FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert quote funnel"
  ON analytics_quote_funnel FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert price waterfall"
  ON analytics_price_waterfall FOR INSERT
  TO authenticated
  WITH CHECK (true);