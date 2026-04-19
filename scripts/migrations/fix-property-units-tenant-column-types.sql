-- MIGRATION: fix property_units tenant columns from uuid to text
-- 
-- Problema: as colunas tenant_id e resident_tenant_id foram criadas como tipo uuid
-- no Supabase, mas o app gera IDs no formato "timestamp-string" (ex: "1774315526097-oouzcuy")
-- que não são UUIDs válidos. Isso causa o erro:
--   "invalid input syntax for type uuid"
--
-- Execute este script no editor SQL do Supabase (https://supabase.com/dashboard -> SQL Editor)

-- 1. Remover foreign key constraints caso existam
ALTER TABLE property_units DROP CONSTRAINT IF EXISTS property_units_tenant_id_fkey;
ALTER TABLE property_units DROP CONSTRAINT IF EXISTS property_units_resident_tenant_id_fkey;

-- 2. Converter colunas para text (aceita qualquer string como ID)
ALTER TABLE property_units ALTER COLUMN tenant_id TYPE text;
ALTER TABLE property_units ALTER COLUMN resident_tenant_id TYPE text;
