-- Adiciona valor gasto por manutenção.
-- Execute uma vez. Se a coluna já existir, ignore o erro.

ALTER TABLE maintenance
  ADD COLUMN spent_value DECIMAL(10,2) NULL DEFAULT 0 AFTER status;

