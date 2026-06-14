-- 0001_qc_schema.sql
-- Esquema destino del refactor (greenfield) en el schema `qc`. No toca `dbo` (la app sigue viva).
-- Resuelve hallazgos DB-1..DB-35 (ver db-audit-findings.md).

IF SCHEMA_ID('qc') IS NULL EXEC('CREATE SCHEMA qc');
GO

-- ===== Identidad y catálogos =====
CREATE TABLE qc.users (
  id                 INT IDENTITY(1,1) CONSTRAINT PK_qc_users PRIMARY KEY,
  name               NVARCHAR(100) NULL,
  email              VARCHAR(150) NOT NULL CONSTRAINT UQ_qc_users_email UNIQUE,
  password_hash      VARCHAR(255) NOT NULL,
  role               VARCHAR(20) NOT NULL CONSTRAINT CK_qc_users_role CHECK (role IN ('admin','inspector')),
  active             BIT NOT NULL CONSTRAINT DF_qc_users_active DEFAULT 1,
  created_at         DATETIME2(3) NOT NULL CONSTRAINT DF_qc_users_created DEFAULT SYSUTCDATETIME(),
  updated_at         DATETIME2(3) NOT NULL CONSTRAINT DF_qc_users_updated DEFAULT SYSUTCDATETIME(),
  updated_by_user_id INT NULL,
  deleted_at         DATETIME2(3) NULL,
  deleted_by_user_id INT NULL
);

CREATE TABLE qc.commodities (
  id         INT IDENTITY(1,1) CONSTRAINT PK_qc_commodities PRIMARY KEY,
  code       VARCHAR(50) NOT NULL CONSTRAINT UQ_qc_commodities_code UNIQUE,
  name       NVARCHAR(100) NOT NULL CONSTRAINT UQ_qc_commodities_name UNIQUE,
  active     BIT NOT NULL CONSTRAINT DF_qc_commodities_active DEFAULT 1,
  created_at DATETIME2(3) NOT NULL CONSTRAINT DF_qc_commodities_created DEFAULT SYSUTCDATETIME()
);

CREATE TABLE qc.commodity_aliases (
  id           INT IDENTITY(1,1) CONSTRAINT PK_qc_commodity_aliases PRIMARY KEY,
  commodity_id INT NOT NULL CONSTRAINT FK_qc_commodity_aliases_commodity REFERENCES qc.commodities(id),
  alias_code   VARCHAR(50) NOT NULL,
  scheme       VARCHAR(30) NOT NULL,
  CONSTRAINT UQ_qc_commodity_aliases UNIQUE (scheme, alias_code)
);

CREATE TABLE qc.producers (
  id     INT IDENTITY(1,1) CONSTRAINT PK_qc_producers PRIMARY KEY,
  name   NVARCHAR(150) NOT NULL CONSTRAINT UQ_qc_producers_name UNIQUE,
  active BIT NOT NULL CONSTRAINT DF_qc_producers_active DEFAULT 1
);

CREATE TABLE qc.customers (
  id     INT IDENTITY(1,1) CONSTRAINT PK_qc_customers PRIMARY KEY,
  name   NVARCHAR(150) NOT NULL CONSTRAINT UQ_qc_customers_name UNIQUE,
  active BIT NOT NULL CONSTRAINT DF_qc_customers_active DEFAULT 1
);

CREATE TABLE qc.destinations (
  id   INT IDENTITY(1,1) CONSTRAINT PK_qc_destinations PRIMARY KEY,
  code VARCHAR(30) NOT NULL CONSTRAINT UQ_qc_destinations_code UNIQUE,
  name NVARCHAR(100) NOT NULL
);

CREATE TABLE qc.packaging_types (
  id           INT IDENTITY(1,1) CONSTRAINT PK_qc_packaging_types PRIMARY KEY,
  code         VARCHAR(50) NOT NULL CONSTRAINT UQ_qc_packaging_types_code UNIQUE,
  label        NVARCHAR(100) NOT NULL,
  net_weight_g DECIMAL(8,2) NULL,
  sample_count INT NULL,
  active       BIT NOT NULL CONSTRAINT DF_qc_packaging_active DEFAULT 1
);

-- ===== Defectos y plantillas =====
CREATE TABLE qc.defects (
  id           INT IDENTITY(1,1) CONSTRAINT PK_qc_defects PRIMARY KEY,
  commodity_id INT NOT NULL CONSTRAINT FK_qc_defects_commodity REFERENCES qc.commodities(id),
  code         VARCHAR(60) NOT NULL,
  label        NVARCHAR(120) NOT NULL,
  family       VARCHAR(15) NOT NULL CONSTRAINT CK_qc_defects_family CHECK (family IN ('quality','condition','packaging','measurement')),
  value_type   VARCHAR(15) NOT NULL CONSTRAINT CK_qc_defects_valtype CHECK (value_type IN ('number','select','boolean','text')),
  unit         VARCHAR(20) NULL,
  is_major     BIT NOT NULL CONSTRAINT DF_qc_defects_major DEFAULT 0,
  active       BIT NOT NULL CONSTRAINT DF_qc_defects_active DEFAULT 1,
  CONSTRAINT UQ_qc_defects UNIQUE (commodity_id, family, code)
);

CREATE TABLE qc.defect_options (
  id          INT IDENTITY(1,1) CONSTRAINT PK_qc_defect_options PRIMARY KEY,
  defect_id   INT NOT NULL CONSTRAINT FK_qc_defect_options_defect REFERENCES qc.defects(id) ON DELETE CASCADE,
  value       VARCHAR(50) NOT NULL,
  label       NVARCHAR(120) NOT NULL,
  order_index INT NOT NULL CONSTRAINT DF_qc_defect_options_order DEFAULT 0,
  CONSTRAINT UQ_qc_defect_options UNIQUE (defect_id, value)
);

CREATE TABLE qc.metric_templates (
  id           INT IDENTITY(1,1) CONSTRAINT PK_qc_metric_templates PRIMARY KEY,
  commodity_id INT NOT NULL CONSTRAINT FK_qc_templates_commodity REFERENCES qc.commodities(id),
  version      INT NOT NULL CONSTRAINT DF_qc_templates_version DEFAULT 1,
  name         NVARCHAR(120) NOT NULL,
  active       BIT NOT NULL CONSTRAINT DF_qc_templates_active DEFAULT 1,
  created_at   DATETIME2(3) NOT NULL CONSTRAINT DF_qc_templates_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_qc_templates_commodity_version UNIQUE (commodity_id, version)
);

CREATE TABLE qc.template_defects (
  id          INT IDENTITY(1,1) CONSTRAINT PK_qc_template_defects PRIMARY KEY,
  template_id INT NOT NULL CONSTRAINT FK_qc_template_defects_template REFERENCES qc.metric_templates(id) ON DELETE CASCADE,
  defect_id   INT NOT NULL CONSTRAINT FK_qc_template_defects_defect REFERENCES qc.defects(id),
  required    BIT NOT NULL CONSTRAINT DF_qc_template_defects_req DEFAULT 0,
  order_index INT NOT NULL CONSTRAINT DF_qc_template_defects_order DEFAULT 0,
  CONSTRAINT UQ_qc_template_defects UNIQUE (template_id, defect_id)
);

-- ===== Estándares y tolerancias =====
CREATE TABLE qc.quality_standards (
  id             INT IDENTITY(1,1) CONSTRAINT PK_qc_quality_standards PRIMARY KEY,
  name           NVARCHAR(120) NOT NULL,
  commodity_id   INT NOT NULL CONSTRAINT FK_qc_standards_commodity REFERENCES qc.commodities(id),
  destination_id INT NULL CONSTRAINT FK_qc_standards_destination REFERENCES qc.destinations(id),
  active         BIT NOT NULL CONSTRAINT DF_qc_standards_active DEFAULT 1,
  CONSTRAINT UQ_qc_standards UNIQUE (commodity_id, name)
);

CREATE TABLE qc.defect_tolerances (
  id          INT IDENTITY(1,1) CONSTRAINT PK_qc_defect_tolerances PRIMARY KEY,
  standard_id INT NOT NULL CONSTRAINT FK_qc_tolerances_standard REFERENCES qc.quality_standards(id) ON DELETE CASCADE,
  defect_id   INT NOT NULL CONSTRAINT FK_qc_tolerances_defect REFERENCES qc.defects(id),
  band        TINYINT NOT NULL CONSTRAINT CK_qc_tolerances_band CHECK (band BETWEEN 1 AND 5),
  band_label  VARCHAR(20) NOT NULL,
  min_pct     DECIMAL(6,2) NOT NULL,
  max_pct     DECIMAL(6,2) NULL,
  CONSTRAINT UQ_qc_tolerances UNIQUE (standard_id, defect_id, band),
  CONSTRAINT CK_qc_tolerances_range CHECK (max_pct IS NULL OR max_pct >= min_pct)
);

CREATE TABLE qc.size_bands (
  id INT IDENTITY(1,1) CONSTRAINT PK_qc_size_bands PRIMARY KEY,
  commodity_id INT NOT NULL CONSTRAINT FK_qc_size_bands_commodity REFERENCES qc.commodities(id),
  code VARCHAR(20) NOT NULL, min_mm DECIMAL(5,2) NULL, max_mm DECIMAL(5,2) NULL,
  CONSTRAINT UQ_qc_size_bands UNIQUE (commodity_id, code)
);

CREATE TABLE qc.color_bands (
  id INT IDENTITY(1,1) CONSTRAINT PK_qc_color_bands PRIMARY KEY,
  commodity_id INT NOT NULL CONSTRAINT FK_qc_color_bands_commodity REFERENCES qc.commodities(id),
  code VARCHAR(30) NOT NULL,
  CONSTRAINT UQ_qc_color_bands UNIQUE (commodity_id, code)
);

CREATE TABLE qc.firmness_bands (
  id INT IDENTITY(1,1) CONSTRAINT PK_qc_firmness_bands PRIMARY KEY,
  commodity_id INT NOT NULL CONSTRAINT FK_qc_firmness_bands_commodity REFERENCES qc.commodities(id),
  code VARCHAR(20) NOT NULL, min_shore DECIMAL(5,1) NULL, max_shore DECIMAL(5,1) NULL,
  CONSTRAINT UQ_qc_firmness_bands UNIQUE (commodity_id, code)
);

-- ===== Trabajo y jerarquía =====
CREATE TABLE qc.lots (
  id                INT IDENTITY(1,1) CONSTRAINT PK_qc_lots PRIMARY KEY,
  commodity_id      INT NOT NULL CONSTRAINT FK_qc_lots_commodity REFERENCES qc.commodities(id),
  producer_id       INT NULL CONSTRAINT FK_qc_lots_producer REFERENCES qc.producers(id),
  lot_code          VARCHAR(80) NOT NULL,
  variety           NVARCHAR(120) NULL,
  packaging_type_id INT NULL CONSTRAINT FK_qc_lots_packaging REFERENCES qc.packaging_types(id),
  packaging_date    DATE NULL,
  created_at        DATETIME2(3) NOT NULL CONSTRAINT DF_qc_lots_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_qc_lots UNIQUE (commodity_id, lot_code)
);

CREATE TABLE qc.assignments (
  id                 INT IDENTITY(1,1) CONSTRAINT PK_qc_assignments PRIMARY KEY,
  user_id            INT NOT NULL CONSTRAINT FK_qc_assignments_user REFERENCES qc.users(id),
  lot_id             INT NULL CONSTRAINT FK_qc_assignments_lot REFERENCES qc.lots(id),
  commodity_id       INT NULL CONSTRAINT FK_qc_assignments_commodity REFERENCES qc.commodities(id),
  customer_id        INT NULL CONSTRAINT FK_qc_assignments_customer REFERENCES qc.customers(id),
  standard_id        INT NULL CONSTRAINT FK_qc_assignments_standard REFERENCES qc.quality_standards(id),
  producer           NVARCHAR(150) NULL,
  lot                VARCHAR(80) NULL,
  variety            NVARCHAR(120) NULL,
  priority           VARCHAR(10) NULL CONSTRAINT CK_qc_assignments_priority CHECK (priority IN ('low','normal','urgent')),
  instructions       NVARCHAR(MAX) NULL,
  status             VARCHAR(20) NOT NULL CONSTRAINT DF_qc_assignments_status DEFAULT 'pendiente'
                       CONSTRAINT CK_qc_assignments_status CHECK (status IN ('pendiente','completada','cancelada')),
  created_at         DATETIME2(3) NOT NULL CONSTRAINT DF_qc_assignments_created DEFAULT SYSUTCDATETIME(),
  updated_at         DATETIME2(3) NOT NULL CONSTRAINT DF_qc_assignments_updated DEFAULT SYSUTCDATETIME(),
  updated_by_user_id INT NULL,
  deleted_at         DATETIME2(3) NULL
);

CREATE TABLE qc.pallets (
  id                    INT IDENTITY(1,1) CONSTRAINT PK_qc_pallets PRIMARY KEY,
  lot_id                INT NOT NULL CONSTRAINT FK_qc_pallets_lot REFERENCES qc.lots(id) ON DELETE CASCADE,
  pallet_code           VARCHAR(50) NOT NULL,
  destination_pallet_no VARCHAR(50) NULL,
  CONSTRAINT UQ_qc_pallets UNIQUE (lot_id, pallet_code)
);

-- ===== Inspección, mediciones, resultados =====
CREATE TABLE qc.inspections (
  id                 INT IDENTITY(1,1) CONSTRAINT PK_qc_inspections PRIMARY KEY,
  pallet_id          INT NULL CONSTRAINT FK_qc_inspections_pallet REFERENCES qc.pallets(id),
  assignment_id      INT NULL CONSTRAINT FK_qc_inspections_assignment REFERENCES qc.assignments(id),
  commodity_id       INT NOT NULL CONSTRAINT FK_qc_inspections_commodity REFERENCES qc.commodities(id),
  template_id        INT NULL CONSTRAINT FK_qc_inspections_template REFERENCES qc.metric_templates(id),
  template_version   INT NULL,
  standard_id        INT NULL CONSTRAINT FK_qc_inspections_standard REFERENCES qc.quality_standards(id),
  created_by_user_id INT NULL CONSTRAINT FK_qc_inspections_created_by REFERENCES qc.users(id),
  brix_min DECIMAL(6,2) NULL, brix_max DECIMAL(6,2) NULL, brix_mode DECIMAL(6,2) NULL, brix_avg DECIMAL(6,2) NULL,
  firmness_min DECIMAL(6,2) NULL, firmness_max DECIMAL(6,2) NULL, firmness_mode DECIMAL(6,2) NULL,
  diameter_min DECIMAL(6,2) NULL, diameter_max DECIMAL(6,2) NULL,
  temp_pulp DECIMAL(6,2) NULL, temp_ambient DECIMAL(6,2) NULL, temp_water DECIMAL(6,2) NULL,
  net_weight DECIMAL(8,3) NULL,
  notes NVARCHAR(MAX) NULL,
  created_at DATETIME2(3) NOT NULL CONSTRAINT DF_qc_inspections_created DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_qc_inspections_updated DEFAULT SYSUTCDATETIME(),
  updated_by_user_id INT NULL,
  deleted_at DATETIME2(3) NULL,
  CONSTRAINT CK_qc_inspections_brix CHECK (brix_avg IS NULL OR brix_avg BETWEEN 0 AND 100),
  CONSTRAINT CK_qc_inspections_brix_order CHECK (brix_min IS NULL OR brix_max IS NULL OR brix_min <= brix_max),
  CONSTRAINT CK_qc_inspections_diam_order CHECK (diameter_min IS NULL OR diameter_max IS NULL OR diameter_min <= diameter_max),
  CONSTRAINT CK_qc_inspections_netweight CHECK (net_weight IS NULL OR net_weight > 0)
);

CREATE TABLE qc.samples (
  id INT IDENTITY(1,1) CONSTRAINT PK_qc_samples PRIMARY KEY,
  inspection_id INT NOT NULL CONSTRAINT FK_qc_samples_inspection REFERENCES qc.inspections(id) ON DELETE CASCADE,
  sample_no INT NOT NULL,
  net_weight DECIMAL(8,3) NULL,
  CONSTRAINT UQ_qc_samples UNIQUE (inspection_id, sample_no)
);

CREATE TABLE qc.inspection_measurements (
  id              BIGINT IDENTITY(1,1) CONSTRAINT PK_qc_inspection_measurements PRIMARY KEY,
  inspection_id   INT NOT NULL CONSTRAINT FK_qc_measurements_inspection REFERENCES qc.inspections(id) ON DELETE CASCADE,
  sample_id       INT NULL CONSTRAINT FK_qc_measurements_sample REFERENCES qc.samples(id),
  defect_id       INT NOT NULL CONSTRAINT FK_qc_measurements_defect REFERENCES qc.defects(id),
  value_num       DECIMAL(9,3) NULL,
  value_option_id INT NULL CONSTRAINT FK_qc_measurements_option REFERENCES qc.defect_options(id),
  value_bool      BIT NULL,
  value_text      NVARCHAR(200) NULL
);

CREATE TABLE qc.inspection_size_distribution (
  id INT IDENTITY(1,1) CONSTRAINT PK_qc_insp_size_dist PRIMARY KEY,
  inspection_id INT NOT NULL CONSTRAINT FK_qc_size_dist_inspection REFERENCES qc.inspections(id) ON DELETE CASCADE,
  size_band_id INT NOT NULL CONSTRAINT FK_qc_size_dist_band REFERENCES qc.size_bands(id),
  pct DECIMAL(5,2) NOT NULL CONSTRAINT CK_qc_size_dist_pct CHECK (pct BETWEEN 0 AND 100),
  CONSTRAINT UQ_qc_size_dist UNIQUE (inspection_id, size_band_id)
);

CREATE TABLE qc.inspection_color_distribution (
  id INT IDENTITY(1,1) CONSTRAINT PK_qc_insp_color_dist PRIMARY KEY,
  inspection_id INT NOT NULL CONSTRAINT FK_qc_color_dist_inspection REFERENCES qc.inspections(id) ON DELETE CASCADE,
  color_band_id INT NOT NULL CONSTRAINT FK_qc_color_dist_band REFERENCES qc.color_bands(id),
  pct DECIMAL(5,2) NOT NULL CONSTRAINT CK_qc_color_dist_pct CHECK (pct BETWEEN 0 AND 100),
  CONSTRAINT UQ_qc_color_dist UNIQUE (inspection_id, color_band_id)
);

CREATE TABLE qc.inspection_results (
  inspection_id       INT NOT NULL CONSTRAINT PK_qc_inspection_results PRIMARY KEY
                        CONSTRAINT FK_qc_results_inspection REFERENCES qc.inspections(id) ON DELETE CASCADE,
  quality_total_pct   DECIMAL(6,2) NULL,
  condition_total_pct DECIMAL(6,2) NULL,
  total_defects_pct   DECIMAL(6,2) NULL,
  score               DECIMAL(6,2) NULL,
  resolution          VARCHAR(15) NULL CONSTRAINT CK_qc_results_resolution CHECK (resolution IN ('approved','conditional','rejected')),
  worst_band          TINYINT NULL CONSTRAINT CK_qc_results_band CHECK (worst_band BETWEEN 1 AND 5),
  causal_defect_id    INT NULL CONSTRAINT FK_qc_results_causal REFERENCES qc.defects(id),
  computed_at         DATETIME2(3) NOT NULL CONSTRAINT DF_qc_results_computed DEFAULT SYSUTCDATETIME()
);

CREATE TABLE qc.inspection_photos (
  id INT IDENTITY(1,1) CONSTRAINT PK_qc_inspection_photos PRIMARY KEY,
  inspection_id INT NOT NULL CONSTRAINT FK_qc_photos_inspection REFERENCES qc.inspections(id) ON DELETE CASCADE,
  defect_id INT NULL CONSTRAINT FK_qc_photos_defect REFERENCES qc.defects(id),
  photo_kind VARCHAR(15) NOT NULL CONSTRAINT DF_qc_photos_kind DEFAULT 'defect'
              CONSTRAINT CK_qc_photos_kind CHECK (photo_kind IN ('defect','header')),
  header_tag VARCHAR(30) NULL,
  url NVARCHAR(MAX) NOT NULL,
  created_at DATETIME2(3) NOT NULL CONSTRAINT DF_qc_photos_created DEFAULT SYSUTCDATETIME()
);

CREATE TABLE qc.inspection_pdf_versions (
  id INT IDENTITY(1,1) CONSTRAINT PK_qc_inspection_pdf_versions PRIMARY KEY,
  inspection_id INT NOT NULL CONSTRAINT FK_qc_pdf_inspection REFERENCES qc.inspections(id) ON DELETE CASCADE,
  version INT NOT NULL,
  status VARCHAR(20) NOT NULL CONSTRAINT CK_qc_pdf_status CHECK (status IN ('PENDING','OK','ERROR')),
  pdf_url NVARCHAR(MAX) NULL,
  pdf_hash VARCHAR(128) NULL,
  error_message NVARCHAR(MAX) NULL,
  generated_by_user_id INT NULL CONSTRAINT FK_qc_pdf_generated_by REFERENCES qc.users(id),
  generated_at DATETIME2(3) NOT NULL CONSTRAINT DF_qc_pdf_generated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_qc_pdf_versions UNIQUE (inspection_id, version)
);

-- ===== Trazabilidad =====
CREATE TABLE qc.audit_log (
  id            BIGINT IDENTITY(1,1) CONSTRAINT PK_qc_audit_log PRIMARY KEY,
  occurred_at   DATETIME2(3) NOT NULL CONSTRAINT DF_qc_audit_at DEFAULT SYSUTCDATETIME(),
  actor_user_id INT NULL,
  actor_label   NVARCHAR(150) NULL,
  action        VARCHAR(20) NOT NULL,
  table_name    SYSNAME NOT NULL,
  record_pk     VARCHAR(100) NOT NULL,
  old_values    NVARCHAR(MAX) NULL,
  new_values    NVARCHAR(MAX) NULL,
  request_id    VARCHAR(64) NULL,
  CONSTRAINT CK_qc_audit_old_json CHECK (old_values IS NULL OR ISJSON(old_values)=1),
  CONSTRAINT CK_qc_audit_new_json CHECK (new_values IS NULL OR ISJSON(new_values)=1)
);
GO

-- ===== Índices =====
CREATE INDEX IX_qc_inspections_created_by ON qc.inspections(created_by_user_id);
CREATE INDEX IX_qc_inspections_commodity  ON qc.inspections(commodity_id);
CREATE INDEX IX_qc_inspections_pallet     ON qc.inspections(pallet_id);
CREATE INDEX IX_qc_inspections_created_at ON qc.inspections(created_at DESC);
CREATE UNIQUE INDEX UX_qc_measurements_insp_defect   ON qc.inspection_measurements(inspection_id, defect_id) WHERE sample_id IS NULL;
CREATE UNIQUE INDEX UX_qc_measurements_sample_defect ON qc.inspection_measurements(sample_id, defect_id) WHERE sample_id IS NOT NULL;
CREATE INDEX IX_qc_photos_inspection ON qc.inspection_photos(inspection_id);
CREATE INDEX IX_qc_audit_table_pk ON qc.audit_log(table_name, record_pk, occurred_at);
CREATE INDEX IX_qc_audit_actor ON qc.audit_log(actor_user_id, occurred_at);
GO
