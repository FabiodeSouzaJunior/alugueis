-- Adiciona vínculo de custos com Material e Mão de obra (trabalhador).
-- Custos com reference_type = 'material' ou 'worker' são gerados automaticamente;
-- reference_id guarda o id do material ou do worker.

-- Execute uma vez. Se as colunas já existirem, ignore o erro.
ALTER TABLE obra_costs
  ADD COLUMN reference_type VARCHAR(20) NULL COMMENT 'material | worker | NULL = manual';
ALTER TABLE obra_costs
  ADD COLUMN reference_id VARCHAR(50) NULL COMMENT 'id do material ou worker';

CREATE INDEX idx_obra_costs_reference ON obra_costs(obra_id, reference_type, reference_id);
