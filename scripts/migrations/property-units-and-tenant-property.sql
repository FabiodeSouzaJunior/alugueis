-- 1) Inquilino: em qual imóvel mora (para dropdown "Responsável pelo pagamento" nas unidades)
-- Execute no banco correto: USE seu_banco;
ALTER TABLE tenants ADD COLUMN property_id VARCHAR(255) NULL;

-- 2) Unidades/registros dentro do imóvel: identificador, preço do aluguel, qtd máx pessoas; responsável e quem mora registram depois
CREATE TABLE IF NOT EXISTS property_units (
  id VARCHAR(255) PRIMARY KEY,
  property_id VARCHAR(255) NOT NULL,
  rent_price DECIMAL(12,2) NULL,
  tenant_id VARCHAR(255) NULL,
  unit_label VARCHAR(255) NULL,
  max_people INT NULL,
  resident_tenant_id VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
