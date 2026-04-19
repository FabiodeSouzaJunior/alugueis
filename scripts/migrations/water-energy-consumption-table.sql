-- Módulo Água e Luz: consumo mensal de água e energia por inquilino
CREATE TABLE IF NOT EXISTS water_energy_consumption (
  id VARCHAR(50) PRIMARY KEY,
  tenant_id VARCHAR(50) NOT NULL,
  month TINYINT NOT NULL,
  year SMALLINT NOT NULL,
  water_usage DECIMAL(12,2) NOT NULL DEFAULT 0,
  electricity_usage DECIMAL(12,2) NOT NULL DEFAULT 0,
  add_to_rent BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_month_year (tenant_id, month, year),
  KEY idx_water_energy_tenant (tenant_id),
  KEY idx_water_energy_period (year, month)
);
