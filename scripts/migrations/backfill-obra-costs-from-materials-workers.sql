-- Execute UMA VEZ após add-obra-costs-reference.sql
-- Cria registros em obra_costs para materiais e trabalhadores que já existiam
-- (evita duplicação: só insere se ainda não existir custo com esse reference_id)

-- Custos a partir de materiais (que ainda não têm custo vinculado)
INSERT INTO obra_costs (id, obra_id, date, category, description, value, responsible, notes, reference_type, reference_id)
SELECT
  CONCAT('cost-mat-', m.id),
  m.obra_id,
  COALESCE(m.purchase_date, CURDATE()),
  'Material',
  m.material_name,
  m.total_value,
  NULL,
  NULL,
  'material',
  m.id
FROM obra_materials m
WHERE NOT EXISTS (
  SELECT 1 FROM obra_costs c
  WHERE c.obra_id = m.obra_id AND c.reference_type = 'material' AND c.reference_id = m.id
);

-- Custos a partir de trabalhadores (que ainda não têm custo vinculado)
INSERT INTO obra_costs (id, obra_id, date, category, description, value, responsible, notes, reference_type, reference_id)
SELECT
  CONCAT('cost-wkr-', w.id),
  w.obra_id,
  CURDATE(),
  'Mão de obra',
  CONCAT(w.name, IF(w.role IS NOT NULL AND w.role != '', CONCAT(' - ', w.role), '')),
  w.total_paid,
  NULL,
  NULL,
  'worker',
  w.id
FROM obra_workers w
WHERE NOT EXISTS (
  SELECT 1 FROM obra_costs c
  WHERE c.obra_id = w.obra_id AND c.reference_type = 'worker' AND c.reference_id = w.id
);
