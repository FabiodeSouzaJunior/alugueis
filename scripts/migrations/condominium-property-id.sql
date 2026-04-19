-- Adicionar property_id às tabelas de condomínio para vincular cada imóvel ao seu próprio condomínio

ALTER TABLE condominium_base_values ADD COLUMN IF NOT EXISTS property_id VARCHAR(255) NULL;
ALTER TABLE condominium_expenses ADD COLUMN IF NOT EXISTS property_id VARCHAR(255) NULL;
ALTER TABLE condominium_settings ADD COLUMN IF NOT EXISTS property_id VARCHAR(255) NULL;

-- Índices para consultas filtradas por property_id
CREATE INDEX IF NOT EXISTS idx_condo_base_values_property ON condominium_base_values(property_id);
CREATE INDEX IF NOT EXISTS idx_condo_expenses_property ON condominium_expenses(property_id);
CREATE INDEX IF NOT EXISTS idx_condo_settings_property ON condominium_settings(property_id);
