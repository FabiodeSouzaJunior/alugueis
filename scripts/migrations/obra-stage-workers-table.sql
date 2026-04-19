-- Tabela de vínculo entre etapas (obra_stages) e trabalhadores (obra_workers).
-- Usada nas páginas Etapas e Trabalhadores da obra para associar quem atua em cada etapa.
-- Execute uma vez. Se a tabela já existir, ignore o erro.

CREATE TABLE IF NOT EXISTS obra_stage_workers (
  id VARCHAR(50) PRIMARY KEY,
  obra_id VARCHAR(50) NOT NULL,
  stage_id VARCHAR(50) NOT NULL,
  worker_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_obra_stage_worker (stage_id, worker_id),
  KEY idx_obra_stage_workers_obra (obra_id),
  KEY idx_obra_stage_workers_stage (stage_id),
  KEY idx_obra_stage_workers_worker (worker_id)
);
