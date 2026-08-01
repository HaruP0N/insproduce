-- 0003_backfill.sql
-- Migra+limpia datos dbo.* (legacy) -> qc.* . Idempotente (NOT EXISTS). Un solo batch (variables persisten).
-- Preserva ids de users/assignments/inspections para conservar referencias (p.ej. nombres de PDF, link insp1<->assign3).

DECLARE @blue  INT = (SELECT id FROM qc.commodities WHERE code='BLUEBERRY');
DECLARE @straw INT = (SELECT id FROM qc.commodities WHERE code='STRAWBERRY');
DECLARE @std   INT = (SELECT id FROM qc.quality_standards WHERE commodity_id=@blue AND name=N'FTF Destino');
DECLARE @tpl   INT = (SELECT id FROM qc.metric_templates WHERE commodity_id=@blue AND version=1);

-- ===== Users (preservar ids) =====
SET IDENTITY_INSERT qc.users ON;
INSERT INTO qc.users (id, name, email, password_hash, role, active, created_at, updated_at)
SELECT lu.id, lu.name, lu.email, lu.password_hash, lu.role, lu.active, lu.created_at, lu.updated_at
FROM dbo.users lu WHERE NOT EXISTS (SELECT 1 FROM qc.users u WHERE u.id=lu.id);
SET IDENTITY_INSERT qc.users OFF;

-- ===== Producers (de los datos reales) =====
INSERT INTO qc.producers (name)
SELECT DISTINCT x.p FROM (
  SELECT producer p FROM dbo.inspections WHERE producer IS NOT NULL AND LTRIM(RTRIM(producer))<>''
  UNION SELECT producer FROM dbo.assignments WHERE producer IS NOT NULL AND LTRIM(RTRIM(producer))<>''
) x WHERE NOT EXISTS (SELECT 1 FROM qc.producers pr WHERE pr.name=x.p);

-- Override de parsing de assignments (notes_admin -> estructura). id2: status corregido a 'cancelada' (DB-6).
DECLARE @amap TABLE (id INT, cc VARCHAR(50), customer NVARCHAR(150), priority VARCHAR(10), status VARCHAR(20), instructions NVARCHAR(MAX));
INSERT INTO @amap VALUES
  (2,'BLUEBERRY', NULL,          NULL,    'cancelada',  NULL),
  (3,'BLUEBERRY', N'Walmart USA','urgent','completada', N'Arándanos frescos. Revisar calibre y firmeza.'),
  (5,'BLUEBERRY', NULL,          NULL,    'completada', NULL),
  (6,'STRAWBERRY',NULL,          NULL,    'pendiente',  NULL),
  (7,'BLUEBERRY', NULL,          NULL,    'completada', NULL);

-- ===== Lots (de inspections + assignments) =====
INSERT INTO qc.lots (commodity_id, producer_id, lot_code, variety)
SELECT DISTINCT @blue, pr.id, li.lot, li.variety
FROM dbo.inspections li
LEFT JOIN qc.producers pr ON pr.name = li.producer
WHERE li.lot IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM qc.lots l WHERE l.commodity_id=@blue AND l.lot_code=li.lot);

INSERT INTO qc.lots (commodity_id, producer_id, lot_code, variety)
SELECT DISTINCT c.id, pr.id, la.lot, la.variety
FROM dbo.assignments la
JOIN @amap m ON m.id = la.id
JOIN qc.commodities c ON c.code = m.cc
LEFT JOIN qc.producers pr ON pr.name = la.producer
WHERE la.lot IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM qc.lots l WHERE l.commodity_id=c.id AND l.lot_code=la.lot);

-- ===== Assignments (preservar ids; commodity/customer/status/instructions parseados) =====
SET IDENTITY_INSERT qc.assignments ON;
INSERT INTO qc.assignments (id, user_id, lot_id, commodity_id, customer_id, standard_id, producer, lot, variety, priority, instructions, status, created_at)
SELECT la.id, la.user_id,
       (SELECT id FROM qc.lots l WHERE l.commodity_id=c.id AND l.lot_code=la.lot),
       c.id,
       (SELECT id FROM qc.customers cu WHERE cu.name=m.customer),
       CASE WHEN c.code='BLUEBERRY' THEN @std ELSE NULL END,
       la.producer, la.lot, la.variety, m.priority, m.instructions, m.status, la.created_at
FROM dbo.assignments la
JOIN @amap m ON m.id=la.id
JOIN qc.commodities c ON c.code=m.cc
WHERE NOT EXISTS (SELECT 1 FROM qc.assignments a WHERE a.id=la.id);
SET IDENTITY_INSERT qc.assignments OFF;

-- ===== Pallets (placeholder: 1 por lot, hasta tener datos reales de pallet) =====
INSERT INTO qc.pallets (lot_id, pallet_code)
SELECT l.id, 'P1' FROM qc.lots l
WHERE NOT EXISTS (SELECT 1 FROM qc.pallets p WHERE p.lot_id=l.id AND p.pallet_code='P1');

-- ===== Inspections (preservar ids; commodity/template/standard; link a assignment; calibre texto descartado) =====
SET IDENTITY_INSERT qc.inspections ON;
INSERT INTO qc.inspections
  (id, pallet_id, assignment_id, commodity_id, template_id, template_version, standard_id, created_by_user_id,
   brix_min, brix_max, brix_mode, brix_avg, diameter_min, diameter_max, temp_pulp, temp_ambient, temp_water, net_weight, notes, created_at, updated_at)
SELECT li.id,
       (SELECT TOP 1 p.id FROM qc.pallets p JOIN qc.lots l ON l.id=p.lot_id WHERE l.commodity_id=@blue AND l.lot_code=li.lot),
       (SELECT a.id FROM dbo.assignments la2
          CROSS APPLY (SELECT CASE WHEN la2.notes_admin LIKE '%Inspección ID: ' + CAST(li.id AS VARCHAR(10)) + '%' THEN la2.id END a_id) z
          JOIN qc.assignments a ON a.id = z.a_id),
       @blue, @tpl, 1, @std, li.created_by_user_id,
       li.brix_min, li.brix_max, li.brix_moda, li.brix_avg, li.diameter_min, li.diameter_max,
       li.temp_pulp, li.temp_ambient, li.temp_water,
       CASE WHEN li.net_weight > 0 THEN li.net_weight END,
       li.notes, li.created_at, li.updated_at
FROM dbo.inspections li
WHERE NOT EXISTS (SELECT 1 FROM qc.inspections i WHERE i.id=li.id);
SET IDENTITY_INSERT qc.inspections OFF;

-- ===== Measurements (JSON metrics -> filas tipadas; '' se omite; selects -> option) =====
INSERT INTO qc.inspection_measurements (inspection_id, defect_id, value_num, value_option_id, value_text)
SELECT i.id, d.id,
       CASE WHEN d.value_type='number' THEN TRY_CAST(j.mv AS DECIMAL(9,3)) END,
       o.id,
       CASE WHEN d.value_type='text' THEN NULLIF(LTRIM(RTRIM(j.mv)),'') END
FROM dbo.inspections li
JOIN qc.inspections i ON i.id=li.id
CROSS APPLY (SELECT mk = [key] COLLATE DATABASE_DEFAULT, mv = [value] COLLATE DATABASE_DEFAULT
             FROM OPENJSON(li.metrics, '$.values')) j
JOIN qc.defects d ON d.commodity_id=@blue
  AND d.family = LEFT(j.mk, CHARINDEX('.', j.mk) - 1)
  AND d.code   = SUBSTRING(j.mk, CHARINDEX('.', j.mk) + 1, 200)
LEFT JOIN qc.defect_options o ON o.defect_id=d.id AND o.value = LTRIM(RTRIM(j.mv))
WHERE NULLIF(LTRIM(RTRIM(j.mv)),'') IS NOT NULL
  AND (d.value_type<>'select' OR o.id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM qc.inspection_measurements m WHERE m.inspection_id=i.id AND m.defect_id=d.id AND m.sample_id IS NULL);

-- ===== Photos de defecto (metric_key -> defect_id) =====
INSERT INTO qc.inspection_photos (inspection_id, defect_id, photo_kind, url, created_at)
SELECT i.id, d.id, 'defect', lp.url, lp.created_at
FROM dbo.inspection_photos lp
JOIN qc.inspections i ON i.id=lp.inspection_id
LEFT JOIN qc.defects d ON d.commodity_id=@blue
  AND d.family = LEFT(lp.metric_key, CHARINDEX('.', lp.metric_key) - 1)
  AND d.code   = SUBSTRING(lp.metric_key, CHARINDEX('.', lp.metric_key) + 1, 200)
WHERE lp.metric_key IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM qc.inspection_photos x WHERE x.inspection_id=i.id AND x.photo_kind='defect' AND x.url=lp.url);

-- ===== Photos de cabecera (header_photos JSON -> filas kind='header') =====
INSERT INTO qc.inspection_photos (inspection_id, photo_kind, header_tag, url, created_at)
SELECT i.id, 'header', hk.htag, hv.hurl, li.created_at
FROM dbo.inspections li
JOIN qc.inspections i ON i.id=li.id
CROSS APPLY (SELECT htag = [key] COLLATE DATABASE_DEFAULT, hval = [value] FROM OPENJSON(li.header_photos)) hk
CROSS APPLY (SELECT hurl = [value] COLLATE DATABASE_DEFAULT FROM OPENJSON(hk.hval)) hv
WHERE li.header_photos IS NOT NULL AND ISJSON(li.header_photos)=1
  AND NOT EXISTS (SELECT 1 FROM qc.inspection_photos x WHERE x.inspection_id=i.id AND x.photo_kind='header' AND x.url=hv.hurl);

-- ===== PDF versions (1 por inspección existente) =====
INSERT INTO qc.inspection_pdf_versions (inspection_id, version, status, pdf_url, pdf_hash, error_message, generated_at)
SELECT p.inspection_id, 1, p.status, p.pdf_url, p.pdf_hash, p.error_message, ISNULL(p.updated_at, SYSUTCDATETIME())
FROM dbo.inspection_pdfs p
JOIN qc.inspections i ON i.id=p.inspection_id
WHERE NOT EXISTS (SELECT 1 FROM qc.inspection_pdf_versions v WHERE v.inspection_id=p.inspection_id AND v.version=1);
