/*
  # Add User Profiles Table (v2)

  ## Overview
  This migration creates a user_profiles table to store user information
  and approval levels for the CPQ system.

  ## New Tables
  
  ### user_profiles
  - `id` (uuid, primary key)
  - `email` (text) - User email for display
  - `full_name` (text) - User's full name
  - `role` (text) - User role (Sales Rep, Sales Manager, Director, VP Sales, Admin)
  - `approval_level` (int) - Approval authority level (0-4)
    - 0: Sales Rep (no approval authority)
    - 1: Sales Manager (can approve up to 15% discount)
    - 2: Director (can approve up to 25% discount)
    - 3: VP Sales (can approve up to 35% discount)
    - 4: Admin (can approve any discount)
  - `max_discount_approval` (numeric) - Maximum discount % user can approve
  - `department` (text) - User's department
  - `active` (boolean) - Whether user is active
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - RLS enabled
  - All authenticated users can read profiles

  ## Sample Data
  Creates 8 sample users with different approval levels
*/

-- Create user_profiles table without foreign key to auth.users
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  approval_level INT DEFAULT 0,
  max_discount_approval NUMERIC(5,2) DEFAULT 0,
  department TEXT DEFAULT 'Sales',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "All authenticated users can read profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Insert sample user profiles
INSERT INTO user_profiles (email, full_name, role, approval_level, max_discount_approval, department, active) VALUES
  ('john.smith@pricingempowered.com', 'John Smith', 'Sales Rep', 0, 0, 'Sales', true),
  ('sarah.jones@pricingempowered.com', 'Sarah Jones', 'Sales Rep', 0, 0, 'Sales', true),
  ('mike.wilson@pricingempowered.com', 'Mike Wilson', 'Sales Manager', 1, 15.00, 'Sales', true),
  ('emily.brown@pricingempowered.com', 'Emily Brown', 'Sales Manager', 1, 15.00, 'Sales', true),
  ('david.chen@pricingempowered.com', 'David Chen', 'Director', 2, 25.00, 'Sales', true),
  ('lisa.martinez@pricingempowered.com', 'Lisa Martinez', 'Director', 2, 25.00, 'Sales', true),
  ('robert.taylor@pricingempowered.com', 'Robert Taylor', 'VP Sales', 3, 35.00, 'Sales', true),
  ('admin@pricingempowered.com', 'System Admin', 'Admin', 4, 100.00, 'IT', true)
ON CONFLICT (email) DO NOTHING;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_approval_level ON user_profiles(approval_level);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
