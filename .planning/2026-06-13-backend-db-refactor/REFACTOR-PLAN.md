# Refactor Backend + BD — Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Plan escrito con la skill **writing-plans**. Hallazgos de origen en `findings.md` (IDs P0-x/P1-x).

**Goal:** Cerrar las vulnerabilidades de control de acceso y JWT, eliminar bugs/deuda del backend y reconciliar el esquema de BD, sin tocar el frontend.

**Architecture:** Next.js 16 App Router (route handlers en `src/app/api/**`), SQL Server vía `mssql` (`src/lib/db/mssql.js`), auth JWT por cookie `httpOnly`. Se introduce una capa de auth centralizada (`requireAuth`) y utilidades compartidas para eliminar la repetición en 31 rutas.

**Tech Stack:** Next 16, React 19, `jsonwebtoken`/`jose`, `mssql`, `bcryptjs`.

> **Nota de testing:** el repo no tiene framework de tests. La verificación de cada tarea es `npm run build` (no debe romper) + prueba manual con `curl` contra `npm run dev`. Añadir Vitest es opcional y queda fuera de alcance (YAGNI).

---

## File Structure (decisiones de descomposición)

- **Crear** `src/lib/auth/requireAuth.js` — única puerta de authN+authZ (rol + propiedad). Reemplaza el bloque repetido en 31 rutas.
- **Crear** `src/lib/json.js` — `safeJson(value, fallback)` compartido (hoy duplicado en 5 rutas, P2-3).
- **Crear** `src/lib/http.js` — `fail(status, msg)` / `ok(data)` para respuestas y para no filtrar `e.message` (P2-6).
- **Crear** `src/lib/security/photoUrls.js` — allowlist de dominios para URLs de fotos (P1-4).
- **Modificar** las rutas API para usar `requireAuth`.
- **Borrar** `src/lib/auth/verifyTokenFromCookies.js` (huérfano, P3-1).

---

## FASE 0 — Seguridad crítica

### Task 0.1: Eliminar el fallback de secreto JWT (P0-2)

**Files:**
- Modify: `src/lib/auth/verifyToken.js`

- [ ] **Step 1: Reemplazar el literal por lectura estricta de env**

En `src/lib/auth/verifyToken.js`, sustituir la línea 4:
```js
const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro-cambiar-en-produccion'
```
por:
```js
function getSecret() {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET no configurado')
  return s
}
```
y usar `jwt.verify(token, getSecret())` en ambas funciones (`verifyTokenFromCookies`, `verifyTokenFromRequest`). En el `catch`, si el mensaje es `'JWT_SECRET no configurado'` devolver `{ ok:false, msg:'Error de configuración', status:500 }`.

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Commit**
```bash
git add src/lib/auth/verifyToken.js
git commit -m "fix(auth): eliminar fallback de secreto JWT (P0-2)"
```

### Task 0.2: Helper `requireAuth` centralizado

**Files:**
- Create: `src/lib/auth/requireAuth.js`
- Create: `src/lib/http.js`

- [ ] **Step 1: Crear `src/lib/http.js`**
```js
import { NextResponse } from 'next/server'
export const fail = (status, msg) => NextResponse.json({ msg }, { status })
export const ok = (data, status = 200) => NextResponse.json(data, { status })
// Para catch: loguea el detalle, no lo expone al cliente
export function serverError(scope, e) {
  console.error(`[${scope}]`, e)
  return fail(500, 'Error interno')
}
```

- [ ] **Step 2: Crear `src/lib/auth/requireAuth.js`**
```js
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { fail } from '@/lib/http'

/**
 * Autentica por cookie y opcionalmente exige rol.
 * @returns {{ user }} si ok, o { response } con el error a retornar.
 */
export function requireAuth(req, { role } = {}) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok || !v.user) return { response: fail(v.status || 401, v.msg || 'No autenticado') }
  if (role && v.user.role !== role) return { response: fail(403, `Requiere rol ${role}`) }
  return { user: v.user }
}

/**
 * Verifica que el usuario sea admin o dueño del recurso.
 * ownerIds: array de ids de usuario que "poseen" el recurso (created_by/assigned_to).
 */
export function authorizeOwnership(user, ownerIds = []) {
  if (user.role === 'admin') return true
  return ownerIds.filter(Boolean).map(Number).includes(Number(user.id))
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: compila.

- [ ] **Step 4: Commit**
```bash
git add src/lib/http.js src/lib/auth/requireAuth.js
git commit -m "feat(auth): helper requireAuth + utilidades http (P2-1)"
```

### Task 0.3: Cerrar IDOR de escritura en métricas (P0-1)

**Files:**
- Modify: `src/app/api/inspecciones/[id]/metrics/route.js`

- [ ] **Step 1: Exigir admin o propiedad antes de actualizar**

Al inicio del `PUT`, reemplazar el chequeo `if (!v.ok)` por:
```js
import { requireAuth, authorizeOwnership } from '@/lib/auth/requireAuth'
import { fail, ok, serverError } from '@/lib/http'
// ...
const auth = requireAuth(req)
if (auth.response) return auth.response
const { user } = auth
```
Antes del `UPDATE inspections`, cargar dueños y autorizar:
```js
const own = await query(
  `SELECT created_by_user_id, assigned_to_user_id FROM inspections WHERE id=@id`, { id }
)
if (!own.recordset?.length) return fail(404, 'Inspección no encontrada')
const r = own.recordset[0]
if (!authorizeOwnership(user, [r.created_by_user_id, r.assigned_to_user_id]))
  return fail(403, 'Sin permiso sobre esta inspección')
```

- [ ] **Step 2: Verificar manualmente**

Run: `npm run dev` y con una cookie de inspector A:
```bash
curl -i -X PUT "http://localhost:3000/api/inspecciones/<id_de_otro>/metrics" \
  -H 'Content-Type: application/json' --cookie 'token=<jwt_inspectorA>' \
  -d '{"values":{"x":1}}'
```
Expected: `403`. Con su propia inspección o admin: `200`.

- [ ] **Step 3: Commit**
```bash
git add src/app/api/inspecciones/[id]/metrics/route.js
git commit -m "fix(authz): cerrar IDOR de escritura en metrics (P0-1)"
```

### Task 0.4: Cerrar IDOR de lectura (P1-1)

**Files:**
- Modify: `src/app/api/inspecciones/[id]/route.js` (GET)
- Modify: `src/app/api/inspecciones/[id]/pdf/route.js` (GET)
- Modify: `src/app/api/inspecciones/[id]/generar-pdf/route.js` (POST)
- Modify: `src/app/api/assignments/[id]/route.js` (GET)

- [ ] **Step 1:** En cada handler, tras `requireAuth`, cargar los `ownerIds` del recurso y aplicar `authorizeOwnership` igual que en Task 0.3 (admin pasa siempre). Para `assignments/[id]` el dueño es `user_id`.

- [ ] **Step 2: Verificar** con `curl` que un inspector NO puede leer un id ajeno (403) y sí el propio (200).

- [ ] **Step 3: Commit**
```bash
git add src/app/api/inspecciones/[id]/route.js src/app/api/inspecciones/[id]/pdf/route.js src/app/api/inspecciones/[id]/generar-pdf/route.js src/app/api/assignments/[id]/route.js
git commit -m "fix(authz): cerrar IDOR de lectura inspección/pdf/asignación (P1-1)"
```

### Task 0.5: Validar URLs de fotos contra allowlist (P1-4 SSRF)

**Files:**
- Create: `src/lib/security/photoUrls.js`
- Modify: `src/app/api/inspecciones/route.js` (POST, al guardar `photos`)
- Modify: `src/lib/pdf/generator.js` (`downloadImageAsBase64`)

- [ ] **Step 1: Crear allowlist**
```js
// src/lib/security/photoUrls.js
const ALLOWED_HOSTS = ['res.cloudinary.com'] // ampliar según cuenta Cloudinary
export function isAllowedPhotoUrl(u) {
  try {
    const url = new URL(u)
    return url.protocol === 'https:' && ALLOWED_HOSTS.includes(url.hostname)
  } catch { return false }
}
```

- [ ] **Step 2:** En `POST /api/inspecciones`, antes de insertar cada foto, `if (!isAllowedPhotoUrl(url)) continue` (o rechazar 400). En `downloadImageAsBase64`, `if (!isAllowedPhotoUrl(url)) return null` antes del `fetch`.

- [ ] **Step 3: Verificar** que una URL `http://169.254.169.254/...` es rechazada y una de Cloudinary se acepta.

- [ ] **Step 4: Commit**
```bash
git add src/lib/security/photoUrls.js src/app/api/inspecciones/route.js src/lib/pdf/generator.js
git commit -m "fix(ssrf): allowlist de dominios para URLs de fotos (P1-4)"
```

---

## FASE 1 — Consolidar auth + limpiar muerto

### Task 1.1: Migrar todas las rutas a `requireAuth` y arreglar `v.payload` (P1-2, P2-1)
- [ ] Reemplazar en las 31 rutas el bloque `verifyTokenFrom…` + chequeo de rol por `const auth = requireAuth(req, { role:'admin' })` (o sin role). Esto **elimina de raíz** los bugs `v.payload?.role` (siempre quedaban en 403).
- [ ] Rutas afectadas por el bug `v.payload`: `metric-templates/route.js`, `metric-templates/[id]/route.js`, `metric-templates/[id]/fields/route.js`, `inspecciones/[id]/asignar/route.js`, `ops/inspecciones/route.js`.
- [ ] Verificar: como admin, crear/editar un metric-template ahora responde 200 (antes 403).
- [ ] Commit: `refactor(auth): centralizar authz en requireAuth; fix v.payload (P1-2, P2-1)`.

### Task 1.2: Cookie httpOnly como único mecanismo (P1-3)
- [ ] Migrar las 3 rutas Bearer (`inspecciones/route.js`, `commodities/[code]/template`, `metric-templates/route.js`) a `requireAuth` (cookie).
- [ ] En el front (cuando se toque): dejar de guardar token en `localStorage`; el login ya setea la cookie. Eliminar `Authorization: Bearer` de `useFormularioInspeccion.js`.
- [ ] Borrar `src/lib/auth/clientToken.js` y el retorno de `token` en el body de `login`.
- [ ] Commit: `refactor(auth): cookie httpOnly como único token; quitar localStorage (P1-3)`.

### Task 1.3: Limpieza (P3-1, P2-7, P3-4, P2-3, P2-2)
- [ ] Borrar `src/lib/auth/verifyTokenFromCookies.js` (huérfano).
- [ ] Unificar hash en `bcryptjs`; quitar `bcrypt` de `package.json`.
- [ ] `middleware.js`: cambiar matcher `/ops` → `/inspector`.
- [ ] Extraer `safeJson` a `src/lib/json.js` y reemplazar las 5 copias.
- [ ] Extraer `replaceTemplateFields()` y usarlo en `metric-templates/route.js` y `[id]/fields/route.js`.
- [ ] Reemplazar `'Error: ' + e.message` por `serverError(scope, e)` (P2-6).
- [ ] Commit por sub-paso.

### Task 1.4: Endurecer CSP (P1-3)
- [ ] En `next.config.mjs`, quitar `'unsafe-eval'` y, si la app lo tolera, `'unsafe-inline'` de `script-src` (validar que Next no lo requiera; si lo requiere, usar nonces).
- [ ] Verificar que la app carga sin errores de consola.
- [ ] Commit: `hardening(csp): endurecer script-src`.

---

## FASE 2 — Reconciliar la base de datos (requiere acceso a BD real)

### Task 2.1: Dump del esquema real (P0-3) — PRIMERA tarea, bloqueante
- [ ] Con credenciales de la BD, exportar el esquema completo (tablas, columnas reales incl. `brix_*`, `diameter_*`, `header_photos`, `inspection_photos.metric_key`, `assignments.commodity_code`, vista `vw_inspections_admin`) a `db/schema.sql`.
- [ ] Reemplazar/retirar `base_fruticola.sql` por `db/schema.sql` versionado.
- [ ] Commit: `chore(db): esquema real versionado (P0-3)`.

### Task 2.2–2.4 (outline)
- [ ] Carpeta `db/migrations/NNNN_*.sql` numerada; documentar cómo aplicarlas.
- [ ] Unificar `commodity_code` en `assignments` y migrar datos desde `notes_admin` (P2-5).
- [ ] Decidir modelo único de asignación (`assignments` cola → `inspections` resultado) (P1-5).
- [ ] `.env.example` con `DB_*`, `JWT_SECRET`, `CLOUDINARY_*`, `GOOGLE_*` (P3-5).

---

## FASE 3 — Modelo de datos QC (separable; ver memoria `fruticola-qc-domain`)

- [ ] Tablas `standards/destinations`, `metric_tolerances` (5 bandas por defecto/destino), `inspection_pallets`.
- [ ] Campo `group` (calidad/condición/totals) en `metric_fields`.
- [ ] Cálculo server-side de Score / Resolución / defecto causal a partir de tolerancias.
- [ ] Seeds desde el estándar Qima/FTF.

---

## Self-Review
- **Cobertura:** cada P0/P1 de `findings.md` tiene tarea (P0-1→0.3, P0-2→0.1, P0-3→2.1, P1-1→0.4, P1-2→1.1, P1-3→1.2/1.4, P1-4→0.5, P1-5→2.x). P2/P3 en 1.3 / 2.x.
- **Dependencias:** Fase 2/3 bloqueadas por acceso a la BD real (Task 2.1).
- **Riesgo:** Task 1.2 (quitar localStorage) toca el front; coordinar aunque el alcance sea back — dejar la cookie funcionando antes de quitar el Bearer.
