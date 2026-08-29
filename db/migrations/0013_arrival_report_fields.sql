-- 0013_arrival_report_fields.sql
-- Encabezado del reporte de contenedor (QC Inspec destino):
-- (1) qc.arrivals gana los campos del header real (orden, shipper, packaging, airline,
--     label, cliente, grower, destino, packing/inspection date).
-- (2) qc.arrival_notes: notas tipificadas del reporte (Quality & Condition, Temperature,
--     Traceability, Package, Temperature Record) — una fila por tipo.
-- (3) qc.assignments gana pallet_number y arrival_id: la info de los pallets suele estar
--     disponible ~2 semanas antes; se precarga y luego se asigna la inspección.

IF COL_LENGTH('qc.arrivals','order_number')    IS NULL ALTER TABLE qc.arrivals ADD order_number NVARCHAR(40) NULL;
IF COL_LENGTH('qc.arrivals','shipper')         IS NULL ALTER TABLE qc.arrivals ADD shipper NVARCHAR(120) NULL;
IF COL_LENGTH('qc.arrivals','packaging')       IS NULL ALTER TABLE qc.arrivals ADD packaging NVARCHAR(60) NULL;
IF COL_LENGTH('qc.arrivals','airline')         IS NULL ALTER TABLE qc.arrivals ADD airline NVARCHAR(60) NULL;
IF COL_LENGTH('qc.arrivals','label')           IS NULL ALTER TABLE qc.arrivals ADD label NVARCHAR(60) NULL;
IF COL_LENGTH('qc.arrivals','client')          IS NULL ALTER TABLE qc.arrivals ADD client NVARCHAR(120) NULL;
IF COL_LENGTH('qc.arrivals','grower')          IS NULL ALTER TABLE qc.arrivals ADD grower NVARCHAR(120) NULL;
IF COL_LENGTH('qc.arrivals','destination')     IS NULL ALTER TABLE qc.arrivals ADD destination NVARCHAR(80) NULL;
IF COL_LENGTH('qc.arrivals','packing_date')    IS NULL ALTER TABLE qc.arrivals ADD packing_date DATE NULL;
IF COL_LENGTH('qc.arrivals','inspection_date') IS NULL ALTER TABLE qc.arrivals ADD inspection_date DATE NULL;
GO

IF OBJECT_ID('qc.arrival_notes') IS NULL
BEGIN
  CREATE TABLE qc.arrival_notes (
    id INT IDENTITY(1,1) CONSTRAINT PK_qc_arrival_notes PRIMARY KEY,
    arrival_id INT NOT NULL CONSTRAINT FK_qc_arrival_notes_arrival REFERENCES qc.arrivals(id),
    note_type VARCHAR(40) NOT NULL,
    note NVARCHAR(MAX) NULL,
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_qc_arrival_notes_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_qc_arrival_notes UNIQUE (arrival_id, note_type)
  );
END
GO

IF COL_LENGTH('qc.assignments','pallet_number') IS NULL ALTER TABLE qc.assignments ADD pallet_number VARCHAR(50) NULL;
IF COL_LENGTH('qc.assignments','arrival_id') IS NULL
  ALTER TABLE qc.assignments ADD arrival_id INT NULL CONSTRAINT FK_qc_assignments_arrival REFERENCES qc.arrivals(id);
GO
