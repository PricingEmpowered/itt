/*
  # Add Performance Indexes

  This migration adds indexes to improve query performance across the application.

  ## New Indexes

  ### quotes table
  - `idx_quotes_customer_id` - Index on customer_id for faster customer lookups
  - `idx_quotes_status` - Index on status for filtering quotes by status
  - `idx_quotes_created_at` - Index on created_at for time-based queries
  - `idx_quotes_created_by` - Index on created_by for user-specific queries
  - `idx_quotes_status_created` - Composite index for common status+time queries
  - `idx_quotes_customer_status` - Composite index for customer+status queries

  ### quote_lines table
  - `idx_quote_lines_quote_id` - Index on quote_id for faster quote line lookups
  - `idx_quote_lines_product_id` - Index on product_id for product analytics

  ### customers table
  - `idx_customers_segment` - Index on segment for segmentation queries
  - `idx_customers_region` - Index on region for regional analytics
  - `idx_customers_region_id` - Index on region_id for hierarchy queries
  - `idx_customers_industry_id` - Index on industry_id for industry analytics

  ### products table
  - `idx_products_category` - Index on category for category filtering
  - `idx_products_family_id` - Index on family_id for family analytics
  - `idx_products_status` - Index on status for active product queries

  ### price_list_items table
  - `idx_price_list_items_price_list_id` - Index on price_list_id
  - `idx_price_list_items_product_id` - Index on product_id

  ### approval_requests table
  - `idx_approval_requests_quote_id` - Index on quote_id
  - `idx_approval_requests_status` - Index on status for filtering
  - `idx_approval_requests_approved_by` - Index on approved_by

  ### sales_commissions table
  - `idx_sales_commissions_sales_rep_id` - Index on sales_rep_id
  - `idx_sales_commissions_quote_id` - Index on quote_id

  ## Performance Impact
  - Significantly faster filtering and joins
  - Improved dashboard query performance
  - Better analytics query execution times
*/

-- Quotes table indexes
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON quotes(created_by);
CREATE INDEX IF NOT EXISTS idx_quotes_status_created ON quotes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_status ON quotes(customer_id, status);

-- Quote lines table indexes
CREATE INDEX IF NOT EXISTS idx_quote_lines_quote_id ON quote_lines(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_lines_product_id ON quote_lines(product_id);

-- Customers table indexes
CREATE INDEX IF NOT EXISTS idx_customers_segment ON customers(segment);
CREATE INDEX IF NOT EXISTS idx_customers_region ON customers(region);
CREATE INDEX IF NOT EXISTS idx_customers_region_id ON customers(region_id);
CREATE INDEX IF NOT EXISTS idx_customers_industry_id ON customers(industry_id);

-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_family_id ON products(family_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- Price list items indexes
CREATE INDEX IF NOT EXISTS idx_price_list_items_price_list_id ON price_list_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_product_id ON price_list_items(product_id);

-- Approval requests table indexes
CREATE INDEX IF NOT EXISTS idx_approval_requests_quote_id ON approval_requests(quote_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_approved_by ON approval_requests(approved_by);

-- Sales commissions indexes
CREATE INDEX IF NOT EXISTS idx_sales_commissions_sales_rep_id ON sales_commissions(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_sales_commissions_quote_id ON sales_commissions(quote_id);
