-- 0005_drop_legacy_dbo.sql
-- FASE 6 (cutover/limpieza): elimina el esquema legacy en dbo. El backend ya corre 100% sobre qc.
-- Backup previo en .planning/2026-06-13-backend-db-refactor/db-backup-data.json (8 tablas).
-- Se conserva dbo.schema_migrations (metadatos del runner). Orden: respeta FKs (hijos primero).

IF OBJECT_ID('dbo.vw_inspections_admin', 'V') IS NOT NULL DROP VIEW dbo.vw_inspections_admin;
GO
DROP TABLE IF EXISTS dbo.inspection_pdfs;
DROP TABLE IF EXISTS dbo.inspection_photos;
DROP TABLE IF EXISTS dbo.inspections;        -- dropea sus triggers (trg_inspections_updated_at)
DROP TABLE IF EXISTS dbo.metric_fields;
DROP TABLE IF EXISTS dbo.metric_templates;
DROP TABLE IF EXISTS dbo.assignments;
DROP TABLE IF EXISTS dbo.commodities;
DROP TABLE IF EXISTS dbo.users;              -- dropea sus triggers (trg_users_updated_at)
GO
