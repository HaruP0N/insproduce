# Findings — Revisión exhaustiva Backend + BD (insproduce)

> Revisión hecha con la skill **code-review-expert** (severidades P0–P3) + checklists `security`, `solid`, `code-quality`, `removal`. Alcance: todo `src/app/api/**`, `src/lib/**`, `middleware.js`, `next.config.mjs`, `base_fruticola.sql`. Working tree limpio (sin diff), por eso se auditó el árbol completo, no un PR.

## Resumen
- **Archivos revisados:** ~45 (middleware, auth, capa DB, ~40 rutas API, libs PDF/Cloudinary/Sheets, generador, templates).
- **Veredicto:** **REQUEST_CHANGES** — hay control de acceso roto (IDOR) y un fallback de secreto JWT explotable.
- **Conteo:** P0: 3 · P1: 5 · P2: 7 · P3: 5

---

## P0 — Crítico (bloquea merge)

### P0-1 · IDOR de escritura: cualquier autenticado edita métricas de cualquier inspección
`src/app/api/inspecciones/[id]/metrics/route.js:5-8` — solo valida `v.ok`; sin rol ni propiedad. Un inspector puede `PUT /api/inspecciones/<id>/metrics` y sobrescribir datos de calidad de cualquier inspección (e invalida su PDF). **Categoría:** Broken Access Control / IDOR.
**Fix:** exigir `admin` o propiedad (`created_by_user_id`/`assigned_to_user_id`) vía helper `requireAuth`.

### P0-2 · Fallback de secreto JWT hardcodeado
`src/lib/auth/verifyToken.js:4` y `verifyTokenFromCookies.js:4`: `process.env.JWT_SECRET || 'tu-secreto-super-seguro-cambiar-en-produccion'`. Si falta la env var, los tokens se verifican (y se pueden **forjar**) con un secreto público → suplantación de admin. Login/middleware sí exigen la var; estos verificadores no (inconsistente).
**Fix:** lanzar error si falta `JWT_SECRET`; no usar literal.

### P0-3 · Deriva de esquema: el SQL versionado no puede recrear la BD
El código depende de objetos ausentes en `base_fruticola.sql`: `inspections.brix_min/max/moda`, `diameter_min/max`, `header_photos`; `inspection_photos.metric_key`; `assignments.commodity_code`; vista `vw_inspections_admin`. **Categoría:** Data integrity / mantenibilidad.
**Fix:** extraer esquema real, versionarlo, introducir migraciones.

---

## P1 — Alto (arreglar antes de merge)

### P1-1 · IDOR de lectura (inspección / PDF / asignación con PII)
Solo `v.ok`, sin propiedad: `inspecciones/[id]/route.js:14` (GET), `inspecciones/[id]/pdf/route.js:7`, `inspecciones/[id]/generar-pdf/route.js:14`, `assignments/[id]/route.js:8` (expone email del inspector). Un inspector itera ids y lee todo.
**Fix:** mismo helper de propiedad/rol.

### P1-2 · Bug `v.payload` → endpoints admin siempre 403 (funcionalidad muerta)
Los verificadores devuelven `{ ok, user }`, no `{ payload }`. `v.payload?.role` es `undefined` → 403 a todos. Afecta: `metric-templates/route.js:9`, `metric-templates/[id]/route.js:26,79`, `metric-templates/[id]/fields/route.js:10`, `inspecciones/[id]/asignar/route.js:9`, `ops/inspecciones/route.js:9,13` (además `myId = NaN`). **Gestión de templates inutilizable por API.**
**Fix:** `v.user.role` (o helper único).

### P1-3 · Doble mecanismo de auth (cookie vs Bearer) + token en localStorage
3 rutas exigen `Authorization: Bearer` (`verifyTokenFromRequest`): `inspecciones/route.js`, `commodities/[code]/template/route.js`, `metric-templates/route.js`. El resto usa cookie. El token vive en `localStorage` (`clientToken.js`) y se manda como Bearer → **anula `httpOnly`** (robo por XSS). El CSP permite `'unsafe-inline'`/`'unsafe-eval'` (`next.config.mjs:34`), debilitando la mitigación.
**Fix:** un solo mecanismo (cookie `httpOnly`); eliminar token de localStorage; CSP sin `unsafe-*` en `script-src`.

### P1-4 · SSRF en generación de PDF
`POST /api/inspecciones` guarda `photos[*].url` sin validar; `generator.js:341 downloadImageAsBase64()` hace `fetch(url)` server-side con host/protocolo controlables y embebe la respuesta como base64 en el PDF descargable → lectura de servicios internos.
**Fix:** allowlist de dominio (Cloudinary) en creación y antes del fetch.

### P1-5 · Dos modelos paralelos de asignación (divergent change)
`ops/inspecciones` usa `inspections.assigned_to_user_id`; `asignadas`/`pendientes` usan la tabla `assignments`. Dos sistemas sin sincronía → estado inconsistente.
**Fix:** elegir un modelo canónico (recomendado: `assignments` como cola, `inspections` como resultado).

---

## P2 — Medio (smells / mantenibilidad)

- **P2-1 · Shotgun surgery en auth:** el bloque `verifyTokenFrom…` + chequeo de rol se repite en **31 archivos**. Cambiar la política toca decenas de archivos. → helper `requireAuth(req,{role,ownership})`.
- **P2-2 · DRY (inserción de fields):** bloque `INSERT INTO metric_fields` duplicado en `metric-templates/route.js` y `[id]/fields/route.js`. → extraer `replaceTemplateFields()`.
- **P2-3 · DRY (helpers JSON):** `safeJson/safeJsonParse/safeJsonArray` duplicados en 5 rutas. → `src/lib/json.js`.
- **P2-4 · N+1 queries:** `google-sheets/sync/route.js` y `load/route.js` ejecutan una query por fila dentro de `for`. → batch / `IN (...)`.
- **P2-5 · Doble fuente de verdad de commodity:** `asignar`/`sync` guardan en `notes_admin` (`"Commodity: X"`); `add-row`/`load`/`pendientes`/`asignadas` usan `assignments.commodity_code`. → unificar en columna.
- **P2-6 · Fuga de errores al cliente:** `'Error: ' + e.message` en ~15 rutas expone errores de BD. → mensaje genérico + log server.
- **P2-7 · Dos libs de hash:** `bcrypt` (login) y `bcryptjs` (users). → unificar en `bcryptjs` (sin binarios nativos, mejor para serverless).

## P3 — Bajo

- **P3-1 · Archivo huérfano:** `src/lib/auth/verifyTokenFromCookies.js` no se importa en ningún lado → borrar.
- **P3-2 · Endpoint duplicado:** `commodities/[code]/template` ≈ `metric-templates/code/[code]` (auth distinta) → consolidar.
- **P3-3 · Stubs muertos:** `google-sheets/config` POST devuelve "guardada" sin persistir; `last-sync` siempre `null`.
- **P3-4 · Middleware desalineado:** protege `/ops` (inexistente); el inspector vive en `/inspector`, no protegido en el edge.
- **P3-5 · README template** de create-next-app; sin variables de entorno documentadas.

---

## Removal candidates (skill: removal-plan)
| Item | Ubicación | Acción | Evidencia |
|---|---|---|---|
| `verifyTokenFromCookies.js` | `src/lib/auth/` | **Borrar ya** | 0 imports |
| Ruta `commodities/[code]/template` | `src/app/api/commodities/[code]/template/route.js` | Diferir (migrar cliente a `metric-templates/code/[code]`) | duplicado |
| Token en localStorage (`clientToken.js` + Bearer) | varios | Diferir (Fase 1, pasar a cookie-only) | seguridad |
| Stubs `config POST` / `last-sync` | google-sheets | Diferir (implementar o quitar) | no-op |
