-- Novos campos na tabela properties: preço do aluguel, quem mora, responsável pelo pagamento
-- Execute após criar a tabela properties (properties-table.sql). Execute cada linha uma vez.

ALTER TABLE properties ADD COLUMN rent_price DECIMAL(12,2) NULL AFTER estimated_value;
ALTER TABLE properties ADD COLUMN resident_name VARCHAR(255) NULL AFTER rent_price;
ALTER TABLE properties ADD COLUMN payment_responsible VARCHAR(255) NULL AFTER resident_name;
