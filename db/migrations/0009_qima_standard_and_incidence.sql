-- 0009_qima_standard_and_incidence.sql
-- (1) Estándar QIMA de arándano como segundo estándar (Product_Standard_Blueberries_Qima.pdf,
--     "Berries Vs1 / Category A" 09/05/2023) — tolerancias completas incluidas las sumas.
-- (2) Defectos QIMA que faltaban: SO2 Damage, Sunken Areas, Freezing Damage (+ template).
-- (3) Tolerancias de INCIDENCIA de Decay/Mold para FTF Destino (tabla oficial QC Inspec:
--     0 · 1-2 Fair · 2-5 Poor · >5 Bad). El motor banda unidades 'count' desde este release.

DECLARE @blue INT = (SELECT id FROM qc.commodities WHERE code='BLUEBERRY');

-- ===== Defectos nuevos =====
INSERT INTO qc.defects (commodity_id, code, label, family, value_type, unit)
SELECT @blue, v.code, v.label, 'condition', 'number', '%' FROM (VALUES
  ('so2_damage',      N'SO2 Damage (%)'),
  ('sunken_areas',    N'Sunken Areas (%)'),
  ('freezing_damage', N'Freezing Damage (%)')
) v(code,label)
WHERE NOT EXISTS (SELECT 1 FROM qc.defects d WHERE d.commodity_id=@blue AND d.family='condition' AND d.code=v.code);

DECLARE @tpl INT = (SELECT id FROM qc.metric_templates WHERE commodity_id=@blue AND version=1);
INSERT INTO qc.template_defects (template_id, defect_id, required, order_index)
SELECT @tpl, d.id, 0, d.id
FROM qc.defects d
WHERE d.commodity_id=@blue AND d.code IN ('so2_damage','sunken_areas','freezing_damage')
  AND NOT EXISTS (SELECT 1 FROM qc.template_defects td WHERE td.template_id=@tpl AND td.defect_id=d.id);
GO

-- ===== Estándar QIMA =====
DECLARE @blue INT = (SELECT id FROM qc.commodities WHERE code='BLUEBERRY');
INSERT INTO qc.quality_standards (name, commodity_id, destination_id, active)
SELECT N'QIMA', @blue, NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM qc.quality_standards s WHERE s.commodity_id=@blue AND s.name=N'QIMA');

DECLARE @qima INT = (SELECT id FROM qc.quality_standards WHERE commodity_id=@blue AND name=N'QIMA');

INSERT INTO qc.defect_tolerances (standard_id, defect_id, band, band_label, min_pct, max_pct)
SELECT @qima, d.id, t.band, t.lbl, t.mn, t.mx
FROM (VALUES
  -- Quality
  ('dust',1,'Excellent',0,0),('dust',3,'Fair',0.01,10),('dust',4,'Poor',10.01,30),('dust',5,'Bad',30.01,NULL),
  ('contamination',1,'Excellent',0,0),('contamination',4,'Poor',0.01,10),('contamination',5,'Bad',10.01,NULL),
  ('bloom_pct',1,'Excellent',80.01,100),('bloom_pct',2,'Good',0,80),
  ('russet_scars',1,'Excellent',0,4),('russet_scars',2,'Good',4.01,8),('russet_scars',3,'Fair',8.01,15),('russet_scars',4,'Poor',15.01,25),('russet_scars',5,'Bad',25.01,NULL),
  ('attached_stems',1,'Excellent',0,4),('attached_stems',2,'Good',4.01,8),('attached_stems',3,'Fair',8.01,25),('attached_stems',4,'Poor',25.01,50),('attached_stems',5,'Bad',50.01,NULL),
  ('no_bloom',1,'Excellent',0,4),('no_bloom',2,'Good',4.01,8),('no_bloom',3,'Fair',8.01,25),('no_bloom',4,'Poor',25.01,50),('no_bloom',5,'Bad',50.01,NULL),
  ('flower_remains',1,'Excellent',0,4),('flower_remains',2,'Good',4.01,8),('flower_remains',3,'Fair',8.01,15),('flower_remains',4,'Poor',15.01,25),('flower_remains',5,'Bad',25.01,NULL),
  ('undersize',1,'Excellent',0,4),('undersize',2,'Good',4.01,8),('undersize',3,'Fair',8.01,15),('undersize',4,'Poor',15.01,25),('undersize',5,'Bad',25.01,NULL),
  ('immature_red',1,'Excellent',0,4),('immature_red',2,'Good',4.01,8),('immature_red',3,'Fair',8.01,25),('immature_red',4,'Poor',25.01,50),('immature_red',5,'Bad',50.01,NULL),
  -- Condition
  ('decay',1,'Excellent',0,0),('decay',3,'Fair',0.01,1),('decay',4,'Poor',1.01,2),('decay',5,'Bad',2.01,NULL),
  ('decay_incidence',1,'Excellent',0,10),
  ('mold',1,'Excellent',0,0),('mold',3,'Fair',0.01,1),('mold',4,'Poor',1.01,2),('mold',5,'Bad',2.01,NULL),
  ('mold_incidence',1,'Excellent',0,10),
  ('soft',1,'Excellent',0,3),('soft',2,'Good',3.01,6),('soft',3,'Fair',6.01,10),('soft',4,'Poor',10.01,20),('soft',5,'Bad',20.01,NULL),
  ('sensitive',1,'Excellent',0,12),('sensitive',2,'Good',12.01,24),('sensitive',3,'Fair',24.01,40),('sensitive',4,'Poor',40.01,80),('sensitive',5,'Bad',80.01,NULL),
  ('shriveling',1,'Excellent',0,3),('shriveling',2,'Good',3.01,6),('shriveling',3,'Fair',6.01,12),('shriveling',4,'Poor',12.01,20),('shriveling',5,'Bad',20.01,NULL),
  ('broken_skin',1,'Excellent',0,1),('broken_skin',2,'Good',1.01,2),('broken_skin',3,'Fair',2.01,4),('broken_skin',4,'Poor',4.01,10),('broken_skin',5,'Bad',10.01,NULL),
  ('wounds',1,'Excellent',0,1),('wounds',2,'Good',1.01,2),('wounds',3,'Fair',2.01,4),('wounds',4,'Poor',4.01,10),('wounds',5,'Bad',10.01,NULL),
  ('crushed',1,'Excellent',0,0),('crushed',3,'Fair',0.01,1),('crushed',4,'Poor',1.01,4),('crushed',5,'Bad',4.01,NULL),
  ('wet_berries',1,'Excellent',0,1),('wet_berries',2,'Good',1.01,2),('wet_berries',3,'Fair',2.01,4),('wet_berries',4,'Poor',4.01,10),('wet_berries',5,'Bad',10.01,NULL),
  ('so2_damage',1,'Excellent',0,2),('so2_damage',2,'Good',2.01,4),('so2_damage',3,'Fair',4.01,8),('so2_damage',4,'Poor',8.01,20),('so2_damage',5,'Bad',20.01,NULL),
  ('sunken_areas',1,'Excellent',0,3),('sunken_areas',2,'Good',3.01,6),('sunken_areas',3,'Fair',6.01,10),('sunken_areas',4,'Poor',10.01,20),('sunken_areas',5,'Bad',20.01,NULL),
  ('freezing_damage',1,'Excellent',0,1),('freezing_damage',2,'Good',1.01,2),('freezing_damage',3,'Fair',2.01,4),('freezing_damage',4,'Poor',4.01,10),('freezing_damage',5,'Bad',10.01,NULL),
  -- Sumas
  ('sum_quality',1,'Excellent',0,6),('sum_quality',2,'Good',6.01,12),('sum_quality',3,'Fair',12.01,25),('sum_quality',4,'Poor',25.01,50),('sum_quality',5,'Bad',50.01,NULL),
  ('sum_condition',1,'Excellent',0,4),('sum_condition',2,'Good',4.01,8),('sum_condition',3,'Fair',8.01,15),('sum_condition',4,'Poor',15.01,25),('sum_condition',5,'Bad',25.01,NULL),
  ('sum_total',1,'Excellent',0,6),('sum_total',2,'Good',6.01,12),('sum_total',3,'Fair',12.01,25),('sum_total',4,'Poor',25.01,50),('sum_total',5,'Bad',50.01,NULL)
) t(dcode,band,lbl,mn,mx)
JOIN qc.defects d ON d.commodity_id=@blue AND d.code=t.dcode
WHERE NOT EXISTS (SELECT 1 FROM qc.defect_tolerances x WHERE x.standard_id=@qima AND x.defect_id=d.id AND x.band=t.band);
GO

-- ===== Incidencias en FTF Destino (tabla oficial QC Inspec) =====
DECLARE @blue INT = (SELECT id FROM qc.commodities WHERE code='BLUEBERRY');
DECLARE @ftf INT = (SELECT id FROM qc.quality_standards WHERE commodity_id=@blue AND name=N'FTF Destino');

INSERT INTO qc.defect_tolerances (standard_id, defect_id, band, band_label, min_pct, max_pct)
SELECT @ftf, d.id, t.band, t.lbl, t.mn, t.mx
FROM (VALUES
  ('decay_incidence',1,'Excellent',0,0),('decay_incidence',3,'Fair',1,2),('decay_incidence',4,'Poor',2.01,5),('decay_incidence',5,'Bad',5.01,NULL),
  ('mold_incidence',1,'Excellent',0,0),('mold_incidence',3,'Fair',1,2),('mold_incidence',4,'Poor',2.01,5),('mold_incidence',5,'Bad',5.01,NULL)
) t(dcode,band,lbl,mn,mx)
JOIN qc.defects d ON d.commodity_id=@blue AND d.code=t.dcode
WHERE NOT EXISTS (SELECT 1 FROM qc.defect_tolerances x WHERE x.standard_id=@ftf AND x.defect_id=d.id AND x.band=t.band);
GO
