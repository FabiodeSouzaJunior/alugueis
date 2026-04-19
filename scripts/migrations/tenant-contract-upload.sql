-- Migration: Add contract file columns to tenants table
-- Date: 2026-04-11
-- Description: Adds columns for storing lease contract file metadata on tenants
--              marked as payment responsible.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS contract_file_path TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contract_file_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contract_mime_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contract_size_bytes BIGINT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contract_uploaded_at TIMESTAMPTZ DEFAULT NULL;

-- Index for quickly finding tenants with contracts
CREATE INDEX IF NOT EXISTS idx_tenants_contract_file_path
  ON tenants (contract_file_path)
  WHERE contract_file_path IS NOT NULL;

-- Create storage bucket for tenant contracts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-contracts',
  'tenant-contracts',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: allow authenticated users to upload, read, update, and delete their own org's files
CREATE POLICY "Authenticated users can upload tenant contracts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'tenant-contracts');

CREATE POLICY "Authenticated users can read tenant contracts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'tenant-contracts');

CREATE POLICY "Authenticated users can update tenant contracts"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'tenant-contracts');

CREATE POLICY "Authenticated users can delete tenant contracts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'tenant-contracts');

-- Service role full access (for server-side operations)
CREATE POLICY "Service role full access to tenant contracts"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'tenant-contracts')
  WITH CHECK (bucket_id = 'tenant-contracts');
