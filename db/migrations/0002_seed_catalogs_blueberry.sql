-- 0002_seed_catalogs_blueberry.sql
-- Catálogos consolidados + dominio QC de ARÁNDANO (defectos canónicos, tolerancias FTF/Qima, bandas, plantilla).
-- Idempotente: usa WHERE NOT EXISTS. Otros commodities (frutilla/frambuesa/etc.) se sembrarán aparte.

-- ===== Commodities (consolidados, DB-9) =====
INSERT INTO qc.commodities (code, name, active)
SELECT v.code, v.name, v.active FROM (VALUES
  ('CHERRY',     N'Cereza',       0),
  ('STRAWBERRY', N'Frutilla',     1),
  ('RASPBERRY',  N'Frambuesa',    1),
  ('BLACKBERRY', N'Mora',         1),
  ('BLUEBERRY',  N'Arándano',     1),
  ('REDCURRANT', N'Grosella Roja',1)
) v(code,name,active)
WHERE NOT EXISTS (SELECT 1 FROM qc.commodities c WHERE c.code=v.code);

-- Aliases para backfill de notes_admin (0810 / Arándano / RED_CURRANTS legacy)
INSERT INTO qc.commodity_aliases (commodity_id, alias_code, scheme)
SELECT (SELECT id FROM qc.commodities WHERE code=v.target), v.alias, v.scheme FROM (VALUES
  ('BLUEBERRY','0810','HS'),
  ('BLUEBERRY',N'Arándano','es_name'),
  ('REDCURRANT','RED_CURRANTS','legacy_code')
) v(target,alias,scheme)
WHERE NOT EXISTS (SELECT 1 FROM qc.commodity_aliases a WHERE a.scheme=v.scheme AND a.alias_code=v.alias);

-- ===== Destinos / clientes / embalajes =====
INSERT INTO qc.destinations (code, name)
SELECT v.code, v.name FROM (VALUES ('FTF',N'Family Tree Farms'),('US',N'Estados Unidos')) v(code,name)
WHERE NOT EXISTS (SELECT 1 FROM qc.destinations d WHERE d.code=v.code);

INSERT INTO qc.customers (name)
SELECT v.name FROM (VALUES (N'Walmart USA'),(N'Family Tree Farms')) v(name)
WHERE NOT EXISTS (SELECT 1 FROM qc.customers c WHERE c.name=v.name);

INSERT INTO qc.packaging_types (code, label, net_weight_g, sample_count)
SELECT v.code, v.label, v.w, v.s FROM (VALUES
  ('6OZ',  N'6 Oz',   170, 7),
  ('9.8OZ',N'9.8 Oz', 277, 6),
  ('PINT', N'Pint',   312, 6),
  ('16OZ', N'16 Oz',  453, 3),
  ('18OZ', N'18 Oz',  510, 3)
) v(code,label,w,s)
WHERE NOT EXISTS (SELECT 1 FROM qc.packaging_types p WHERE p.code=v.code);
GO

-- ===== Defectos canónicos de ARÁNDANO (code = sufijo de la key legacy, para backfill limpio) =====
DECLARE @blue INT = (SELECT id FROM qc.commodities WHERE code='BLUEBERRY');

INSERT INTO qc.defects (commodity_id, code, label, family, value_type, unit)
SELECT @blue, v.code, v.label, v.family, v.vtype, v.unit FROM (VALUES
  ('dust',                 N'Dust (%)',                 'quality',  'number','%'),
  ('contamination',        N'Contamination (%)',        'quality',  'number','%'),
  ('size_note',            N'Size (nota 1-3)',          'quality',  'select',NULL),
  ('size_consistency_note',N'Size Consistency (1-2)',   'quality',  'select',NULL),
  ('bloom_pct',            N'Bloom (%)',                'quality',  'number','%'),
  ('russet_scars',         N'Russet/Scars (%)',         'quality',  'number','%'),
  ('no_bloom',             N'No/Low Bloom (%)',         'quality',  'number','%'),
  ('attached_stems',       N'Attached Stems (%)',       'quality',  'number','%'),
  ('flower_remains',       N'Flower Remains (%)',       'quality',  'number','%'),
  ('undersize',            N'Undersize (%)',            'quality',  'number','%'),
  ('lack_of_color',        N'Lack of Color (%)',        'quality',  'number','%'),
  ('immature_red',         N'Immature Red (%)',         'condition','number','%'),
  ('decay',                N'Decay (%)',                'condition','number','%'),
  ('decay_incidence',      N'Decay Incidence (0-10)',   'condition','number','count'),
  ('mold',                 N'Mold (%)',                 'condition','number','%'),
  ('mold_incidence',       N'Mold Incidence (0-10)',    'condition','number','count'),
  ('mold_type',            N'Mold Type',                'condition','select',NULL),
  ('soft',                 N'Soft (%)',                 'condition','number','%'),
  ('sensitive',            N'Sensitive (%)',            'condition','number','%'),
  ('shriveling',           N'Shriveling (%)',           'condition','number','%'),
  ('broken_skin',          N'Broken Skin (%)',          'condition','number','%'),
  ('wounds',               N'Wounds (%)',               'condition','number','%'),
  ('crushed',              N'Crushed (%)',              'condition','number','%')
) v(code,label,family,vtype,unit)
WHERE NOT EXISTS (SELECT 1 FROM qc.defects d WHERE d.commodity_id=@blue AND d.family=v.family AND d.code=v.code);

-- Opciones de selects
INSERT INTO qc.defect_options (defect_id, value, label, order_index)
SELECT d.id, o.value, o.label, o.ord
FROM (VALUES
  ('size_note','1','1',1),('size_note','2','2',2),('size_note','3','3',3),
  ('size_consistency_note','1','1',1),('size_consistency_note','2','2',2),
  ('mold_type','None',N'None',0),('mold_type','Spot',N'Spot',1),('mold_type','Nest',N'Nido',2),
  ('mold_type','Pedicelar',N'Pedicelar',3),('mold_type','Other',N'Otro',4)
) o(dcode,value,label,ord)
JOIN qc.defects d ON d.commodity_id=@blue AND d.code=o.dcode
WHERE NOT EXISTS (SELECT 1 FROM qc.defect_options x WHERE x.defect_id=d.id AND x.value=o.value);

-- ===== Estándar FTF + tolerancias (5 bandas, Qima/FTF) =====
INSERT INTO qc.quality_standards (name, commodity_id, destination_id)
SELECT N'FTF Destino', @blue, (SELECT id FROM qc.destinations WHERE code='FTF')
WHERE NOT EXISTS (SELECT 1 FROM qc.quality_standards s WHERE s.commodity_id=@blue AND s.name=N'FTF Destino');

DECLARE @std INT = (SELECT id FROM qc.quality_standards WHERE commodity_id=@blue AND name=N'FTF Destino');

INSERT INTO qc.defect_tolerances (standard_id, defect_id, band, band_label, min_pct, max_pct)
SELECT @std, d.id, t.band, t.lbl, t.mn, t.mx
FROM (VALUES
  -- defecto, banda, etiqueta, min, max (NULL=sin techo)
  ('dust',1,'Excellent',0,0),('dust',3,'Fair',0.01,10),('dust',4,'Poor',10.01,30),('dust',5,'Bad',30.01,NULL),
  ('contamination',1,'Excellent',0,0),('contamination',4,'Poor',0.01,10),('contamination',5,'Bad',10.01,NULL),
  ('bloom_pct',1,'Excellent',80.01,100),('bloom_pct',2,'Good',0,80),
  ('russet_scars',1,'Excellent',0,4),('russet_scars',2,'Good',4.01,8),('russet_scars',3,'Fair',8.01,15),('russet_scars',4,'Poor',15.01,25),('russet_scars',5,'Bad',25.01,NULL),
  ('attached_stems',1,'Excellent',0,4),('attached_stems',2,'Good',4.01,8),('attached_stems',3,'Fair',8.01,25),('attached_stems',4,'Poor',25.01,50),('attached_stems',5,'Bad',50.01,NULL),
  ('no_bloom',1,'Excellent',0,4),('no_bloom',2,'Good',4.01,8),('no_bloom',3,'Fair',8.01,25),('no_bloom',4,'Poor',25.01,50),('no_bloom',5,'Bad',50.01,NULL),
  ('flower_remains',1,'Excellent',0,4),('flower_remains',2,'Good',4.01,8),('flower_remains',3,'Fair',8.01,15),('flower_remains',4,'Poor',15.01,25),('flower_remains',5,'Bad',25.01,NULL),
  ('undersize',1,'Excellent',0,4),('undersize',2,'Good',4.01,8),('undersize',3,'Fair',8.01,15),('undersize',4,'Poor',15.01,25),('undersize',5,'Bad',25.01,NULL),
  ('immature_red',1,'Excellent',0,4),('immature_red',2,'Good',4.01,8),('immature_red',3,'Fair',8.01,25),('immature_red',4,'Poor',25.01,50),('immature_red',5,'Bad',50.01,NULL),
  ('decay',1,'Excellent',0,0),('decay',3,'Fair',0.01,1),('decay',4,'Poor',1.01,2),('decay',5,'Bad',2.01,NULL),
  ('mold',1,'Excellent',0,0),('mold',3,'Fair',0.01,1),('mold',4,'Poor',1.01,2),('mold',5,'Bad',2.01,NULL),
  ('soft',1,'Excellent',0,3),('soft',2,'Good',3.01,6),('soft',3,'Fair',6.01,10),('soft',4,'Poor',10.01,20),('soft',5,'Bad',20.01,NULL),
  ('sensitive',1,'Excellent',0,12),('sensitive',2,'Good',12.01,24),('sensitive',3,'Fair',24.01,40),('sensitive',4,'Poor',40.01,80),('sensitive',5,'Bad',80.01,NULL),
  ('shriveling',1,'Excellent',0,3),('shriveling',2,'Good',3.01,6),('shriveling',3,'Fair',6.01,12),('shriveling',4,'Poor',12.01,20),('shriveling',5,'Bad',20.01,NULL),
  ('broken_skin',1,'Excellent',0,1),('broken_skin',2,'Good',1.01,2),('broken_skin',3,'Fair',2.01,4),('broken_skin',4,'Poor',4.01,10),('broken_skin',5,'Bad',10.01,NULL),
  ('wounds',1,'Excellent',0,1),('wounds',2,'Good',1.01,2),('wounds',3,'Fair',2.01,4),('wounds',4,'Poor',4.01,10),('wounds',5,'Bad',10.01,NULL),
  ('crushed',1,'Excellent',0,0),('crushed',3,'Fair',0.01,1),('crushed',4,'Poor',1.01,4),('crushed',5,'Bad',4.01,NULL)
) t(dcode,band,lbl,mn,mx)
JOIN qc.defects d ON d.commodity_id=@blue AND d.code=t.dcode
WHERE NOT EXISTS (SELECT 1 FROM qc.defect_tolerances x WHERE x.standard_id=@std AND x.defect_id=d.id AND x.band=t.band);

-- ===== Bandas de calibre / color / firmeza (arándano) =====
INSERT INTO qc.size_bands (commodity_id, code, min_mm, max_mm)
SELECT @blue, v.code, v.mn, v.mx FROM (VALUES ('Large',12,18.9),('Jumbo',19,21.9),('King',22,NULL)) v(code,mn,mx)
WHERE NOT EXISTS (SELECT 1 FROM qc.size_bands b WHERE b.commodity_id=@blue AND b.code=v.code);

INSERT INTO qc.color_bands (commodity_id, code)
SELECT @blue, v.code FROM (VALUES ('Rojo'),('Verde'),('Azul'),('Rango1'),('Rango2'),('Rango3')) v(code)
WHERE NOT EXISTS (SELECT 1 FROM qc.color_bands b WHERE b.commodity_id=@blue AND b.code=v.code);

INSERT INTO qc.firmness_bands (commodity_id, code, min_shore, max_shore)
SELECT @blue, v.code, v.mn, v.mx FROM (VALUES ('Soft',NULL,59.9),('Sensitiva',60,74),('Firme',75,NULL)) v(code,mn,mx)
WHERE NOT EXISTS (SELECT 1 FROM qc.firmness_bands b WHERE b.commodity_id=@blue AND b.code=v.code);

-- ===== Plantilla de arándano v1 + sus defectos =====
INSERT INTO qc.metric_templates (commodity_id, version, name, active)
SELECT @blue, 1, N'Standard Blueberries', 1
WHERE NOT EXISTS (SELECT 1 FROM qc.metric_templates t WHERE t.commodity_id=@blue AND t.version=1);

DECLARE @tpl INT = (SELECT id FROM qc.metric_templates WHERE commodity_id=@blue AND version=1);

INSERT INTO qc.template_defects (template_id, defect_id, required, order_index)
SELECT @tpl, d.id, 0, d.id
FROM qc.defects d
WHERE d.commodity_id=@blue
  AND NOT EXISTS (SELECT 1 FROM qc.template_defects td WHERE td.template_id=@tpl AND td.defect_id=d.id);
GO
