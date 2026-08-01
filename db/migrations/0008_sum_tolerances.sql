-- 0008_sum_tolerances.sql
-- Score sobre SUMAS de defectos ("Suma Calidad" / "Suma Condición" / "Suma Total").
-- En los reportes reales (Destiny Report 17694, pantallazos QCInspec) el causal más
-- frecuente es "Condition Sum": la suma de defectos se banda igual que un defecto
-- individual. Bandas tomadas del estándar QIMA (Product_Standard_Blueberries_Qima.pdf),
-- validadas contra los reportes QCInspec de la carpeta insproduce_data:
--   Suma Condición 5,93% y 6,03% → G ✓ (banda G = 4,01-8) · 9,25% → F ✓ (8,01-15)
-- Se modelan como pseudo-defectos (family 'measurement') SIN entrada en template
-- (no se capturan: el motor los calcula). results.js los banda desde 0008.

DECLARE @blue INT = (SELECT id FROM qc.commodities WHERE code='BLUEBERRY');

INSERT INTO qc.defects (commodity_id, code, label, family, value_type, unit)
SELECT @blue, v.code, v.label, 'measurement', 'number', '%' FROM (VALUES
  ('sum_quality',   N'Suma Calidad (%)'),
  ('sum_condition', N'Suma Condición (%)'),
  ('sum_total',     N'Suma Total (%)')
) v(code,label)
WHERE NOT EXISTS (SELECT 1 FROM qc.defects d WHERE d.commodity_id=@blue AND d.family='measurement' AND d.code=v.code);

DECLARE @std INT = (SELECT id FROM qc.quality_standards WHERE commodity_id=@blue AND name=N'FTF Destino');

INSERT INTO qc.defect_tolerances (standard_id, defect_id, band, band_label, min_pct, max_pct)
SELECT @std, d.id, t.band, t.lbl, t.mn, t.mx
FROM (VALUES
  ('sum_quality',  1,'Excellent',0,6),  ('sum_quality',  2,'Good',6.01,12), ('sum_quality',  3,'Fair',12.01,25),('sum_quality',  4,'Poor',25.01,50),('sum_quality',  5,'Bad',50.01,NULL),
  ('sum_condition',1,'Excellent',0,4),  ('sum_condition',2,'Good',4.01,8),  ('sum_condition',3,'Fair',8.01,15), ('sum_condition',4,'Poor',15.01,25),('sum_condition',5,'Bad',25.01,NULL),
  ('sum_total',    1,'Excellent',0,6),  ('sum_total',    2,'Good',6.01,12), ('sum_total',    3,'Fair',12.01,25),('sum_total',    4,'Poor',25.01,50),('sum_total',    5,'Bad',50.01,NULL)
) t(dcode,band,lbl,mn,mx)
JOIN qc.defects d ON d.commodity_id=@blue AND d.code=t.dcode AND d.family='measurement'
WHERE NOT EXISTS (SELECT 1 FROM qc.defect_tolerances x WHERE x.standard_id=@std AND x.defect_id=d.id AND x.band=t.band);
GO
