-- 0006_seed_berries_from_planillas.sql
-- Defectos + plantillas para STRAWBERRY / RASPBERRY / BLACKBERRY, tomados de las
-- planillas de captura de terreno de la empresa (Planillas.xlsx, mayo 2026):
--   Strawberry:  Overripe, Bruises, Underripe, Leaking, Mold, Decay, Scars Severe, Freeze Damage
--   Raspberries: Overripe, Inmature, Split, Mold, Decay, Broken Cells, Dry Cells, Freeze Damage
--   Blackberry:  Overripe, Inmadure, Cell Regression, Mold, Decay, White Cells, Dry Cells, Freeze Damage
-- Familias siguiendo la convención del seed de arándano (0002): madurez y deterioro
-- van en 'condition'; apariencia (scars) en 'quality'. Todos number/%.
-- Sin tolerancias: la resolución queda NULL hasta que el cliente entregue los umbrales
-- (igual que hoy). Idempotente con WHERE NOT EXISTS.

DECLARE @straw INT = (SELECT id FROM qc.commodities WHERE code='STRAWBERRY');
DECLARE @rasp  INT = (SELECT id FROM qc.commodities WHERE code='RASPBERRY');
DECLARE @black INT = (SELECT id FROM qc.commodities WHERE code='BLACKBERRY');

-- ===== Defectos =====
INSERT INTO qc.defects (commodity_id, code, label, family, value_type, unit)
SELECT v.cid, v.code, v.label, v.family, 'number', '%' FROM (VALUES
  -- STRAWBERRY
  (@straw, 'overripe',        N'Overripe (%)',        'condition'),
  (@straw, 'bruises',         N'Bruises (%)',         'condition'),
  (@straw, 'underripe',       N'Underripe (%)',       'condition'),
  (@straw, 'leaking',         N'Leaking (%)',         'condition'),
  (@straw, 'mold',            N'Mold (%)',            'condition'),
  (@straw, 'decay',           N'Decay (%)',           'condition'),
  (@straw, 'scars_severe',    N'Scars Severe (%)',    'quality'),
  (@straw, 'freeze_damage',   N'Freeze Damage (%)',   'condition'),
  -- RASPBERRY
  (@rasp,  'overripe',        N'Overripe (%)',        'condition'),
  (@rasp,  'immature',        N'Immature (%)',        'condition'),
  (@rasp,  'split',           N'Split (%)',           'condition'),
  (@rasp,  'mold',            N'Mold (%)',            'condition'),
  (@rasp,  'decay',           N'Decay (%)',           'condition'),
  (@rasp,  'broken_cells',    N'Broken Cells (%)',    'condition'),
  (@rasp,  'dry_cells',       N'Dry Cells (%)',       'condition'),
  (@rasp,  'freeze_damage',   N'Freeze Damage (%)',   'condition'),
  -- BLACKBERRY
  (@black, 'overripe',        N'Overripe (%)',        'condition'),
  (@black, 'immature',        N'Immature (%)',        'condition'),
  (@black, 'cell_regression', N'Cell Regression (%)', 'condition'),
  (@black, 'mold',            N'Mold (%)',            'condition'),
  (@black, 'decay',           N'Decay (%)',           'condition'),
  (@black, 'white_cells',     N'White Cells (%)',     'condition'),
  (@black, 'dry_cells',       N'Dry Cells (%)',       'condition'),
  (@black, 'freeze_damage',   N'Freeze Damage (%)',   'condition')
) v(cid, code, label, family)
WHERE v.cid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM qc.defects d WHERE d.commodity_id=v.cid AND d.family=v.family AND d.code=v.code);
GO

-- ===== Plantillas v1 + sus defectos =====
DECLARE @straw INT = (SELECT id FROM qc.commodities WHERE code='STRAWBERRY');
DECLARE @rasp  INT = (SELECT id FROM qc.commodities WHERE code='RASPBERRY');
DECLARE @black INT = (SELECT id FROM qc.commodities WHERE code='BLACKBERRY');

INSERT INTO qc.metric_templates (commodity_id, version, name, active)
SELECT v.cid, 1, v.name, 1 FROM (VALUES
  (@straw, N'Standard Strawberries'),
  (@rasp,  N'Standard Raspberries'),
  (@black, N'Standard Blackberries')
) v(cid, name)
WHERE v.cid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM qc.metric_templates t WHERE t.commodity_id=v.cid AND t.version=1);

INSERT INTO qc.template_defects (template_id, defect_id, required, order_index)
SELECT mt.id, d.id, 0, d.id
FROM qc.metric_templates mt
JOIN qc.defects d ON d.commodity_id = mt.commodity_id
WHERE mt.version = 1
  AND mt.commodity_id IN (@straw, @rasp, @black)
  AND NOT EXISTS (SELECT 1 FROM qc.template_defects td WHERE td.template_id=mt.id AND td.defect_id=d.id);
GO
