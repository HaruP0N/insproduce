-- 0012_standard_updated_at.sql
-- Trazabilidad de estándares: cuándo se actualizó cada uno por última vez y de qué
-- documento oficial provienen sus tolerancias. Baseline = hoy; desde ahora, cada
-- edición de bandas (upsertDefectTolerances) refresca updated_at.

IF COL_LENGTH('qc.quality_standards', 'updated_at') IS NULL
  ALTER TABLE qc.quality_standards ADD updated_at DATETIME2(3) NULL;
GO
IF COL_LENGTH('qc.quality_standards', 'source_doc') IS NULL
  ALTER TABLE qc.quality_standards ADD source_doc NVARCHAR(200) NULL;
GO

UPDATE qc.quality_standards SET updated_at = SYSUTCDATETIME() WHERE updated_at IS NULL;

UPDATE s SET s.source_doc = v.doc
FROM qc.quality_standards s
JOIN (VALUES
  (N'FTF Destino',      N'Destino FTF QC INSP.pdf — QC Inspec'),
  (N'QIMA',             N'Product Standard Blueberries — QIMA v1 (may 2023)'),
  (N'Origen RR',        N'Quality Specs at Origin by label (ago 2026)'),
  (N'Origen FTF',       N'Quality Specs at Origin by label (ago 2026)'),
  (N'Origen Premium',   N'Quality Specs at Origin by label (ago 2026)'),
  (N'Destino FTF v1.2', N'Quality Specs at Destination v1.2 (ago 2026)')
) v(name, doc) ON v.name = s.name
WHERE s.source_doc IS NULL;
GO
