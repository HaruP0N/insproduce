# Progress Log — Refactor Backend + BD

## Sesión 2026-06-13

### Hecho
- Revisión exhaustiva del backend + BD con skill `code-review-expert` → `findings.md` (P0:3, P1:5, P2:7, P3:5).
- Plan de refactor en 4 fases → `task_plan.md` y `REFACTOR-PLAN.md`.
- Analizados los docs frutícola (estándar Qima/FTF, tolerancias, protocolo) → ver memoria `fruticola-qc-domain`.

### Hallazgos clave (ver findings.md)
- P0: IDOR de escritura en metrics, fallback de secreto JWT, esquema SQL desincronizado.
- Bug transversal: `v.payload` (debería ser `v.user`) rompe endpoints admin.

### Pendiente / próxima acción
- Esperar elección del usuario sobre por dónde arrancar (Fase 0 recomendada).
- Bloqueante Fase 2/3: confirmar acceso a la BD real para el dump de esquema.

### Test results
- (revisión/planificación: ninguno)

## Sesión 2026-06-13 — Fase 0 implementada

### Hecho
- **Task 0.1** (P0-2): `verifyToken.js` ya no usa secreto fallback; lanza/retorna 500 si falta `JWT_SECRET`.
- **Task 0.2** (P2-1): nuevos `src/lib/http.js` (`fail`/`ok`/`serverError`) y `src/lib/auth/requireAuth.js` (`requireAuth`, `authorizeOwnership`).
- **Task 0.3** (P0-1): IDOR de escritura cerrado en `inspecciones/[id]/metrics` (admin o dueño).
- **Task 0.4** (P1-1): IDOR de lectura cerrado en `inspecciones/[id]` (GET), `[id]/pdf`, `[id]/generar-pdf`, `assignments/[id]` (GET).
- **Task 0.5** (P1-4 SSRF): nuevo `src/lib/security/photoUrls.js` (allowlist `res.cloudinary.com`); aplicado en `POST /inspecciones` y en `downloadImageAsBase64` del generador de PDF.

### Verificación
- `npm run build` → **OK** (compila sin errores, todas las rutas listadas).
- Pendiente: prueba manual con `curl` (requiere `npm run dev` + cookies de prueba).

### Pendiente / próxima acción
- Confirmar con el usuario si commitear (estamos en `main` → conviene branch).
- Fase 1: consolidar auth (un verificador, cookie-only, fix `v.payload` en las 5 rutas restantes, limpieza).

### Archivos modificados
- Nuevos: `src/lib/http.js`, `src/lib/auth/requireAuth.js`, `src/lib/security/photoUrls.js`
- Editados: `src/lib/auth/verifyToken.js`, `src/lib/pdf/generator.js`, `src/app/api/inspecciones/route.js`, `src/app/api/inspecciones/[id]/route.js`, `src/app/api/inspecciones/[id]/metrics/route.js`, `src/app/api/inspecciones/[id]/pdf/route.js`, `src/app/api/inspecciones/[id]/generar-pdf/route.js`, `src/app/api/assignments/[id]/route.js`

## Sesión 2026-06-13 — Fase 1 implementada

### Hecho
- **Task 1.1/1.2** (P1-2, P1-3 servidor): migradas a `requireAuth` (cookie) las 7 rutas rotas/Bearer: `metric-templates` (POST, [id] GET/PUT, [id]/fields PUT), `inspecciones/[id]/asignar`, `ops/inspecciones` (+fix `myId`), `inspecciones` (POST/GET), `commodities/[code]/template`. Elimina la clase de bug `v.payload` (siempre 403) y deja el servidor cookie-only.
- **Task 1.3** (P3-1/P2-7/P3-4/P2-3): borrado `verifyTokenFromCookies.js` (huérfano); login → `bcryptjs` y `bcrypt` quitado de package.json (npm install); middleware `/ops`→`/inspector`; nuevo `src/lib/json.js` y deduplicadas 5 copias de `safeJson*`.
- **Task 1.4** (P1-3): CSP sin `unsafe-eval` en producción (dev lo mantiene por HMR).

### Verificación
- `npm install` OK; `npm run build` → **✓ Compiled successfully**.
- Grep: `v.payload` solo en un comentario; `verifyTokenFromRequest` sin usos (función queda definida, dead); `import bcrypt` nativo: 0.
- `npm audit`: 2 vulnerabilidades en deps transitivas (fuera de alcance).

### Diferido (polish menor, sin cambio de comportamiento)
- Limpieza frontend cookie-only (quitar token de localStorage/Bearer, token del body de login) → cierra del todo P1-3. (Es front; el usuario pidió back+DB.)
- `replaceTemplateFields()` DRY (P2-2); `serverError` sweep de `'Error: '+e.message` (P2-6); migrar las ~22 rutas ya correctas a `requireAuth` (P2-1).
- Quitar `verifyTokenFromRequest` (ahora dead) de `verifyToken.js`.

### Próxima acción
- Fase 2 (BD): requiere acceso/credenciales o un dump del esquema real.

## Sesión 2026-06-14 — Auditoría de la BD real

### Hecho
- Conexión a Azure SQL real: base correcta = **`fruticola_2026`** (el `.env.local` apuntaba a `transportes` y usa `AZURE_SQL_*` mientras el código lee `DB_*` → DB-36).
- Introspección completa (`db-audit.mjs` → `db-introspection.json`) y muestreo de datos (`db-sample.mjs` → `db-sample.json`).
- **Auditoría** con skill `audit-context-building` + **5 agentes en paralelo** (normalización, integridad, calidad de datos, audit-trail, tipos/índices/naming) → consolidada en `db-audit-findings.md`.

### Resultado clave
- Premisa corregida: la BD **sí** tiene PKs (8), FKs (8), índices (18), checks, triggers, vista. NO está "sin claves".
- Los problemas reales: (1) sin trazabilidad/auditoría, (2) dominio QC no modelado (hoja plana + JSON), (3) pudrición de datos (duplicados, texto libre sobrecargado, números como string, typos).
- Severidades: P0:7, P1:13, P2:11, P3:4 (+ config DB-36).

### Próxima acción
- Producir el PLAN de refactor de BD (con writing-plans), luego ejecutar la refactorización + migración de datos.

## Sesión 2026-06-14 — Refactor BD ejecutado (en schema `qc`, sin tocar `dbo`)

### Hecho
- Backup read-only de los datos actuales → `db-backup-data.json` (password_hash enmascarado).
- Runner de migraciones `db/run-migrations.mjs` + `db/migrations/`:
  - `0001_qc_schema.sql`: esquema destino completo en schema **`qc`** (28 tablas, 43 FKs, 19 CHECKs). `dbo` legacy intacto (8 tablas) → app sigue viva, **cero downtime**.
  - `0002_seed_catalogs_blueberry.sql`: commodities consolidados (6), aliases, destinos/clientes/embalajes, **23 defectos** canónicos de arándano, estándar FTF + **76 bandas de tolerancia**, bandas calibre/color/firmeza, plantilla v1.
  - `0003_backfill.sql`: migración+limpieza dbo→qc. Validado: id2→cancelada, insp1↔assign3, métricas JSON→49 filas tipadas (vacíos descartados), 24+2 fotos, 0 huérfanos.
- Fix aplicado en backfill: collation `BIN2` de OPENJSON re-collada a DATABASE_DEFAULT.

### Estado
- **Construcción greenfield + migración COMPLETA y validada en `qc`.** La app de producción (dbo) no fue tocada.
- Pendiente: Fase 4 trazabilidad activa (temporal tables/System-Versioning — additive), Fase 5 adaptación del backend a `qc` (grande), Fase 6 cutover dbo↔qc + drop legacy (destructivo, requiere confirmación).

## Sesión 2026-06-14 — Fase 4 + Fase 5 (parcial)

### Fase 4 (trazabilidad activa) ✅
- `0004_versioning.sql`: System-Versioning ON en qc.users/assignments/inspections/inspection_measurements (+ _History). measurements: FK a inspections cambiada de CASCADE a NO_ACTION (requisito de temporal + soft-delete).

### Fase 5 (backend → qc) — slice del inspector hecho
- Diseñada alrededor de casos de uso + manejo de errores explícito (feedback del usuario).
- `mssql.js`: fix DB-36 (DB_*||AZURE_SQL_*), `withTransaction(fn,{actorId})` (set session_context para auditoría), `txRequest`, `appError`.
- Repos nuevos: `catalog.js` (commodities/templates/defects/find-or-create lot/pallet/producer), `results.js` (cómputo score/resolución/causal desde tolerancias), `inspections.js` (create transaccional + detail + list).
- Rutas reescritas a qc con manejo de errores (cliente 4xx vs server 5xx, sin filtrar): `commodities`, `metric-templates/code/[code]`, `inspecciones` POST/GET, `completadas`, `asignadas`, `[id]` GET/PUT.
- Crear inspección: traduce metrics JSON→mediciones tipadas, fotos con allowlist SSRF, find-or-create lote/pallet/productor, computa resultados, versión PDF PENDING, cierra assignment, audita — todo en 1 transacción.
- Validado: `compute-results.mjs` calculó+backfilleó inspection_results de las 3 inspecciones (build `npm run build` OK).

### Fase 5 COMPLETA + smoke test 15/15 (2026-06-14)
- Migradas TODAS las rutas que tocan BD a qc con repos (`auth`/`users`, `catalog`, `assignments`, `templates`, `inspections`, `results`) + transacciones + manejo de errores cliente/servidor.
- auth/login + auth/me → qc.users; users CRUD con soft-delete; historial/pendientes/asignar; metrics edit; PDF (generar/get) versionado; google-sheets load/add-row/sync → qc.
- `inspecciones/[id]/asignar` deprecado (410); ops/inspecciones → listByCreator.
- Config arreglada: JWT_SECRET creado en .env.local; AZURE_SQL_DATABASE corregido transportes→fruticola_2026 (DB-36). .env.example creado.
- **Smoke test (db/smoke-test.mjs) contra dev server: 15/15 OK** — login, commodities, template-desde-defects (23), crear inspección transaccional (ignora key desconocida, bloquea foto SSRF), detalle+resultado computado, RBAC 403, 404, historial admin, users, assignments. Inspección de prueba soft-deleted.

### Histórico — PENDIENTE Fase 5 (resuelto arriba):
- `auth/login` + `auth/me` (hoy usan `users` = dbo; mover a qc.users). **Además falta `JWT_SECRET` en .env.local → la auth no funciona hasta setearlo.**
- Admin: `inspecciones/historial` (vista), `pendientes`/`asignar`/`assignments/*`, `users/*`, `metric-templates` POST/[id]/fields, `google-sheets/*`, `ops/inspecciones`, `[id]/metrics`, `[id]/generar-pdf` (+ generador PDF lee measurements), `[id]/pdf`.
- Hoja por revisar: tolerancias de `contamination` (Qima) muy estrictas → todo queda 'rejected'.

### Archivos refactor
- `db/run-migrations.mjs`, `db/migrations/0001..0003`, `.planning/.../db-backup.mjs`, `db-backup-data.json`, `DB-REFACTOR-PLAN.md`

### Archivos auditoría
- `.planning/2026-06-13-backend-db-refactor/db-audit.mjs`, `db-sample.mjs`, `db-introspection.json`, `db-sample.json`, `db-audit-findings.md`

### Archivos Fase 1
- Nuevos: `src/lib/json.js`
- Editados: `middleware.js`, `next.config.mjs`, `package.json`, `src/app/api/auth/login/route.js`, `src/lib/auth/verifyToken.js` (sin fallback), `src/app/api/metric-templates/route.js`, `src/app/api/metric-templates/[id]/route.js`, `src/app/api/metric-templates/[id]/fields/route.js`, `src/app/api/inspecciones/route.js`, `src/app/api/inspecciones/[id]/route.js`, `src/app/api/inspecciones/[id]/generar-pdf/route.js`, `src/app/api/inspecciones/[id]/asignar/route.js`, `src/app/api/ops/inspecciones/route.js`, `src/app/api/commodities/[code]/template/route.js`, `src/app/api/metric-templates/code/[code]/route.js`
- Borrado: `src/lib/auth/verifyTokenFromCookies.js`

## Sesión 2026-06-14 — Frontend: design system + PDF rediseñado
- Sistema de diseño: tokens verde enterprise en globals.css (Tailwind v4 @theme) + librería `@/components/ui` (Button, Card, Badge/Resolution/Status/Pdf, StatCard, Avatar, form, Table, Modal, Toast, Tabs, feedback). Styleguide en `/ui-kit`. ToastProvider en layout.
- PDF (lib/pdf/generator.js) REESCRITO estilo Power BI, en INGLÉS, 6 págs: pág1 resumen ejecutivo (gauge de score por resolución, KPIs, donut "defects by band", quality vs condition, top defects bars, score trend); pág2 tablas Quality/Condition con chip de banda + tolerancia + header measurements; págs siguientes = photo evidence. buildPdfInput extendido (results + banda por defecto + distribuciones + trend). Verificado renderizando a PNG.
- Fix: footer del PDF se llamaba múltiples veces (se superponía "of 8"); ahora una sola vez.
- ⚠️ PENDIENTE CONFIG: Cloudinary NO está en .env.local (CLOUDINARY_API_KEY/SECRET, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) → generar-pdf genera OK pero falla al SUBIR ("Must supply api_key"). El usuario debe cargar esas vars para el flujo real de subida/almacenamiento de PDF y fotos.
- PENDIENTE frontend: ensamblar app-shell + dashboard + migrar pantallas admin/inspector a los componentes nuevos; rediseñar login; flujo mobile inspector.
