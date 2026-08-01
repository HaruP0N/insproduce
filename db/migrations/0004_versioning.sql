-- 0004_versioning.sql
-- Trazabilidad activa: System-Versioning (temporal tables) en las entidades clave (DB-2).
-- Cada cambio queda historizado automáticamente en qc.<tabla>_History.
-- Idempotente (guardas por COL_LENGTH / temporal_type). Sin transacción envolvente (ver apply).

-- measurements: una tabla versionada no puede tener FK saliente con ON DELETE CASCADE.
-- Cambiamos FK_qc_measurements_inspection a NO_ACTION (con soft-delete el cascade no se usa).
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_qc_measurements_inspection' AND delete_referential_action=1)
BEGIN
  ALTER TABLE qc.inspection_measurements DROP CONSTRAINT FK_qc_measurements_inspection;
  ALTER TABLE qc.inspection_measurements ADD CONSTRAINT FK_qc_measurements_inspection
    FOREIGN KEY (inspection_id) REFERENCES qc.inspections(id);
END
GO

-- ===== users =====
IF COL_LENGTH('qc.users','ValidFrom') IS NULL
  ALTER TABLE qc.users ADD
    ValidFrom DATETIME2(3) GENERATED ALWAYS AS ROW START HIDDEN CONSTRAINT DF_qc_users_vf DEFAULT SYSUTCDATETIME(),
    ValidTo   DATETIME2(3) GENERATED ALWAYS AS ROW END   HIDDEN CONSTRAINT DF_qc_users_vt DEFAULT CONVERT(DATETIME2(3),'9999-12-31 23:59:59.999'),
    PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo);
GO
IF (SELECT temporal_type FROM sys.tables WHERE object_id=OBJECT_ID('qc.users'))=0
  ALTER TABLE qc.users SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = qc.users_History));
GO

-- ===== assignments =====
IF COL_LENGTH('qc.assignments','ValidFrom') IS NULL
  ALTER TABLE qc.assignments ADD
    ValidFrom DATETIME2(3) GENERATED ALWAYS AS ROW START HIDDEN CONSTRAINT DF_qc_assignments_vf DEFAULT SYSUTCDATETIME(),
    ValidTo   DATETIME2(3) GENERATED ALWAYS AS ROW END   HIDDEN CONSTRAINT DF_qc_assignments_vt DEFAULT CONVERT(DATETIME2(3),'9999-12-31 23:59:59.999'),
    PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo);
GO
IF (SELECT temporal_type FROM sys.tables WHERE object_id=OBJECT_ID('qc.assignments'))=0
  ALTER TABLE qc.assignments SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = qc.assignments_History));
GO

-- ===== inspections =====
IF COL_LENGTH('qc.inspections','ValidFrom') IS NULL
  ALTER TABLE qc.inspections ADD
    ValidFrom DATETIME2(3) GENERATED ALWAYS AS ROW START HIDDEN CONSTRAINT DF_qc_inspections_vf DEFAULT SYSUTCDATETIME(),
    ValidTo   DATETIME2(3) GENERATED ALWAYS AS ROW END   HIDDEN CONSTRAINT DF_qc_inspections_vt DEFAULT CONVERT(DATETIME2(3),'9999-12-31 23:59:59.999'),
    PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo);
GO
IF (SELECT temporal_type FROM sys.tables WHERE object_id=OBJECT_ID('qc.inspections'))=0
  ALTER TABLE qc.inspections SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = qc.inspections_History));
GO

-- ===== inspection_measurements =====
IF COL_LENGTH('qc.inspection_measurements','ValidFrom') IS NULL
  ALTER TABLE qc.inspection_measurements ADD
    ValidFrom DATETIME2(3) GENERATED ALWAYS AS ROW START HIDDEN CONSTRAINT DF_qc_meas_vf DEFAULT SYSUTCDATETIME(),
    ValidTo   DATETIME2(3) GENERATED ALWAYS AS ROW END   HIDDEN CONSTRAINT DF_qc_meas_vt DEFAULT CONVERT(DATETIME2(3),'9999-12-31 23:59:59.999'),
    PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo);
GO
IF (SELECT temporal_type FROM sys.tables WHERE object_id=OBJECT_ID('qc.inspection_measurements'))=0
  ALTER TABLE qc.inspection_measurements SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = qc.inspection_measurements_History));
GO
