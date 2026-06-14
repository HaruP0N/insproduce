# Plan de Refactor de Base de Datos — `fruticola_2026` (Azure SQL)

> Plan escrito con la skill **writing-plans**. Estrategia elegida: **rediseño total (greenfield) + migración de datos (backfill + limpieza)**. Origen de hallazgos: [db-audit-findings.md](db-audit-findings.md) (IDs DB-1..DB-36). NO ejecutar todavía — este documento es para revisión; la ejecución es el paso 3.

**Goal:** Reemplazar el esquema plano + JSON actual por un modelo normalizado en 3NF que (a) modela el dominio QC real (Lote→Pallet→Muestra, defectos por familia, tolerancias por destino, score/resolución), (b) tiene trazabilidad completa (audit_log + temporal tables + soft-delete + versionado de métricas/PDF), y (c) sanea los datos actuales mediante backfill.

**Architecture:** Azure SQL (SQL Server 12.x). Migraciones SQL numeradas e idempotentes aplicadas por un runner Node (no hay ORM). Construcción del esquema nuevo en el mismo `fruticola_2026`; las 8 tablas actuales se renombran a `legacy_*` durante una ventana de mantenimiento, se crean las nuevas, se migran los datos y luego se elimina el legacy. App con 2 usuarios → ventana corta aceptable.

**Tech Stack:** SQL Server T-SQL, `mssql` (Node) para el runner y los scripts de backfill, `node`/`OPENJSON` para parsear el JSON actual.

**Decisión de estrategia (registrada):** greenfield + migrar datos. Pocos datos (3 inspecciones, 5 asignaciones, 24 fotos) → migración de bajo riesgo en volumen; el riesgo está en el código de la app (Fase 5).

---

## Resumen de tablas destino (25)

| Grupo | Tablas |
|---|---|
| Identidad/seguridad | `users` |
| Catálogos | `commodities`, `commodity_aliases`, `producers`, `customers`, `destinations`, `packaging_types` |
| Defectos/plantillas | `defects`, `defect_options`, `metric_templates`, `template_defects` |
| Estándares/tolerancias | `quality_standards`, `defect_tolerances`, `size_bands`, `color_bands`, `firmness_bands` |
| Trabajo/jerarquía | `assignments`, `lots`, `pallets` |
| Inspección/resultados | `inspections`, `samples`, `inspection_measurements`, `inspection_size_distribution`, `inspection_color_distribution`, `inspection_results`, `inspection_photos`, `inspection_pdf_versions` |
| Trazabilidad | `audit_log` (+ System-Versioning en tablas clave) |

Resuelve: DB-1..DB-36. Mapa de cobertura al final.

---

## FASE 0 — Preparación (sin tocar datos)

### Task 0.1 — Arreglar la conexión y versionar el esquema (DB-36)
**Files:** `src/lib/db/mssql.js`, `.env.example` (crear), `.env.local` (usuario)
- [ ] Decidir convención de env. Recomendado: el código sigue leyendo `DB_*`; el `.env.local` se corrige a:
```
DB_SERVER=fruticola.database.windows.net
DB_DATABASE=fruticola_2026
DB_USER=admin_Fruticola
DB_PASSWORD=********
DB_PORT=1433
```
- [ ] Crear `.env.example` con esas claves (sin valores).
- [ ] (Opcional) en `mssql.js`, aceptar fallback `process.env.DB_SERVER || process.env.AZURE_SQL_SERVER` para tolerar ambos.

### Task 0.2 — Tooling de migraciones
**Files:** `db/migrations/` (carpeta), `db/run-migrations.mjs`, tabla `schema_migrations`
- [ ] Crear runner que aplica `db/migrations/NNNN_*.sql` en orden, dentro de transacción, y registra cada uno:
```sql
CREATE TABLE dbo.schema_migrations (
  id        VARCHAR(100) NOT NULL CONSTRAINT PK_schema_migrations PRIMARY KEY, -- nombre del archivo
  applied_at DATETIME2(3) NOT NULL CONSTRAINT DF_schema_migrations_at DEFAULT SYSUTCDATETIME()
);
```
- [ ] `run-migrations.mjs`: lee `.env.local`, lista los `.sql` no aplicados (no presentes en `schema_migrations`), los ejecuta por lotes separados por `GO`, e inserta el registro. Idempotente.

### Task 0.3 — Backup completo previo
- [ ] Export BACPAC desde Azure Portal/SqlPackage **y** snapshot JSON (ya tenemos `db-introspection.json` + `db-sample.json`; ampliar `db-sample.mjs` para volcar el 100% de filas de las 8 tablas a `db-backup-data.json`).
- [ ] Verificar que el backup restaura en una BD scratch antes de continuar.

---

## FASE 1 — Esquema destino (DDL)

> Cada subsección es un archivo de migración. Construye las tablas NUEVAS. No se renombra legacy hasta la Fase 3 (cutover). Para evitar choque de nombres durante el build, las tablas nuevas se crean en un esquema `qc` y se mueven a `dbo` en el cutover **o** se crea todo en `dbo` tras renombrar legacy. Este plan asume: **renombrar legacy primero** (Fase 3 Task 3.0) y crear las nuevas en `dbo`. Para revisar el DDL aislado, aquí va completo.

### 1A — Identidad y catálogos (`db/migrations/0001_catalogs.sql`)
```sql
-- users (soft-delete + actor de cambios)
CREATE TABLE dbo.users (
  id              INT IDENTITY(1,1) CONSTRAINT PK_users PRIMARY KEY,
  name            NVARCHAR(100) NULL,
  email           VARCHAR(150) NOT NULL CONSTRAINT UQ_users_email UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(20) NOT NULL CONSTRAINT CK_users_role CHECK (role IN ('admin','inspector')),
  active          BIT NOT NULL CONSTRAINT DF_users_active DEFAULT 1,
  created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_users_created DEFAULT SYSUTCDATETIME(),
  updated_at      DATETIME2(3) NOT NULL CONSTRAINT DF_users_updated DEFAULT SYSUTCDATETIME(),
  updated_by_user_id INT NULL,
  deleted_at      DATETIME2(3) NULL,
  deleted_by_user_id INT NULL
);

CREATE TABLE dbo.commodities (        -- DB-9: dedup; UNIQUE(name)
  id              INT IDENTITY(1,1) CONSTRAINT PK_commodities PRIMARY KEY,
  code            VARCHAR(50) NOT NULL CONSTRAINT UQ_commodities_code UNIQUE,
  name            NVARCHAR(100) NOT NULL CONSTRAINT UQ_commodities_name UNIQUE,
  active          BIT NOT NULL CONSTRAINT DF_commodities_active DEFAULT 1,
  created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_commodities_created DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.commodity_aliases (  -- DB-8: HS code '0810' u otros sin contaminar el catálogo
  id              INT IDENTITY(1,1) CONSTRAINT PK_commodity_aliases PRIMARY KEY,
  commodity_id    INT NOT NULL CONSTRAINT FK_commodity_aliases_commodity REFERENCES dbo.commodities(id),
  alias_code      VARCHAR(50) NOT NULL,
  scheme          VARCHAR(30) NOT NULL,  -- 'HS' | 'internal' | 'es_name'
  CONSTRAINT UQ_commodity_aliases UNIQUE (scheme, alias_code)
);

CREATE TABLE dbo.producers (
  id              INT IDENTITY(1,1) CONSTRAINT PK_producers PRIMARY KEY,
  name            NVARCHAR(150) NOT NULL CONSTRAINT UQ_producers_name UNIQUE,
  active          BIT NOT NULL CONSTRAINT DF_producers_active DEFAULT 1
);

CREATE TABLE dbo.customers (          -- DB-4: 'Walmart USA' estructurado
  id              INT IDENTITY(1,1) CONSTRAINT PK_customers PRIMARY KEY,
  name            NVARCHAR(150) NOT NULL CONSTRAINT UQ_customers_name UNIQUE,
  active          BIT NOT NULL CONSTRAINT DF_customers_active DEFAULT 1
);

CREATE TABLE dbo.destinations (       -- mercado destino que rige tolerancias
  id              INT IDENTITY(1,1) CONSTRAINT PK_destinations PRIMARY KEY,
  code            VARCHAR(30) NOT NULL CONSTRAINT UQ_destinations_code UNIQUE,  -- 'US','EU','FTF'
  name            NVARCHAR(100) NOT NULL
);

CREATE TABLE dbo.packaging_types (    -- DB-7: regla de muestreo por embalaje (manual)
  id              INT IDENTITY(1,1) CONSTRAINT PK_packaging_types PRIMARY KEY,
  code            VARCHAR(50) NOT NULL CONSTRAINT UQ_packaging_types_code UNIQUE, -- '9.8OZ','PINT','18OZ'
  label           NVARCHAR(100) NOT NULL,
  net_weight_g    DECIMAL(8,2) NULL,
  sample_count    INT NULL,              -- nº muestras por pallet (6Oz=7, 9.8Oz=6, 18Oz=3...)
  active          BIT NOT NULL CONSTRAINT DF_packaging_active DEFAULT 1
);
```

### 1B — Defectos y plantillas (`0002_defects_templates.sql`)
```sql
CREATE TABLE dbo.defects (            -- DB-10/DB-11: diccionario canónico, familia como columna
  id              INT IDENTITY(1,1) CONSTRAINT PK_defects PRIMARY KEY,
  commodity_id    INT NOT NULL CONSTRAINT FK_defects_commodity REFERENCES dbo.commodities(id),
  code            VARCHAR(60) NOT NULL,             -- 'russet','decay' (SIN prefijo)
  label           NVARCHAR(120) NOT NULL,
  family          VARCHAR(15) NOT NULL CONSTRAINT CK_defects_family
                    CHECK (family IN ('quality','condition','packaging','measurement')),
  value_type      VARCHAR(15) NOT NULL CONSTRAINT CK_defects_valtype
                    CHECK (value_type IN ('number','select','boolean','text')),
  unit            VARCHAR(20) NULL,                 -- '%','mm','Shore'
  is_major        BIT NOT NULL CONSTRAINT DF_defects_major DEFAULT 0,
  active          BIT NOT NULL CONSTRAINT DF_defects_active DEFAULT 1,
  CONSTRAINT UQ_defects UNIQUE (commodity_id, family, code)
);

CREATE TABLE dbo.defect_options (     -- DB-12: opciones de selects normalizadas
  id              INT IDENTITY(1,1) CONSTRAINT PK_defect_options PRIMARY KEY,
  defect_id       INT NOT NULL CONSTRAINT FK_defect_options_defect REFERENCES dbo.defects(id) ON DELETE CASCADE,
  value           VARCHAR(50) NOT NULL,
  label           NVARCHAR(120) NOT NULL,
  order_index     INT NOT NULL CONSTRAINT DF_defect_options_order DEFAULT 0,
  CONSTRAINT UQ_defect_options UNIQUE (defect_id, value)
);

CREATE TABLE dbo.metric_templates (   -- DB-8: sin commodity_code; DB-33: name limpio
  id              INT IDENTITY(1,1) CONSTRAINT PK_metric_templates PRIMARY KEY,
  commodity_id    INT NOT NULL CONSTRAINT FK_templates_commodity REFERENCES dbo.commodities(id),
  version         INT NOT NULL CONSTRAINT DF_templates_version DEFAULT 1,
  name            NVARCHAR(120) NOT NULL,
  active          BIT NOT NULL CONSTRAINT DF_templates_active DEFAULT 1,
  created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_templates_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_templates_commodity_version UNIQUE (commodity_id, version)
);

CREATE TABLE dbo.template_defects (   -- qué defectos entran en cada plantilla
  id              INT IDENTITY(1,1) CONSTRAINT PK_template_defects PRIMARY KEY,
  template_id     INT NOT NULL CONSTRAINT FK_template_defects_template REFERENCES dbo.metric_templates(id) ON DELETE CASCADE,
  defect_id       INT NOT NULL CONSTRAINT FK_template_defects_defect REFERENCES dbo.defects(id),
  required        BIT NOT NULL CONSTRAINT DF_template_defects_req DEFAULT 0,
  order_index     INT NOT NULL CONSTRAINT DF_template_defects_order DEFAULT 0,
  CONSTRAINT UQ_template_defects UNIQUE (template_id, defect_id)
);
```

### 1C — Estándares y tolerancias (`0003_standards_tolerances.sql`)
```sql
CREATE TABLE dbo.quality_standards (  -- DB-7: estándar por destino/commodity
  id              INT IDENTITY(1,1) CONSTRAINT PK_quality_standards PRIMARY KEY,
  name            NVARCHAR(120) NOT NULL,            -- 'FTF Destino', 'Qima US'
  commodity_id    INT NOT NULL CONSTRAINT FK_standards_commodity REFERENCES dbo.commodities(id),
  destination_id  INT NULL CONSTRAINT FK_standards_destination REFERENCES dbo.destinations(id),
  active          BIT NOT NULL CONSTRAINT DF_standards_active DEFAULT 1,
  CONSTRAINT UQ_standards UNIQUE (commodity_id, name)
);

CREATE TABLE dbo.defect_tolerances (  -- 5 bandas %→categoría por estándar
  id              INT IDENTITY(1,1) CONSTRAINT PK_defect_tolerances PRIMARY KEY,
  standard_id     INT NOT NULL CONSTRAINT FK_tolerances_standard REFERENCES dbo.quality_standards(id) ON DELETE CASCADE,
  defect_id       INT NOT NULL CONSTRAINT FK_tolerances_defect REFERENCES dbo.defects(id),
  band            TINYINT NOT NULL CONSTRAINT CK_tolerances_band CHECK (band BETWEEN 1 AND 5), -- 1=Excellent..5=Bad
  band_label      VARCHAR(20) NOT NULL,
  min_pct         DECIMAL(6,2) NOT NULL,
  max_pct         DECIMAL(6,2) NULL,                -- NULL = sin techo (banda 5)
  CONSTRAINT UQ_tolerances UNIQUE (standard_id, defect_id, band),
  CONSTRAINT CK_tolerances_range CHECK (max_pct IS NULL OR max_pct >= min_pct)
);

CREATE TABLE dbo.size_bands (         -- DB-7/DB-21: calibre (Large/Jumbo/King+)
  id INT IDENTITY(1,1) CONSTRAINT PK_size_bands PRIMARY KEY,
  commodity_id INT NOT NULL CONSTRAINT FK_size_bands_commodity REFERENCES dbo.commodities(id),
  code VARCHAR(20) NOT NULL, min_mm DECIMAL(5,2) NULL, max_mm DECIMAL(5,2) NULL,
  CONSTRAINT UQ_size_bands UNIQUE (commodity_id, code)
);
CREATE TABLE dbo.color_bands (
  id INT IDENTITY(1,1) CONSTRAINT PK_color_bands PRIMARY KEY,
  commodity_id INT NOT NULL CONSTRAINT FK_color_bands_commodity REFERENCES dbo.commodities(id),
  code VARCHAR(30) NOT NULL,
  CONSTRAINT UQ_color_bands UNIQUE (commodity_id, code)
);
CREATE TABLE dbo.firmness_bands (     -- Baxlo/Shore: Soft<60, Sensitiva 61-74, Firme>=75
  id INT IDENTITY(1,1) CONSTRAINT PK_firmness_bands PRIMARY KEY,
  commodity_id INT NOT NULL CONSTRAINT FK_firmness_bands_commodity REFERENCES dbo.commodities(id),
  code VARCHAR(20) NOT NULL, min_shore DECIMAL(5,1) NULL, max_shore DECIMAL(5,1) NULL,
  CONSTRAINT UQ_firmness_bands UNIQUE (commodity_id, code)
);
```

### 1D — Trabajo y jerarquía (`0004_work_hierarchy.sql`)
```sql
CREATE TABLE dbo.lots (               -- DB-22: Lote como entidad
  id            INT IDENTITY(1,1) CONSTRAINT PK_lots PRIMARY KEY,
  commodity_id  INT NOT NULL CONSTRAINT FK_lots_commodity REFERENCES dbo.commodities(id),
  producer_id   INT NULL CONSTRAINT FK_lots_producer REFERENCES dbo.producers(id),
  lot_code      VARCHAR(80) NOT NULL,
  variety       NVARCHAR(120) NULL,
  packaging_type_id INT NULL CONSTRAINT FK_lots_packaging REFERENCES dbo.packaging_types(id),
  packaging_date DATE NULL,
  created_at    DATETIME2(3) NOT NULL CONSTRAINT DF_lots_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_lots UNIQUE (commodity_id, lot_code)
);

CREATE TABLE dbo.assignments (        -- DB-4/DB-5/DB-8/DB-23: reestructurada
  id            INT IDENTITY(1,1) CONSTRAINT PK_assignments PRIMARY KEY,
  user_id       INT NOT NULL CONSTRAINT FK_assignments_user REFERENCES dbo.users(id),
  lot_id        INT NULL CONSTRAINT FK_assignments_lot REFERENCES dbo.lots(id),
  commodity_id  INT NULL CONSTRAINT FK_assignments_commodity REFERENCES dbo.commodities(id),
  customer_id   INT NULL CONSTRAINT FK_assignments_customer REFERENCES dbo.customers(id),
  standard_id   INT NULL CONSTRAINT FK_assignments_standard REFERENCES dbo.quality_standards(id),
  producer      NVARCHAR(150) NULL,   -- se mantiene hasta poblar lots; luego derivar de lot
  lot           VARCHAR(80) NULL,
  variety       NVARCHAR(120) NULL,
  priority      VARCHAR(10) NULL CONSTRAINT CK_assignments_priority CHECK (priority IN ('low','normal','urgent')),
  instructions  NVARCHAR(MAX) NULL,   -- DB-4: nota libre genuina (ya no carga commodity/estado)
  status        VARCHAR(20) NOT NULL CONSTRAINT DF_assignments_status DEFAULT 'pendiente'
                  CONSTRAINT CK_assignments_status CHECK (status IN ('pendiente','completada','cancelada')),
  created_at    DATETIME2(3) NOT NULL CONSTRAINT DF_assignments_created DEFAULT SYSUTCDATETIME(),
  updated_at    DATETIME2(3) NOT NULL CONSTRAINT DF_assignments_updated DEFAULT SYSUTCDATETIME(),
  updated_by_user_id INT NULL,
  deleted_at    DATETIME2(3) NULL
);

CREATE TABLE dbo.pallets (            -- DB-7: nivel pallet
  id            INT IDENTITY(1,1) CONSTRAINT PK_pallets PRIMARY KEY,
  lot_id        INT NOT NULL CONSTRAINT FK_pallets_lot REFERENCES dbo.lots(id) ON DELETE CASCADE,
  pallet_code   VARCHAR(50) NOT NULL,
  destination_pallet_no VARCHAR(50) NULL,
  CONSTRAINT UQ_pallets UNIQUE (lot_id, pallet_code)
);
```

### 1E — Inspección, mediciones y resultados (`0005_inspections.sql`)
```sql
CREATE TABLE dbo.inspections (        -- re-anclada; mediciones tipadas; sin JSON/caliber texto
  id              INT IDENTITY(1,1) CONSTRAINT PK_inspections PRIMARY KEY,
  pallet_id       INT NULL CONSTRAINT FK_inspections_pallet REFERENCES dbo.pallets(id),
  assignment_id   INT NULL CONSTRAINT FK_inspections_assignment REFERENCES dbo.assignments(id), -- DB-5: vínculo real
  commodity_id    INT NOT NULL CONSTRAINT FK_inspections_commodity REFERENCES dbo.commodities(id),
  template_id     INT NULL CONSTRAINT FK_inspections_template REFERENCES dbo.metric_templates(id), -- DB-3
  template_version INT NULL,
  standard_id     INT NULL CONSTRAINT FK_inspections_standard REFERENCES dbo.quality_standards(id),
  created_by_user_id INT NULL CONSTRAINT FK_inspections_created_by REFERENCES dbo.users(id),
  -- mediciones de cabecera tipadas (DB-7: brix + firmeza)
  brix_min DECIMAL(6,2) NULL, brix_max DECIMAL(6,2) NULL, brix_mode DECIMAL(6,2) NULL, brix_avg DECIMAL(6,2) NULL,
  firmness_min DECIMAL(6,2) NULL, firmness_max DECIMAL(6,2) NULL, firmness_mode DECIMAL(6,2) NULL,
  diameter_min DECIMAL(6,2) NULL, diameter_max DECIMAL(6,2) NULL,
  temp_pulp DECIMAL(6,2) NULL, temp_ambient DECIMAL(6,2) NULL, temp_water DECIMAL(6,2) NULL,
  net_weight DECIMAL(8,3) NULL,
  notes NVARCHAR(MAX) NULL,
  created_at DATETIME2(3) NOT NULL CONSTRAINT DF_inspections_created DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_inspections_updated DEFAULT SYSUTCDATETIME(),
  updated_by_user_id INT NULL,
  deleted_at DATETIME2(3) NULL,
  -- DB-25: CHECKs de rango
  CONSTRAINT CK_inspections_brix CHECK (brix_avg IS NULL OR brix_avg BETWEEN 0 AND 100),
  CONSTRAINT CK_inspections_brix_order CHECK (brix_min IS NULL OR brix_max IS NULL OR brix_min <= brix_max),
  CONSTRAINT CK_inspections_diam_order CHECK (diameter_min IS NULL OR diameter_max IS NULL OR diameter_min <= diameter_max),
  CONSTRAINT CK_inspections_netweight CHECK (net_weight IS NULL OR net_weight > 0)
);
-- DB-18: índices de FK
CREATE INDEX IX_inspections_created_by ON dbo.inspections(created_by_user_id);
CREATE INDEX IX_inspections_commodity  ON dbo.inspections(commodity_id);
CREATE INDEX IX_inspections_pallet     ON dbo.inspections(pallet_id);
CREATE INDEX IX_inspections_created_at ON dbo.inspections(created_at DESC);

CREATE TABLE dbo.samples (            -- DB-7: clamshell individual (granularidad min/max/moda)
  id INT IDENTITY(1,1) CONSTRAINT PK_samples PRIMARY KEY,
  inspection_id INT NOT NULL CONSTRAINT FK_samples_inspection REFERENCES dbo.inspections(id) ON DELETE CASCADE,
  sample_no INT NOT NULL,
  net_weight DECIMAL(8,3) NULL,
  CONSTRAINT UQ_samples UNIQUE (inspection_id, sample_no)
);

CREATE TABLE dbo.inspection_measurements (  -- DB-3: reemplaza metrics JSON, tipado
  id            BIGINT IDENTITY(1,1) CONSTRAINT PK_inspection_measurements PRIMARY KEY,
  inspection_id INT NOT NULL CONSTRAINT FK_measurements_inspection REFERENCES dbo.inspections(id) ON DELETE CASCADE,
  sample_id     INT NULL CONSTRAINT FK_measurements_sample REFERENCES dbo.samples(id),
  defect_id     INT NOT NULL CONSTRAINT FK_measurements_defect REFERENCES dbo.defects(id),
  value_num     DECIMAL(9,3) NULL,
  value_option_id INT NULL CONSTRAINT FK_measurements_option REFERENCES dbo.defect_options(id),
  value_bool    BIT NULL,
  value_text    NVARCHAR(200) NULL
);
-- unicidad inspección×muestra×defecto vía índice filtrado (sample_id nullable)
CREATE UNIQUE INDEX UX_measurements_insp_defect ON dbo.inspection_measurements(inspection_id, defect_id) WHERE sample_id IS NULL;
CREATE UNIQUE INDEX UX_measurements_sample_defect ON dbo.inspection_measurements(sample_id, defect_id) WHERE sample_id IS NOT NULL;

CREATE TABLE dbo.inspection_size_distribution (
  id INT IDENTITY(1,1) CONSTRAINT PK_insp_size_dist PRIMARY KEY,
  inspection_id INT NOT NULL CONSTRAINT FK_size_dist_inspection REFERENCES dbo.inspections(id) ON DELETE CASCADE,
  size_band_id INT NOT NULL CONSTRAINT FK_size_dist_band REFERENCES dbo.size_bands(id),
  pct DECIMAL(5,2) NOT NULL CONSTRAINT CK_size_dist_pct CHECK (pct BETWEEN 0 AND 100),
  CONSTRAINT UQ_size_dist UNIQUE (inspection_id, size_band_id)
);
CREATE TABLE dbo.inspection_color_distribution (
  id INT IDENTITY(1,1) CONSTRAINT PK_insp_color_dist PRIMARY KEY,
  inspection_id INT NOT NULL CONSTRAINT FK_color_dist_inspection REFERENCES dbo.inspections(id) ON DELETE CASCADE,
  color_band_id INT NOT NULL CONSTRAINT FK_color_dist_band REFERENCES dbo.color_bands(id),
  pct DECIMAL(5,2) NOT NULL CONSTRAINT CK_color_dist_pct CHECK (pct BETWEEN 0 AND 100),
  CONSTRAINT UQ_color_dist UNIQUE (inspection_id, color_band_id)
);

CREATE TABLE dbo.inspection_results (       -- DB-7: totales/score/resolución/causal
  inspection_id     INT NOT NULL CONSTRAINT PK_inspection_results PRIMARY KEY
                      CONSTRAINT FK_results_inspection REFERENCES dbo.inspections(id) ON DELETE CASCADE,
  quality_total_pct DECIMAL(6,2) NULL,
  condition_total_pct DECIMAL(6,2) NULL,
  total_defects_pct DECIMAL(6,2) NULL,
  score             DECIMAL(6,2) NULL,
  resolution        VARCHAR(15) NULL CONSTRAINT CK_results_resolution CHECK (resolution IN ('approved','conditional','rejected')),
  worst_band        TINYINT NULL CONSTRAINT CK_results_band CHECK (worst_band BETWEEN 1 AND 5),
  causal_defect_id  INT NULL CONSTRAINT FK_results_causal REFERENCES dbo.defects(id),
  computed_at       DATETIME2(3) NOT NULL CONSTRAINT DF_results_computed DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.inspection_photos (        -- DB-12/DB-32: absorbe header_photos; defect_id en vez de metric_key texto
  id INT IDENTITY(1,1) CONSTRAINT PK_inspection_photos PRIMARY KEY,
  inspection_id INT NOT NULL CONSTRAINT FK_photos_inspection REFERENCES dbo.inspections(id) ON DELETE CASCADE,
  defect_id INT NULL CONSTRAINT FK_photos_defect REFERENCES dbo.defects(id),
  photo_kind VARCHAR(15) NOT NULL CONSTRAINT DF_photos_kind DEFAULT 'defect'
              CONSTRAINT CK_photos_kind CHECK (photo_kind IN ('defect','header')),
  header_tag VARCHAR(30) NULL,               -- 'brix','temperatura' cuando kind='header'
  url NVARCHAR(MAX) NOT NULL,
  created_at DATETIME2(3) NOT NULL CONSTRAINT DF_photos_created DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_photos_inspection ON dbo.inspection_photos(inspection_id);

CREATE TABLE dbo.inspection_pdf_versions (  -- DB-16/DB-34: PDF versionado append-only
  id INT IDENTITY(1,1) CONSTRAINT PK_inspection_pdf_versions PRIMARY KEY,
  inspection_id INT NOT NULL CONSTRAINT FK_pdf_inspection REFERENCES dbo.inspections(id) ON DELETE CASCADE,
  version INT NOT NULL,
  status VARCHAR(20) NOT NULL CONSTRAINT CK_pdf_status CHECK (status IN ('PENDING','OK','ERROR')),
  pdf_url NVARCHAR(MAX) NULL,
  pdf_hash VARCHAR(128) NULL,
  error_message NVARCHAR(MAX) NULL,
  generated_by_user_id INT NULL CONSTRAINT FK_pdf_generated_by REFERENCES dbo.users(id),
  generated_at DATETIME2(3) NOT NULL CONSTRAINT DF_pdf_generated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_pdf_versions UNIQUE (inspection_id, version)
);
```

### 1F — Trazabilidad (`0006_audit.sql`) (DB-1/DB-14)
```sql
CREATE TABLE dbo.audit_log (
  id            BIGINT IDENTITY(1,1) CONSTRAINT PK_audit_log PRIMARY KEY,
  occurred_at   DATETIME2(3) NOT NULL CONSTRAINT DF_audit_at DEFAULT SYSUTCDATETIME(),
  actor_user_id INT NULL,
  actor_label   NVARCHAR(150) NULL,
  action        VARCHAR(20) NOT NULL,   -- INSERT|UPDATE|DELETE|CANCEL|PDF_GEN|LOGIN
  table_name    SYSNAME NOT NULL,
  record_pk     VARCHAR(100) NOT NULL,
  old_values    NVARCHAR(MAX) NULL,
  new_values    NVARCHAR(MAX) NULL,
  request_id    VARCHAR(64) NULL,
  CONSTRAINT CK_audit_old_json CHECK (old_values IS NULL OR ISJSON(old_values)=1),
  CONSTRAINT CK_audit_new_json CHECK (new_values IS NULL OR ISJSON(new_values)=1)
);
CREATE INDEX IX_audit_table_pk ON dbo.audit_log(table_name, record_pk, occurred_at);
CREATE INDEX IX_audit_actor ON dbo.audit_log(actor_user_id, occurred_at);
```
**Temporal tables (System-Versioning)** sobre `inspections`, `inspection_measurements`, `assignments`, `users` (DB-2): se habilitan en `0009` (después de migrar datos, para no versionar el backfill). Patrón:
```sql
ALTER TABLE dbo.inspections ADD
  ValidFrom DATETIME2(3) GENERATED ALWAYS AS ROW START HIDDEN CONSTRAINT DF_insp_vf DEFAULT SYSUTCDATETIME(),
  ValidTo   DATETIME2(3) GENERATED ALWAYS AS ROW END   HIDDEN CONSTRAINT DF_insp_vt DEFAULT CONVERT(DATETIME2(3),'9999-12-31 23:59:59.999'),
  PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo);
ALTER TABLE dbo.inspections SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.inspections_History));
```

### 1G — Vista admin actualizada (`0007_views.sql`) (DB-29)
```sql
CREATE VIEW dbo.vw_inspections_admin AS
SELECT i.id, i.created_at, i.updated_at, i.commodity_id, c.code AS commodity_code, c.name AS commodity_name,
       p.pallet_code, l.lot_code, l.variety, pr.name AS producer,
       i.brix_avg, i.brix_min, i.brix_max, i.brix_mode,
       i.firmness_min, i.firmness_max, i.firmness_mode,
       i.diameter_min, i.diameter_max, i.temp_pulp, i.temp_ambient, i.temp_water, i.net_weight, i.notes,
       i.created_by_user_id, u.name AS created_by_name,
       r.quality_total_pct, r.condition_total_pct, r.total_defects_pct, r.score, r.resolution,
       (SELECT TOP 1 pv.status FROM dbo.inspection_pdf_versions pv WHERE pv.inspection_id=i.id ORDER BY pv.version DESC) AS pdf_status,
       (SELECT TOP 1 pv.pdf_url FROM dbo.inspection_pdf_versions pv WHERE pv.inspection_id=i.id ORDER BY pv.version DESC) AS pdf_url
FROM dbo.inspections i
JOIN dbo.commodities c ON c.id=i.commodity_id
LEFT JOIN dbo.pallets p ON p.id=i.pallet_id
LEFT JOIN dbo.lots l ON l.id=p.lot_id
LEFT JOIN dbo.producers pr ON pr.id=l.producer_id
LEFT JOIN dbo.users u ON u.id=i.created_by_user_id
LEFT JOIN dbo.inspection_results r ON r.inspection_id=i.id
WHERE i.deleted_at IS NULL;
```

---

## FASE 2 — Seeds de catálogos y dominio (`0008_seed.sql`)
- [ ] **commodities** consolidados (DB-9): un registro por fruta (BLUEBERRY, STRAWBERRY, RASPBERRY, BLACKBERRY, REDCURRANT, CHERRY) con `name` en un solo idioma; `commodity_aliases`: `('HS','0810')→BLUEBERRY`, `('es_name','Arándano')→BLUEBERRY`.
- [ ] **destinations**: `FTF`, `US`. **customers**: `Walmart USA`, `Family Tree Farms`.
- [ ] **packaging_types** con `sample_count` del manual (6Oz=7, 9.8OZ=6, PINT=6, 16OZ=3, 18OZ=3).
- [ ] **defects** (diccionario canónico por commodity, familia, sin typos): para BLUEBERRY tomar las claves del estándar Qima/FTF (quality: dust, contamination, russet_scars, attached_stems, flower_remains, undersize, immature_red, no_bloom, bloom, lack_of_color, size, consistency; condition: decay, decay_incidence, mold, mold_incidence, mold_type[select], soft, sensitive, shriveling, broken_skin, wounds, crushed, wet_berries, so2_damage, sunken_areas, freezing_damage). Corrige `inmature→immature` y fusiona russet/scars.
- [ ] **quality_standards** `('FTF Destino', BLUEBERRY, FTF)` + **defect_tolerances** con las 5 bandas del cuadro FTF (extraídas de `Destino FTF QC INSP.pdf` / `Product_Standard_Blueberries_Qima.pdf`). Ej. para `dust`: band1 0–0, band3 0.01–10, band4 10.01–30, band5 30.01–100 (Qima). Generar todas las filas desde el documento.
- [ ] **size_bands** BLUEBERRY: Large 12–18.9, Jumbo ≥19, King+ ≥22. **firmness_bands**: Soft <60, Sensitiva 61–74, Firme ≥75. **color_bands**: Rojo/Verde/Azul/Rango1-3.
- [ ] **metric_templates** + **template_defects** para BLUEBERRY v1 (mapear los defects del diccionario). Otros commodities: portar sus campos actuales como defects+template (sin tolerancias hasta tener sus estándares).

> Las tolerancias completas se generarán en un script a partir de las tablas de los PDF (ya leídas en la auditoría de docs). Blueberry primero (único en uso); resto en backlog.

---

## FASE 3 — Migración de datos (backfill + limpieza) (`db/backfill/*.mjs` o `0010_*.sql`)

### Task 3.0 — Cutover: renombrar legacy
- [ ] En ventana de mantenimiento: `EXEC sp_rename 'dbo.inspections','legacy_inspections'` (y las 8 tablas + vista). Recrear el esquema nuevo (Fase 1) en `dbo`.

### Task 3.1 — Catálogos base
- [ ] `users`, `commodities` (dedup id6/id7 → un REDCURRANT; mapear viejo id→nuevo id en tabla temporal `map_commodity`), `producers` (DISTINCT de `legacy_assignments.producer` + `legacy_inspections.producer`), `customers`/`destinations` (parseando "Walmart USA" de notes_admin).

### Task 3.2 — Defectos y plantillas
- [ ] Insertar `defects` desde el seed canónico. Construir `map_metric_key` (legacy `metric_fields.key` con prefijo → `defect_id`), resolviendo typos (`quality.inmature`→immature) y fusiones (russet/scars→russet_scars).
- [ ] `metric_templates`/`template_defects` desde `legacy_metric_templates`/`legacy_metric_fields`.

### Task 3.3 — Lotes, asignaciones, pallets
- [ ] `lots` desde DISTINCT (commodity, lot, producer, variety) de legacy.
- [ ] `assignments`: parsear `legacy_assignments.notes_admin` → extraer commodity (`0810/Arándano/BLUEBERRY`→commodity_id vía aliases), customer (`Cliente: X`), priority (`Urgente`→urgent), inspection link (`Inspección ID: N`). **Corregir id2** (status real = `cancelada`, no completada — DB-6). `instructions` = resto del texto limpio.
- [ ] `pallets`: si no hay dato de pallet en legacy, crear 1 pallet placeholder por lot (la jerarquía queda lista para datos nuevos).

### Task 3.4 — Inspecciones y mediciones (el grande)
- [ ] `inspections`: copiar cabecera tipada; `caliber` "14 cm"/"6" → descartar a favor de `diameter_min/max` (loguear los no convertibles); anclar `template_id`/`template_version` (BLUEBERRY v1) — DB-3.
- [ ] `inspection_measurements`: `OPENJSON(legacy_inspections.metrics,'$.values')` → una fila por par; `key`→`defect_id` (map_metric_key); `TRY_CAST(value AS decimal)`→`value_num`; `''`→omitir (NULL real, DB-3); `mold_type` "None"/valor→`value_option_id`.
- [ ] `inspection_photos`: `legacy_inspection_photos` (metric_key→defect_id, kind='defect') + `legacy_inspections.header_photos` JSON (kind='header', header_tag=clave) — DB-12.
- [ ] `inspection_pdf_versions`: 1 fila version=1 por cada `legacy_inspection_pdfs`.
- [ ] `inspection_results`: calcular totales/score/resolución/causal desde `inspection_measurements` + `defect_tolerances` (o dejar NULL y poblar con el motor de cálculo cuando exista).

### Task 3.5 — Validación de migración
- [ ] Conteos: nº measurements = Σ pares no-vacíos del JSON; nº photos = 24+header; 0 huérfanos (queries de verificación). Reporte a `progress.md`.

---

## FASE 4 — Trazabilidad activa (`0009_versioning.sql`)
- [ ] Habilitar System-Versioning en `inspections`, `inspection_measurements`, `assignments`, `users` (DB-2).
- [ ] Patrón `sp_set_session_context @key='app_user_id'` documentado para la app (DB-14); `audit_log` poblado desde la capa de aplicación dentro de la transacción (acciones de negocio: CANCEL, PDF_GEN).
- [ ] (Opcional) triggers `AFTER INSERT/UPDATE/DELETE` que escriben `audit_log` leyendo `SESSION_CONTEXT('app_user_id')`.

---

## FASE 5 — Adaptación del backend (impacto, se planifica aparte)
El rediseño rompe TODAS las queries actuales. Rutas/archivos a reescribir contra el nuevo esquema:
- `src/lib/db/mssql.js` (+ session context), `inspecciones/route.js` y `[id]/*` (metrics→measurements), `metric-templates/*` (fields→defects/template_defects), `assignments/*` (commodity_id/customer), `google-sheets/*` (commodity_code→commodity_id), `commodities/*`, el generador de PDF (lee measurements + results), `vw_inspections_admin` consumers.
- **Recomendación:** crear una capa de repositorios (`src/lib/repos/*`) que aísle el SQL del esquema, para que futuros cambios no se esparzan por 30 rutas (mitiga el shotgun-surgery ya detectado en la revisión de código).

> Esta fase es grande; se detallará en su propio plan tras aprobar el esquema. El usuario pidió "solo back y BD": el back se adapta después de la BD.

---

## FASE 6 — Cutover final y limpieza
- [ ] Smoke test de la app contra el esquema nuevo (login, crear inspección, generar PDF, panel admin).
- [ ] Verificar `vw_inspections_admin`, audit_log poblándose, temporal history capturando cambios.
- [ ] `DROP TABLE legacy_*` (tras período de gracia + backup confirmado).
- [ ] Versionar el esquema final en `db/schema.sql` + dejar `db/migrations/` como fuente de verdad.

---

## Mapa de cobertura (hallazgo → fase)
| Hallazgos | Resuelto en |
|---|---|
| DB-1,2,14,15,16 (trazabilidad) | Fase 1F + 4 (audit_log, temporal, soft-delete, pdf_versions) |
| DB-3,4,5,11,12,22 (normalización) | Fase 1B/1D/1E (measurements, assignments, defects, lots/pallets) |
| DB-7 (dominio QC) | Fase 1C/1E + 2 (tolerances, results, distribuciones, seeds) |
| DB-6,9,10,13,21 (calidad datos) | Fase 3 (backfill + limpieza) |
| DB-8,17,18,23,24,25 (integridad/índices) | Fase 1 (FKs, índices, CHECKs) |
| DB-19,20,27,28,29,31,32,33,34,35 (esquema/seguridad) | Fase 1 (ISJSON, nombres, nvarchar, vista, RLS opcional) |
| DB-36 (config) | Fase 0 |

## Self-review
- Cada hallazgo P0/P1 tiene fase asignada (ver mapa). 
- Riesgo principal: Fase 5 (backend) — el esquema nuevo rompe la app; ejecutar BD + backend de forma coordinada en la ventana, o mantener `legacy_*` + vistas de compatibilidad temporales si se quiere desacoplar.
- Dependencia: las tolerancias completas dependen de transcribir los cuadros de los PDF (hecho en la auditoría de docs); blueberry primero.
- Reversibilidad: backup BACPAC + `legacy_*` intactas hasta Fase 6.
