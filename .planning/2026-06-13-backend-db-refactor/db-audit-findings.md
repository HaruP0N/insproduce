# Auditoría de la Base de Datos `fruticola_2026` (Azure SQL)

> Auditoría hecha con la skill **audit-context-building** (evidence-based, cada hallazgo referenciado a tabla/columna/fila reales) y **5 agentes en paralelo** (normalización, integridad, calidad de datos, audit-trail, tipos/índices/naming). Fuentes: introspección real (`db-introspection.json`) + muestreo de datos reales (`db-sample.json`). Motor: Microsoft SQL Azure 12.0.2000.8, collation `SQL_Latin1_General_CP1_CI_AS`.

## Corrección de la premisa inicial
La BD **NO** está "sin PKs ni FKs": tiene **PK en las 8 tablas, 8 FKs, 18 índices, 6 uniques, 4 checks, 18 defaults, 2 triggers y 1 vista**. Está razonablemente estructurada a nivel relacional básico. Los problemas reales son otros: **(a) no hay trazabilidad/auditoría**, **(b) el dominio QC no está modelado (hoja plana + JSON)**, y **(c) hay pudrición de datos** (duplicados, texto libre sobrecargado, tipos string, typos). Eso sí justifica una refactorización profunda.

## Inventario real (8 tablas de aplicación)
`users`(2) · `commodities`(7) · `metric_templates`(5) · `metric_fields`(87) · `assignments`(5) · `inspections`(3) · `inspection_photos`(24) · `inspection_pdfs`(3) + vista `vw_inspections_admin`.

---

## P0 — Críticos

### DB-1 · Sin audit trail / historial (trazabilidad inexistente)
No existe ninguna tabla de auditoría/log/historial. Lo único temporal: `created_at`/`updated_at` y 2 triggers `AFTER UPDATE` que **solo** refrescan `updated_at` (no guardan valores previos, ni actor, ni operación). Sin System-Versioning, sin CDC. **Evidencia:** `triggers` en introspección. **Impacto:** en un dominio que emite reportes QC a clientes (Walmart USA, Family Tree Farms — confirmados en `assignments.notes_admin`), no se puede responder "qué cambió, cuándo, quién y qué valor tenía antes". Riesgo legal/comercial.

### DB-2 · Pérdida de historial de métricas (overwrite in-place)
`inspections.metrics` se sobrescribe al editar (y se invalida el PDF). No hay versión anterior. **Evidencia:** columna `nvarchar(MAX)` única + trigger que solo toca `updated_at`. **Impacto:** un PDF emitido a cliente puede divergir del dato actual sin forma de reconstruir lo reportado ni detectar manipulación.

### DB-3 · `inspections.metrics` = repeating group no atómico, valores string, sin anclaje de plantilla (1NF)
JSON `NVARCHAR(MAX)` con 22–24 mediciones por fila; **todos los valores son strings** (`"0.5"`, `"14"`), con strings vacíos `""` para "no medido" conviviendo con `"None"` y `"0"` (3 semánticas de "sin dato"). `template_id`/`template_version` **siempre null** en las 3 inspecciones. **Evidencia:** `inspections` id 1/2/3 en `db-sample.json`. **Impacto:** imposible validar/agregar/filtrar en SQL; rangos `min/max_value` inaplicables; no se sabe con qué plantilla/versión se capturó → trazabilidad rota.

### DB-4 · `assignments.notes_admin` sobrecargado: commodity/cliente/estado/urgencia/FK en texto libre (1NF/3NF)
Una sola columna mezcla hasta 5 atributos. **Evidencia:** id 3 = `"Commodity: 0810 - Arándanos frescos. Cliente: Walmart USA. Urgente:... [Completada - Inspección ID: 1]"`. El **commodity** se guarda con 3 convenciones distintas entre filas: `"0810"` (HS, ni existe en catálogo), `"Arándano"` (nombre ES), `"BLUEBERRY"` (código); el **cliente/destino** (atributo de 1ª clase del QC, rige tolerancias) solo vive en prosa; el vínculo a la inspección es una FK escrita a mano ("Inspección ID: 1"). **Impacto:** datos críticos no consultables ni íntegros.

### DB-5 · Modelo dual de asignación + vínculo por texto
Coexisten la tabla `assignments` y la columna `inspections.assigned_to_user_id` (con FK + índice) que está **null en las 3 inspecciones** (infraestructura muerta). No hay FK que ligue assignment↔inspection; el "join" es regex sobre `notes_admin`. **Impacto:** imposible reportar cumplimiento asignado-vs-inspeccionado de forma confiable.

### DB-6 · Inconsistencia de estado (corrupción de KPI)
`assignments` id 2: `status="completada"` pero `notes_admin="...[CANCELADA POR ADMIN]"`. El check `CK_assign_status` admite `'cancelada'`, pero la cancelación se registró en prosa. **Impacto:** un lote cancelado se cuenta como completado → KPIs/SLAs falseados.

### DB-7 · Gap de dominio QC (modela una hoja plana, no el negocio)
Faltan, frente al estándar FTF/Qima: **nivel Pallet** (Lote→Pallets→muestras; hoy plano), **familias Calidad/Condición** como entidad (hoy son prefijo del `key`), **tabla de tolerancias** (5 bandas %→categoría por destino; inexistente), **Score/Resolución/defecto causal** (no se guardan), **firmeza Baxlo/Shore** (inexistente), **distribución de calibre y color** (inexistente; solo `caliber` texto "14 cm"). **Impacto:** no se puede calcular ni emitir el resultado QC real.

---

## P1 — Altos

- **DB-8 · `commodity_code` desnormalizado en 3 tablas sin FK** — `assignments.commodity_code` y `metric_templates.commodity_code` (varchar) duplican el catálogo; `metric_templates` lleva `commodity_id` (FK) **y** `commodity_code` (redundante, puede divergir). Sin FK a `commodities.code`. → usar solo `commodity_id` FK.
- **DB-9 · Commodities duplicados** — id 6 `RED_CURRANTS` (active 0) y id 7 `REDCURRANT` (active 1), mismo `name` "Red Currants". UNIQUE es sobre `code`, no sobre `name`. id 6 es dato muerto. (CHERRY id1 también inactivo.) Mezcla idiomas en `name` (ES vs EN).
- **DB-10 · `metric_fields.key` con typos/duplicados semánticos** — `quality.immature` vs `quality.inmature` (typo), `quality.russet`/`russet_scars`/`scars` (×3), `condition.overripe`/`overripe_too_dark`/`soft_overripe` (×3), `shriveling` en dos namespaces. → diccionario canónico.
- **DB-11 · Familia (calidad/condición) codificada en el prefijo del `key`** — hay que parsear `SUBSTRING` para clasificar; frágil. → columna `family`.
- **DB-12 · `options` y `header_photos` como JSON** — `metric_fields.options` (relación 1:N campo→opción como blob) y `inspections.header_photos` (clave→array de URLs, redundante con `inspection_photos`, sin el `ON DELETE CASCADE`).
- **DB-13 · `min_value`/`max_value` siempre null** — los rangos de validación existen como columnas pero nunca se poblaron → cero validación; valores sospechosos sin frenar (DB-19).
- **DB-14 · Sin actor en updates** — solo `created_by_user_id` en el alta; no hay `updated_by`. Conexión técnica única → el actor real no es derivable en BD. → `sp_set_session_context` + `audit_log`.
- **DB-15 · Borrado físico de users (sin soft-delete)** — `FK_inspections_created_by = SET_NULL` borra la autoría al eliminar el usuario; cancelación de assignments por anexar texto. → soft-delete universal.
- **DB-16 · `inspection_pdfs` sin versionado** — PK = `inspection_id` (1 fila); regenerar pisa el `pdf_url`/`pdf_hash` anterior → sin historial del reporte emitido.
- **DB-17 · FKs a `users` con ON DELETE divergentes** — `created_by`=SET_NULL, `assigned_to`=NO_ACTION (pero la columna es nullable), `assign_user`=NO_ACTION. Política incoherente.
- **DB-18 · FKs de `inspections` sin índice** — `created_by_user_id` y `commodity_id` sin índice → scans en "inspecciones por inspector/commodity" y penaliza DELETE/UPDATE en las tablas padre.
- **DB-19 · JSON sin `CHECK (ISJSON()=1)`** — `metrics`, `header_photos`, `options` pueden contener basura no-JSON y romper `OPENJSON` en lectura.
- **DB-20 · Sin aislamiento a nivel BD (RLS/roles)** — la autorización por rol es solo dato (`CK_users_role`); toda la defensa está en la app (sin segunda barrera ante IDOR o fuga de credenciales).

---

## P2 — Medios

- **DB-21 · `caliber` no atómico + valores fuera de rango físico** — `caliber` varchar "14 cm" (arándano se mide en mm), `temp_pulp=35°C` (cadena de frío rota o error), `net_weight` 125 vs 0.29 (mezcla kg/g), `diameter_min/max` solo en id 3. Sin CHECKs de rango.
- **DB-22 · `inspections` denormaliza `producer/lot/variety`** que ya viven en `assignments`, sin FK que las una → divergencia silenciosa.
- **DB-23 · `assignments` sin FK a `commodities` ni a `inspections`** (solo `FK_assign_user`).
- **DB-24 · `FK_templates_commodity` con CASCADE** — borrar una commodity arrastra plantillas + 87 `metric_fields`. → usar soft-delete (`active=0`) y NO_ACTION.
- **DB-25 · Faltan CHECKs de rango** — brix 0–100, `brix_min≤brix_max`, `diameter_min≤diameter_max`, `net_weight>0`, temperatura plausible, `min_value≤max_value`.
- **DB-26 · `idx_inspections_assigned_to` inútil** — sobre columna 100% null. → eliminar o índice filtrado.
- **DB-27 · PKs/UQ con nombres autogenerados** (`PK__assignme__3213E83F...`, `UQ__commodit__...`) vs FK/CK/DF explícitos → no determinístico entre entornos, rompe migraciones idempotentes.
- **DB-28 · `varchar` vs `nvarchar` inconsistente** — texto con acentos ("Arándano", "Agrícola") en columnas `varchar` (CP1252) → frágil ante no-latinos. → unificar texto de usuario a `nvarchar`.
- **DB-29 · `vw_inspections_admin` desactualizada** — omite `brix_min/max/moda`, `diameter_min/max`, `header_photos`, `assigned_to_user_id`; expone `metrics` JSON crudo.
- **DB-30 · Cobertura de fotos dispar** — inspección 1: 0 fotos; 2: 22; 3: 2 (con defectos medidos sin foto). Sin política de evidencia mínima.
- **DB-31 · Collation CI en `code`** — comparaciones case-insensitive sobre códigos; combinado con DB-9 aumenta ambigüedad. (CI en `email` es correcto.)

## P3 — Bajos
- **DB-32 · `inspection_photos.label == metric_key`** (100% redundante; el label debería ser el texto legible de `metric_fields.label`).
- **DB-33 · Naming de templates inconsistente** — "Blueberry QC v1" vs "Standard X"; versión embebida en el nombre además de la columna `version`.
- **DB-34 · `inspection_pdfs` 1:1 forzado** (PK=inspection_id) — impide versionar PDF (relacionado con DB-16).
- **DB-35 · Precisiones decimales** — `min/max_value decimal(18,2)` desproporcionado vs `decimal(6,2)` del resto; `net_weight decimal(10,2)` sobredimensionado.

## Config (fuera de la BD pero relacionado)
- **DB-36 · `.env.local` mal apuntado** — define `AZURE_SQL_*` pero el código lee `DB_*`; y la base era `transportes` cuando la real es **`fruticola_2026`**. Con ese `.env.local`, la app no conecta. (Ya verificado: login falla apuntando a `transportes`, conecta a `fruticola_2026`.)

---

## Síntesis para el plan de refactor
La refactorización de BD debería cubrir 4 ejes:
1. **Trazabilidad** (DB-1,2,14,15,16): `audit_log` + `sp_set_session_context`, temporal tables (System-Versioning) en `inspections`/`users`/`assignments`/`pdfs`, versionado de métricas y PDF, soft-delete.
2. **Modelo de dominio QC** (DB-7,11): jerarquía `lots`→`pallets`→`samples`, `defects` (con `family`), `quality_standards`+`defect_tolerances` (5 bandas por destino), `inspection_results` (totales/score/resolución/causal), distribuciones calibre/color, firmeza.
3. **Normalización / integridad** (DB-3,4,5,8,12,17,22,23,24): `inspection_measurements` tipada (reemplaza JSON), `customers`/`destinations`/`producers`, FKs por `commodity_id`, vínculo real assignment↔inspection, eliminar dual model.
4. **Calidad / saneamiento + esquema** (DB-6,9,10,13,18,19,20,21,25–35): limpiar duplicados, backfill desde texto libre, diccionario de defectos, CHECKs/índices/ISJSON, renombrar constraints, nvarchar, RLS, vista al día.

Todo es aplicable nativamente en Azure SQL. Requiere migración de datos (los 3 inspections/5 assignments actuales) con backfill y limpieza.
