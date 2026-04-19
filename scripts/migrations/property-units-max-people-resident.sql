-- Unidade: quantidade máxima de pessoas e quem mora (inquilino)
-- Execute no banco: USE kitnet_manager;
ALTER TABLE property_units ADD COLUMN max_people INT NULL;
ALTER TABLE property_units ADD COLUMN resident_tenant_id VARCHAR(255) NULL;
