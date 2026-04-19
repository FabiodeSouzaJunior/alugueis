-- Módulo Condomínio: tabelas e configuração inicial

-- Valor base do condomínio (histórico de reajustes: cada linha = vigência)
CREATE TABLE IF NOT EXISTS condominium_base_values (
  id VARCHAR(36) PRIMARY KEY,
  value DECIMAL(10,2) NOT NULL,
  start_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Despesas extras / obras para rateio (reforma fachada, pintura, etc.)
CREATE TABLE IF NOT EXISTS condominium_expenses (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  total_value DECIMAL(10,2) NOT NULL,
  expense_date DATE NULL,
  number_of_units INT NOT NULL DEFAULT 10,
  installments INT NOT NULL DEFAULT 1,
  start_month INT NOT NULL,
  start_year INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Configuração: cobrança junto com aluguel (1) ou separada (0)
CREATE TABLE IF NOT EXISTS condominium_settings (
  id VARCHAR(36) PRIMARY KEY,
  charge_with_rent TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Inserir configuração padrão (junto com aluguel)
INSERT IGNORE INTO condominium_settings (id, charge_with_rent) VALUES ('default', 1);
