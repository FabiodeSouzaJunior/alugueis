-- Adiciona campo add_to_rent à tabela water_energy_consumption
ALTER TABLE water_energy_consumption
  ADD COLUMN IF NOT EXISTS add_to_rent BOOLEAN NOT NULL DEFAULT FALSE;
