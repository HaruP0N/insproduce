# Task Plan: Refactor Backend + BD (insproduce)

## Goal
Estabilizar el backend y la base de datos de insproduce — cerrar las vulnerabilidades de control de acceso/JWT, eliminar bugs y deuda, y reconciliar el esquema — sin tocar el frontend por ahora.

## Current Phase
TODAS LAS FASES COMPLETAS (0-6). Backend+BD refactorizados y en qc. Backlog menor: seeds de tolerancias de commodities no-arándano; revisar tolerancia contamination; mover secretos a Key Vault para prod; opcional adaptar/limpiar frontend.

## Phases

### Phase 0: Seguridad crítica (P0/P1 de seguridad)
- [x] Eliminar fallback de secreto JWT (P0-2)
- [x] Helper `requireAuth(req,{role,ownership})` centralizado
- [x] Cerrar IDOR de escritura y lectura (P0-1, P1-1)
- [x] Validar URLs de fotos contra allowlist (P1-4 SSRF)
- **Status:** complete

### Phase 1: Consolidar auth + limpiar muerto
- [x] Borrar archivo huérfano `verifyTokenFromCookies.js` (P3-1)
- [x] Migrar rutas rotas (`v.payload`) y de Bearer a `requireAuth` cookie (P1-2)
- [~] Cookie `httpOnly` único mecanismo: **servidor** ya es cookie-only; falta limpieza front (quitar localStorage/Bearer, token del body de login) (P1-3)
- [x] Unificar bcrypt (→ bcryptjs); middleware `/ops`→`/inspector` (P2-7, P3-4)
- [x] Endurecer CSP (sin `unsafe-eval` en producción; `unsafe-inline` se mantiene por requerimiento de Next)
- [x] Deduplicar `safeJson*` en `src/lib/json.js` (P2-3)
- [ ] (diferido) `replaceTemplateFields()` DRY (P2-2); `serverError` sweep de `e.message` (P2-6); migrar las ~22 rutas ya correctas a `requireAuth` (P2-1)
- **Status:** complete (núcleo); polish menor diferido

### Phase 2: Auditoría + Refactor de la base de datos (ampliada por el usuario)
- [x] Acceso a la BD real (Azure SQL `fruticola_2026`; `.env.local` apuntaba mal a `transportes`)
- [x] Introspección de esquema (`db-introspection.json`) + muestreo de datos (`db-sample.json`)
- [x] AUDITORÍA con skill audit-context-building + 5 agentes → `db-audit-findings.md` (P0:7, P1:13, P2:11, P3:4 + config)
- [ ] PLAN de refactor de BD (siguiente)
- [ ] REFACTORIZACIÓN (último): trazabilidad, dominio QC, normalización, saneamiento; migración de datos
- [ ] `.env.example` + fix nombres de variables (`AZURE_SQL_*` vs `DB_*`) (DB-36)
- **Status:** in_progress (auditoría completa)

### Phase 3: Alinear modelo de datos con estándares QC (docs frutícola)
- [x] Tablas pallets/tolerances/standards/destinations (incluidas en el rediseño qc, migración 0001-0002)
- [x] Familia en `defects` + cálculo server-side de Score/Resolución/causal (results.js, validado)
- [x] Seeds desde estándar Qima/FTF (arándano; otros commodities pendientes)
- **Status:** complete (arándano; resto de commodities = backlog de seeds)

### Phase 4: Trazabilidad activa — **complete** (System-Versioning en 4 tablas)

### Phase 5: Backend → qc — **complete y validado** (smoke test 15/15)
- Toda ruta migrada a qc con repos + transacciones + manejo de errores. Auth/login/me → qc.users. JWT_SECRET creado. .env.local corregido (DB fruticola_2026).
- Pendiente menor: seeds de tolerancias de otros commodities; revisar tabla de tolerancias de contamination.

### Phase 6: Cutover + limpieza — **COMPLETE** (2026-06-14, con OK explícito del usuario)
- [x] DROP de las 8 tablas dbo legacy + dbo.vw_inspections_admin (migración 0005)
- [x] Verificado: dbo solo conserva schema_migrations; qc intacto (32 tablas: 28 + 4 _History)
- [x] Smoke test post-cutover 15/15
- **Status:** complete

## Key Questions
1. ¿Se conserva el doble login admin/inspector o se unifica? → afecta Fase 1.
2. ¿Hay acceso a la BD real para el dump (Fase 2)? → bloqueante de Fase 2/3.
3. ¿La Fase 3 (modelo QC) entra en este refactor o se separa? → alcance.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Auditar árbol completo, no diff | Working tree limpio; el objetivo es revisión exhaustiva del backend existente |
| Cookie httpOnly como único token | Elimina superficie XSS de localStorage; ya existe la cookie |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| pdftoppm no instalado (lectura docs) | 1 | `brew install poppler` |

## Notes
- Cada fase es desplegable por separado.
- Fases 2 y 3 dependen del dump de la BD real.
