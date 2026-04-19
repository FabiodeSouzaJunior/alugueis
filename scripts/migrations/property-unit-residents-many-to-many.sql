-- Suporte a múltiplos moradores por unidade.
-- Uma unidade pode ter vários inquilinos moradores.
-- Um inquilino continua vinculado a apenas uma unidade por vez (garantido por UNIQUE tenant_id).

CREATE TABLE IF NOT EXISTS property_unit_residents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  unit_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS property_unit_residents_unit_tenant_uidx
  ON property_unit_residents (unit_id, tenant_id);

-- Backfill opcional para dados legados (coluna resident_tenant_id antiga).
INSERT INTO property_unit_residents (unit_id, tenant_id)
SELECT pu.id, pu.resident_tenant_id
FROM property_units pu
WHERE pu.resident_tenant_id IS NOT NULL
ON CONFLICT (unit_id, tenant_id) DO NOTHING;
