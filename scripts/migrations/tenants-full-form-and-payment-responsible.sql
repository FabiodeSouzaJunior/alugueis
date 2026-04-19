ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS document_number TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS is_payment_responsible BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS payment_responsible TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_document_number ON tenants (document_number);
CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants (email);
CREATE INDEX IF NOT EXISTS idx_tenants_payment_responsible ON tenants (is_payment_responsible);
