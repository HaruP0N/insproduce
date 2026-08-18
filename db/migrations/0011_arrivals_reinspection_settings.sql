-- 0011_arrivals_reinspection_settings.sql
-- (1) Arribos: agrupa inspecciones por contenedor (modelo del Destiny Report:
--     1 contenedor → N pallets inspeccionados). Las inspecciones existentes no cambian;
--     ganan un arrival_id opcional.
-- (2) Reinspecciones: inspections.reinspection_of enlaza la nueva inspección con la
--     original del mismo pallet (flujo del manual: se piden viernes, se hacen lunes).
-- (3) qc.app_settings: clave/valor para estado de la app (p.ej. última sync de Sheets).

IF OBJECT_ID('qc.arrivals') IS NULL
BEGIN
  CREATE TABLE qc.arrivals (
    id INT IDENTITY(1,1) CONSTRAINT PK_qc_arrivals PRIMARY KEY,
    container NVARCHAR(40) NOT NULL,
    commodity_id INT NULL CONSTRAINT FK_qc_arrivals_commodity REFERENCES qc.commodities(id),
    warehouse NVARCHAR(80) NULL,
    carrier_type NVARCHAR(30) NULL,
    vessel NVARCHAR(60) NULL,
    arrival_date DATE NULL,
    warehouse_date DATE NULL,
    week_no INT NULL,
    cartons INT NULL,
    atmosphere NVARCHAR(20) NULL,
    o2_pct DECIMAL(5,2) NULL,
    co2_pct DECIMAL(5,2) NULL,
    upc NVARCHAR(30) NULL,
    fumigation BIT NOT NULL CONSTRAINT DF_qc_arrivals_fumigation DEFAULT 0,
    notes NVARCHAR(1000) NULL,
    created_by_user_id INT NULL CONSTRAINT FK_qc_arrivals_user REFERENCES qc.users(id),
    created_at DATETIME2 NOT NULL CONSTRAINT DF_qc_arrivals_created DEFAULT SYSUTCDATETIME(),
    deleted_at DATETIME2 NULL
  );
  CREATE INDEX IX_qc_arrivals_container ON qc.arrivals (container);
END
GO

IF COL_LENGTH('qc.inspections', 'arrival_id') IS NULL
  ALTER TABLE qc.inspections ADD arrival_id INT NULL CONSTRAINT FK_qc_inspections_arrival REFERENCES qc.arrivals(id);
GO

IF COL_LENGTH('qc.inspections', 'reinspection_of') IS NULL
  ALTER TABLE qc.inspections ADD reinspection_of INT NULL CONSTRAINT FK_qc_inspections_reinsp REFERENCES qc.inspections(id);
GO

IF OBJECT_ID('qc.app_settings') IS NULL
BEGIN
  CREATE TABLE qc.app_settings (
    setting_key NVARCHAR(60) NOT NULL CONSTRAINT PK_qc_app_settings PRIMARY KEY,
    setting_value NVARCHAR(400) NULL,
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_qc_app_settings_updated DEFAULT SYSUTCDATETIME()
  );
END
GO
