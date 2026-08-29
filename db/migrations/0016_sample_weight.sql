-- 0016_sample_weight.sql
-- Peso de la muestra en GRAMOS (los inspectores pesan la fruta defectuosa en g;
-- el % se calcula como g defecto / g muestra * 100). Se trabaja en gramos, no kg.
IF COL_LENGTH('qc.inspections','sample_weight_g') IS NULL
  ALTER TABLE qc.inspections ADD sample_weight_g DECIMAL(9,1) NULL;
GO
