-- 0019_ten_pieces_weight.sql
-- Peso de 10 frutos en gramos ("10 Pieces Weight" del spec QIMA y del set de fotos FTF).
IF COL_LENGTH('qc.inspections','ten_pieces_weight_g') IS NULL
  ALTER TABLE qc.inspections ADD ten_pieces_weight_g DECIMAL(9,1) NULL;
GO
