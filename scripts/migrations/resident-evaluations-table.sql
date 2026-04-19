-- Avaliações enviadas pelos moradores via página pública /avaliacao
-- Fonte de dados do CRM (CRM apenas analisa; não cria)
USE kitnet_manager;

CREATE TABLE IF NOT EXISTS resident_evaluations (
  id VARCHAR(36) PRIMARY KEY,
  tenant_name VARCHAR(255) NOT NULL,
  contact VARCHAR(255) NULL,
  kitnet_number VARCHAR(32) NULL,
  comfort_rating TINYINT NULL,
  cleanliness_rating TINYINT NULL,
  infrastructure_rating TINYINT NULL,
  location_rating TINYINT NULL,
  cost_benefit_rating TINYINT NULL,
  overall_rating TINYINT NULL,
  recommendation VARCHAR(16) NULL,
  comment TEXT NULL,
  categories JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_resident_evaluations_created_at ON resident_evaluations (created_at DESC);
CREATE INDEX idx_resident_evaluations_kitnet ON resident_evaluations (kitnet_number);
