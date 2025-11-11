/*
  # Add Document Storage for Pricing Excellence

  1. New Tables
    - `pricing_documents`
      - `id` (uuid, primary key)
      - `file_name` (text) - Original file name
      - `file_path` (text) - Path in Supabase Storage
      - `file_size` (integer) - File size in bytes
      - `file_type` (text) - MIME type
      - `category` (text) - Document category (price_list, policy, guideline, analysis, training, other)
      - `description` (text) - Optional description
      - `uploaded_by` (uuid) - Reference to auth.users
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Storage
    - Create storage bucket for documents

  3. Security
    - Enable RLS on `pricing_documents` table
    - Add policies for authenticated users to manage documents
    - Add storage policies for authenticated users
*/

-- Create documents table
CREATE TABLE IF NOT EXISTS pricing_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text NOT NULL UNIQUE,
  file_size integer NOT NULL,
  file_type text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  description text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE pricing_documents ENABLE ROW LEVEL SECURITY;

-- Policies for pricing_documents
CREATE POLICY "Authenticated users can view documents"
  ON pricing_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload documents"
  ON pricing_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update own documents"
  ON pricing_documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete own documents"
  ON pricing_documents FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);

-- Create storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('pricing-documents', 'pricing-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pricing-documents');

CREATE POLICY "Authenticated users can view files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'pricing-documents');

CREATE POLICY "Users can update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'pricing-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'pricing-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_pricing_documents_category ON pricing_documents(category);
CREATE INDEX IF NOT EXISTS idx_pricing_documents_uploaded_by ON pricing_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_pricing_documents_created_at ON pricing_documents(created_at DESC);