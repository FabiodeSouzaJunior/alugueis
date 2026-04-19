-- CRM & Inteligência de Inquilinos: satisfação, feedback, saídas e interações
USE kitnet_manager;

-- Avaliação de satisfação (1 a 5) por inquilino
CREATE TABLE IF NOT EXISTS tenant_satisfaction (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  comfort TINYINT NULL,
  cleanliness TINYINT NULL,
  infrastructure TINYINT NULL,
  location TINYINT NULL,
  cost_benefit TINYINT NULL,
  overall TINYINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comentários/feedback dos inquilinos (categoria: infraestrutura, internet, etc.)
CREATE TABLE IF NOT EXISTS tenant_feedback (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  category VARCHAR(64) NULL,
  comment TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Motivos de saída (ao encerrar contrato)
CREATE TABLE IF NOT EXISTS tenant_exits (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  exit_date DATE NOT NULL,
  reason_code VARCHAR(64) NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Linha do tempo de interações (entrada, reclamação, manutenção, renovação, etc.)
CREATE TABLE IF NOT EXISTS tenant_interactions (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  type VARCHAR(64) NOT NULL,
  description TEXT NULL,
  occurred_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
