-- 0015_arrival_manifest.sql
-- Manifiesto del contenedor (Shipping Detail Report de Famous): una fila por
-- pallet+grower. Un pallet puede repetirse (combineflag '*' = pallet compartido
-- entre growers/fechas de cosecha) — la UI agrupa por pallet_code.
IF OBJECT_ID('qc.arrival_manifest') IS NULL
BEGIN
  CREATE TABLE qc.arrival_manifest (
    id INT IDENTITY(1,1) CONSTRAINT PK_qc_arrival_manifest PRIMARY KEY,
    arrival_id INT NOT NULL CONSTRAINT FK_qc_arrival_manifest_arrival REFERENCES qc.arrivals(id),
    pallet_code VARCHAR(50) NOT NULL,
    grower_code NVARCHAR(40) NULL,
    combined BIT NOT NULL CONSTRAINT DF_qc_arrival_manifest_combined DEFAULT 0,
    cases INT NULL,
    lot_code VARCHAR(80) NULL,
    recv_date DATE NULL,
    variety NVARCHAR(120) NULL,
    packaging NVARCHAR(80) NULL,
    origin NVARCHAR(80) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_qc_arrival_manifest_created DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_qc_arrival_manifest_arrival ON qc.arrival_manifest (arrival_id, pallet_code);
END
GO
