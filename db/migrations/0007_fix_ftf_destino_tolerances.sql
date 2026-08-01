-- 0007_fix_ftf_destino_tolerances.sql
-- Corrige el estándar "FTF Destino" de arándano contra la tabla OFICIAL de QC Inspec
-- ("Destino FTF QC INSP.pdf" / pág. 9 de "Notas Repote.pdf", carpeta insproduce_data).
-- El seed 0002 mezcló valores QIMA bajo el nombre FTF Destino. Diferencias corregidas:
--   attached_stems  F/P: 25/50  -> 15/25
--   immature_red    F/P: 25/50  -> 15/25
--   sensitive       E/G/F/P: 12/24/40/80 -> 5/15/30/50
--   decay           P: 2  -> 4     (Bad desde 4,01)
--   mold            P: 2  -> 4     (Bad desde 4,01)
--   crushed         P: 4  -> 6     (Bad desde 6,01)
--   undersize       en FTF Destino NO penaliza (banda 1 = 0-100)
-- Y agrega los defectos tolerados por FTF que faltaban:
--   sunken_cap_stems (quality, 4/8/15/25), bruises (condition, 4/8/10/12),
--   wet_berries (condition, 1/2/4/10), underweight (condition, 0/-/20/40)

DECLARE @blue INT = (SELECT id FROM qc.commodities WHERE code='BLUEBERRY');
DECLARE @std  INT = (SELECT id FROM qc.quality_standards WHERE commodity_id=@blue AND name=N'FTF Destino');

-- ===== Correcciones de bandas existentes =====
UPDATE dt SET dt.min_pct=v.mn, dt.max_pct=v.mx
FROM qc.defect_tolerances dt
JOIN qc.defects d ON d.id=dt.defect_id AND d.commodity_id=@blue
JOIN (VALUES
  ('attached_stems',3, 8.01,15),   ('attached_stems',4,15.01,25),   ('attached_stems',5,25.01,NULL),
  ('immature_red',  3, 8.01,15),   ('immature_red',  4,15.01,25),   ('immature_red',  5,25.01,NULL),
  ('sensitive',     1, 0,    5),   ('sensitive',     2, 5.01,15),   ('sensitive',     3,15.01,30),
  ('sensitive',     4,30.01,50),   ('sensitive',     5,50.01,NULL),
  ('decay',         4, 1.01, 4),   ('decay',         5, 4.01,NULL),
  ('mold',          4, 1.01, 4),   ('mold',          5, 4.01,NULL),
  ('crushed',       4, 1.01, 6),   ('crushed',       5, 6.01,NULL)
) v(code,band,mn,mx) ON v.code=d.code AND v.band=dt.band
WHERE dt.standard_id=@std;

-- undersize: FTF Destino no lo penaliza (banda única 0-100)
DELETE dt FROM qc.defect_tolerances dt
JOIN qc.defects d ON d.id=dt.defect_id AND d.commodity_id=@blue AND d.code='undersize'
WHERE dt.standard_id=@std AND dt.band > 1;

UPDATE dt SET dt.min_pct=0, dt.max_pct=100
FROM qc.defect_tolerances dt
JOIN qc.defects d ON d.id=dt.defect_id AND d.commodity_id=@blue AND d.code='undersize'
WHERE dt.standard_id=@std AND dt.band=1;
GO

-- ===== Defectos nuevos (tabla oficial FTF) =====
DECLARE @blue INT = (SELECT id FROM qc.commodities WHERE code='BLUEBERRY');

INSERT INTO qc.defects (commodity_id, code, label, family, value_type, unit)
SELECT @blue, v.code, v.label, v.family, 'number', '%' FROM (VALUES
  ('sunken_cap_stems', N'Sunken Cap Stems (%)', 'quality'),
  ('bruises',          N'Bruises (%)',          'condition'),
  ('wet_berries',      N'Wet Berries (%)',      'condition'),
  ('underweight',      N'UnderWeight (%)',      'condition')
) v(code,label,family)
WHERE NOT EXISTS (SELECT 1 FROM qc.defects d WHERE d.commodity_id=@blue AND d.family=v.family AND d.code=v.code);

-- Al template activo de arándano
DECLARE @tpl INT = (SELECT id FROM qc.metric_templates WHERE commodity_id=@blue AND version=1);
INSERT INTO qc.template_defects (template_id, defect_id, required, order_index)
SELECT @tpl, d.id, 0, d.id
FROM qc.defects d
WHERE d.commodity_id=@blue AND d.code IN ('sunken_cap_stems','bruises','wet_berries','underweight')
  AND NOT EXISTS (SELECT 1 FROM qc.template_defects td WHERE td.template_id=@tpl AND td.defect_id=d.id);

-- Sus tolerancias FTF Destino
DECLARE @std INT = (SELECT id FROM qc.quality_standards WHERE commodity_id=@blue AND name=N'FTF Destino');
INSERT INTO qc.defect_tolerances (standard_id, defect_id, band, band_label, min_pct, max_pct)
SELECT @std, d.id, t.band, t.lbl, t.mn, t.mx
FROM (VALUES
  ('sunken_cap_stems',1,'Excellent',0,4),('sunken_cap_stems',2,'Good',4.01,8),('sunken_cap_stems',3,'Fair',8.01,15),('sunken_cap_stems',4,'Poor',15.01,25),('sunken_cap_stems',5,'Bad',25.01,NULL),
  ('bruises',1,'Excellent',0,4),('bruises',2,'Good',4.01,8),('bruises',3,'Fair',8.01,10),('bruises',4,'Poor',10.01,12),('bruises',5,'Bad',12.01,NULL),
  ('wet_berries',1,'Excellent',0,1),('wet_berries',2,'Good',1.01,2),('wet_berries',3,'Fair',2.01,4),('wet_berries',4,'Poor',4.01,10),('wet_berries',5,'Bad',10.01,NULL),
  ('underweight',1,'Excellent',0,0),('underweight',3,'Fair',0.01,20),('underweight',4,'Poor',20.01,40),('underweight',5,'Bad',40.01,NULL)
) t(dcode,band,lbl,mn,mx)
JOIN qc.defects d ON d.commodity_id=@blue AND d.code=t.dcode
WHERE NOT EXISTS (SELECT 1 FROM qc.defect_tolerances x WHERE x.standard_id=@std AND x.defect_id=d.id AND x.band=t.band);
GO
