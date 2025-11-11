/*
  # ITT CPQ System - Core Database Schema

  ## Overview
  This migration creates the foundational tables for the ITT Configure-Price-Quote (CPQ) 
  and Price Management system.

  ## New Tables
  
  ### 1. Products
  - `id` (text, primary key) - Unique product identifier
  - `name` (text) - Product name
  - `category` (text) - Product category (Pumps, Valves, etc.)
  - `attributes` (jsonb) - Flexible product attributes (flow_rate, material, voltage, etc.)
  - `base_cost` (numeric) - Base manufacturing/purchase cost
  - `uom` (text) - Unit of measure (EA, LB, etc.)
  - `status` (text) - Active/Inactive status
  - `created_at` (timestamptz) - Record creation timestamp
  
  ### 2. Price Lists
  - `id` (text, primary key) - Price list identifier
  - `name` (text) - Descriptive name
  - `currency` (text) - ISO currency code (USD, EUR, etc.)
  - `effective_from` (date) - Start date
  - `effective_to` (date) - End date
  - `version` (int) - Version number for tracking changes
  - `created_at` (timestamptz)
  
  ### 3. Price List Items
  - `id` (bigserial, primary key)
  - `price_list_id` (text) - Foreign key to price_lists
  - `product_id` (text) - Foreign key to products
  - `list_price` (numeric) - Price for this product in this list
  
  ### 4. Customers
  - `id` (text, primary key)
  - `name` (text) - Customer company name
  - `segment` (text) - Customer tier/segment
  - `region` (text) - Geographic region
  - `contact_email` (text)
  - `annual_volume` (numeric) - Annual purchase volume
  - `created_at` (timestamptz)
  
  ### 5. Discount Rules
  - `id` (text, primary key)
  - `name` (text) - Rule name
  - `segment` (text) - Target customer segment
  - `criteria` (jsonb) - Rule criteria (min_volume, region, etc.)
  - `discount_percent` (numeric) - Discount percentage
  - `approval_threshold` (numeric) - Threshold requiring approval
  - `stackable` (boolean) - Can be combined with other discounts
  - `active` (boolean) - Rule is active
  - `created_at` (timestamptz)
  
  ### 6. Quotes
  - `id` (text, primary key)
  - `customer_id` (text) - Foreign key to customers
  - `price_list_id` (text) - Foreign key to price_lists
  - `status` (text) - Draft/Under Review/Approved/Rejected
  - `subtotal` (numeric)
  - `tax` (numeric)
  - `total` (numeric)
  - `created_by` (uuid) - User who created quote
  - `approvals_required` (int)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 7. Quote Lines
  - `id` (bigserial, primary key)
  - `quote_id` (text) - Foreign key to quotes
  - `product_id` (text) - Foreign key to products
  - `quantity` (int)
  - `unit_price` (numeric)
  - `discount_applied` (numeric) - Discount percentage applied
  - `line_total` (numeric)
  
  ### 8. Approval Requests
  - `id` (text, primary key)
  - `quote_id` (text) - Foreign key to quotes
  - `requested_by` (uuid) - User requesting approval
  - `requested_at` (timestamptz)
  - `approver_role` (text)
  - `approved_by` (uuid) - User who approved/rejected
  - `approved_at` (timestamptz)
  - `status` (text) - Pending/Approved/Rejected
  - `reason` (text) - Reason for approval request
  - `comments` (text) - Approver comments
  
  ### 9. Audit Logs
  - `id` (bigserial, primary key)
  - `entity` (text) - Table/entity name
  - `entity_id` (text) - Record ID
  - `action` (text) - create/update/delete
  - `changed_by` (uuid) - User making change
  - `timestamp` (timestamptz)
  - `details` (jsonb) - Change details

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Policies created for authenticated users
  - Audit trail for all changes

  ## Notes
  - All monetary values use numeric type for precision
  - JSONB used for flexible attributes and criteria
  - Timestamps track all record changes
*/

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  attributes JSONB DEFAULT '{}'::jsonb,
  base_cost NUMERIC(10,2) DEFAULT 0,
  uom TEXT DEFAULT 'EA',
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create price_lists table
CREATE TABLE IF NOT EXISTS price_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT DEFAULT 'USD',
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_to DATE,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create price_list_items table
CREATE TABLE IF NOT EXISTS price_list_items (
  id BIGSERIAL PRIMARY KEY,
  price_list_id TEXT NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  list_price NUMERIC(10,2) NOT NULL,
  UNIQUE(price_list_id, product_id)
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  segment TEXT,
  region TEXT,
  contact_email TEXT,
  annual_volume NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create discount_rules table
CREATE TABLE IF NOT EXISTS discount_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  segment TEXT,
  criteria JSONB DEFAULT '{}'::jsonb,
  discount_percent NUMERIC(5,2) NOT NULL,
  approval_threshold NUMERIC(5,2) DEFAULT 10,
  stackable BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  price_list_id TEXT NOT NULL REFERENCES price_lists(id),
  status TEXT DEFAULT 'Draft',
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  approvals_required INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create quote_lines table
CREATE TABLE IF NOT EXISTS quote_lines (
  id BIGSERIAL PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  discount_applied NUMERIC(5,2) DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL
);

-- Create approval_requests table
CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ DEFAULT now(),
  approver_role TEXT NOT NULL,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'Pending',
  reason TEXT,
  comments TEXT
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  timestamp TIMESTAMPTZ DEFAULT now(),
  details JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_price_list_items_price_list ON price_list_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_product ON price_list_items(product_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON quotes(created_by);
CREATE INDEX IF NOT EXISTS idx_quote_lines_quote ON quote_lines(quote_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_quote ON approval_requests(quote_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products (readable by all authenticated users)
CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for price_lists
CREATE POLICY "Authenticated users can view price lists"
  ON price_lists FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert price lists"
  ON price_lists FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update price lists"
  ON price_lists FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for price_list_items
CREATE POLICY "Authenticated users can view price list items"
  ON price_list_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert price list items"
  ON price_list_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update price list items"
  ON price_list_items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete price list items"
  ON price_list_items FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for customers
CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for discount_rules
CREATE POLICY "Authenticated users can view discount rules"
  ON discount_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert discount rules"
  ON discount_rules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update discount rules"
  ON discount_rules FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for quotes (users can view their own quotes)
CREATE POLICY "Users can view own quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own quotes"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own quotes"
  ON quotes FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policies for quote_lines
CREATE POLICY "Users can view quote lines for their quotes"
  ON quote_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_lines.quote_id
      AND quotes.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert quote lines for their quotes"
  ON quote_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_lines.quote_id
      AND quotes.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update quote lines for their quotes"
  ON quote_lines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_lines.quote_id
      AND quotes.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete quote lines for their quotes"
  ON quote_lines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_lines.quote_id
      AND quotes.created_by = auth.uid()
    )
  );

-- RLS Policies for approval_requests
CREATE POLICY "Users can view approval requests"
  ON approval_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert approval requests"
  ON approval_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Users can update approval requests"
  ON approval_requests FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for audit_logs
CREATE POLICY "Authenticated users can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);