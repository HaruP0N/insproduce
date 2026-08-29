-- 0014_arrival_files.sql
-- Archivos adjuntos del arribo (PDFs de lectores de temperatura, etc.) —
-- sección "Files" del reporte QC Inspec de destino.
IF OBJECT_ID('qc.arrival_files') IS NULL
BEGIN
  CREATE TABLE qc.arrival_files (
    id INT IDENTITY(1,1) CONSTRAINT PK_qc_arrival_files PRIMARY KEY,
    arrival_id INT NOT NULL CONSTRAINT FK_qc_arrival_files_arrival REFERENCES qc.arrivals(id),
    file_name NVARCHAR(200) NOT NULL,
    description NVARCHAR(300) NULL,
    url NVARCHAR(500) NOT NULL,
    public_id NVARCHAR(200) NULL,
    uploaded_by_user_id INT NULL CONSTRAINT FK_qc_arrival_files_user REFERENCES qc.users(id),
    created_at DATETIME2 NOT NULL CONSTRAINT DF_qc_arrival_files_created DEFAULT SYSUTCDATETIME(),
    deleted_at DATETIME2 NULL
  );
  CREATE INDEX IX_qc_arrival_files_arrival ON qc.arrival_files (arrival_id);
END
GO
