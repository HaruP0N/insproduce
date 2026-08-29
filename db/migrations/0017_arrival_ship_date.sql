-- 0017_arrival_ship_date.sql
-- Fecha de embarque del contenedor (shipdatetime del Shipping Detail Report).
IF COL_LENGTH('qc.arrivals','ship_date') IS NULL
  ALTER TABLE qc.arrivals ADD ship_date DATE NULL;
GO
