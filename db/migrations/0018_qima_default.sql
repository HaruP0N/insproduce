-- 0018_qima_default.sql
-- QIMA Vs1 (Product_Standard_Blueberries_Qima 2.pdf, 09/05/2023) pasa a ser el
-- estándar por defecto de arándanos. Los demás se DESACTIVAN (no se borran:
-- inspecciones históricas los referencian y siguen visibles en Tolerancias).
-- Además: Immature Red es defecto de CALIDAD según el spec QIMA (estaba como
-- condición desde el seed 0002) y las incidencias de decay/mold parten en 1.

-- (1) familia según el spec oficial
UPDATE d SET d.family='quality'
FROM qc.defects d JOIN qc.commodities c ON c.id=d.commodity_id
WHERE c.code='BLUEBERRY' AND d.code='immature_red' AND d.family<>'quality';
GO

-- (2) incidencias QIMA: Excellent 1-10 (el PDF parte en 1; 0 queda sin banda)
UPDATE t SET t.min_pct=1
FROM qc.defect_tolerances t
JOIN qc.defects d ON d.id=t.defect_id
JOIN qc.commodities c ON c.id=d.commodity_id
JOIN qc.quality_standards s ON s.id=t.standard_id
WHERE c.code='BLUEBERRY' AND s.name='QIMA' AND d.code IN ('decay_incidence','mold_incidence') AND t.band=1;
GO

-- (3) QIMA queda como único activo (= default del motor: menor id activo)
UPDATE s SET s.active=0, s.updated_at=SYSUTCDATETIME()
FROM qc.quality_standards s JOIN qc.commodities c ON c.id=s.commodity_id
WHERE c.code='BLUEBERRY' AND s.name<>'QIMA' AND s.active=1;
GO

UPDATE s SET s.updated_at=SYSUTCDATETIME(),
             s.source_doc='Product_Standard_Blueberries_Qima 2.pdf (Vs1, 09/05/2023)'
FROM qc.quality_standards s JOIN qc.commodities c ON c.id=s.commodity_id
WHERE c.code='BLUEBERRY' AND s.name='QIMA';
GO
