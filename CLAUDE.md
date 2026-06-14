# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Fruit quality-control (QC) inspection platform for **Family Tree Farms** (blueberries). Next.js 16 (App Router) + React 19 + Tailwind v4, backed by **Azure SQL** (`mssql`). Two roles: `admin` (web dashboard) and `inspector` (field capture). Photos → Cloudinary, optional Google Sheets sync, PDF reports via jsPDF.

## Commands

```bash
npm run dev        # Next dev server (localhost:3000)
npm run build      # production build — THIS IS THE PRIMARY VERIFICATION (there is no test suite)
npm run lint       # eslint

node db/run-migrations.mjs fruticola_2026   # apply db/migrations/*.sql (idempotent)
```

There are **no automated tests**. Verify changes with `npm run build`, and for runtime/DB behavior use the ad-hoc Node scripts in `db/` (e.g. `db/smoke-test.mjs` mints a JWT and exercises the API end-to-end; `db/login-check.mjs`, `db/gen-pdf-test.mjs`). These read `.env.local` directly and connect to the real DB.

Dev login credentials (set via `db/seed-users.mjs`): `admin@insproduce.cl` / `inspector@insproduce.cl`, password `Pass1234`.

## Critical facts (read before touching code)

- **The database schema is `qc`, not `dbo`.** The original flat `dbo` schema was audited, redesigned, migrated, and **dropped** (only `dbo.schema_migrations` remains). Every query must qualify tables as `qc.<table>`. The real database is `fruticola_2026` on Azure SQL.
- **Env var mismatch is handled, not fixed in `.env.local`:** `src/lib/db/mssql.js` reads `DB_*` then falls back to `AZURE_SQL_*` (the `.env.local` uses `AZURE_SQL_*`). `JWT_SECRET` is **required** (no insecure fallback) — without it auth returns 500. `.env.example` documents all vars. **Cloudinary is not configured**, so PDF/photo uploads fail (`Must supply api_key`) until `CLOUDINARY_*` + `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` are added.
- **Stray dev servers** sometimes hold port 3000 across runs — `pkill -9 -f next` before restarting.

## Backend architecture

Routes are thin; data logic lives in a **repository layer**. When adding/changing data behavior, edit the repo, not the route.

- `src/lib/db/mssql.js` — connection pool + `query(text, params)` (always parameterized), `withTransaction(fn, { actorId })` (rolls back on throw; sets `sp_set_session_context` for audit), `txRequest(tx, params)`, and `appError(status, msg)`.
- `src/lib/repos/*` — `catalog`, `inspections`, `assignments`, `templates`, `users`, `results`. Multi-table writes (e.g. creating an inspection = header + measurements + photos + results + pdf row + audit) run inside one `withTransaction`.
- `src/lib/auth/requireAuth.js` — `requireAuth(req, { role })` returns `{ user }` or `{ response }`; `authorizeOwnership(user, ownerIds)` for object-level access (admin OR owner). Every protected route starts with `const auth = requireAuth(...); if (auth.response) return auth.response`. Auth is a **httpOnly cookie JWT** (`src/lib/auth/verifyToken.js`); `middleware.js` guards `/admin` and `/inspector`.
- `src/lib/http.js` — `fail(status,msg)`, `ok(data)`, `serverError(scope,e)`. Error convention: repos `throw appError(status, msg)`; routes `catch (e) { if (e.status) return fail(e.status, e.message); return serverError(scope, e) }` — never leak DB internals to the client.
- `src/lib/repos/results.js` — computes score / resolution / causal defect from `qc.defect_tolerances`. Resolution values in the DB are **English**: `approved | conditional | rejected`.
- **System-Versioning (temporal tables)** is ON for `qc.users/assignments/inspections/inspection_measurements` (history is automatic). Users/assignments/inspections use **soft-delete** (`deleted_at`) — never hard-delete; queries filter `deleted_at IS NULL`.
- Photo URLs are validated against an allowlist (`src/lib/security/photoUrls.js`) on write and before any server-side fetch (anti-SSRF).

### Domain model (qc schema)
`commodities` → `defects` (each has `family`: quality | condition | packaging | measurement) → `metric_templates` + `template_defects`. Tolerances live in `quality_standards` + `defect_tolerances` (5 bands Excellent→Bad per defect/standard) and drive scoring. Work hierarchy: `lots` → `pallets` → `inspections` → `inspection_measurements` (typed rows, **not** a JSON blob) + `inspection_results` + `inspection_photos` + `inspection_pdf_versions`. `assignments` is the work queue. Only blueberry has full tolerances seeded; other commodities have templates but no tolerances yet (their inspections get `resolution = null`).

### Migrations
Schema changes are append-only SQL files in `db/migrations/NNNN_*.sql`, applied by `db/run-migrations.mjs` (splits on `GO`, runs each file once, records in `dbo.schema_migrations`). Add a new numbered file; never edit an applied one. Gotcha: `OPENJSON` output columns are `BIN2` collation — add `COLLATE DATABASE_DEFAULT` when comparing them to schema columns.

## Frontend architecture

The UI is built on the client-approved **prototype design system** in `src/styles/ds.css` (OKLCH tokens, light/dark via `data-theme` on `<html>`, indigo "blueberry" accent, IBM Plex). Shared React pieces live in `src/components/proto/*` (`Icon`, `charts` = Donut/AreaChart/Sparkline/CountUp, `ui` = Sidebar/TopBar/KpiCard/Card/StatusBadge/ScoreCell). Both portals are client SPAs with internal route/tab state:
- **Admin** — `src/components/admin/AdminApp.jsx` (mounted at `/admin`); data via `src/lib/adminData.js`.
- **Inspector** — `src/components/inspector/InspectorApp.jsx` (mounted at `/inspector`): assigned-queue → inline capture (template-driven) → completed; data via `src/lib/inspectorData.js`. Photos upload to Cloudinary via `@/lib/cloudinary` (`PhotoField`).

The only remaining legacy UI is **`PortalLogin`** (`src/components/PortalLogin.js`, mounted at `/` and `/login`) — green-styled, not yet redesigned. The old green Tailwind kit (`src/components/ui/*`, `/ui-kit` styleguide) and the pre-prototype admin/inspector components were removed.

Both data layers (`adminData.js`, `inspectorData.js`) fetch the qc API and map rows to the prototype's shape; `src/lib/proto.js` holds UI constants and the resolution mapping (`mapResolution` translates DB English → Spanish UI labels `aprobado/condicional/rechazado`). The frontend still posts the **legacy payload shape** (metrics keyed `"family.code"`); the backend translates that to the qc model, so the UI didn't need rewriting to switch databases.

Theme is set pre-paint by an inline script in `src/app/layout.js` (reads `localStorage['insp-theme']`, default light) and toggled client-side.

## Project records

`.planning/2026-06-13-backend-db-refactor/` contains the full audit → plan → execution record (`db-audit-findings.md`, `DB-REFACTOR-PLAN.md`, `progress.md`) and is the source of truth for why the schema looks the way it does. The fruit QC standards (tolerances, defect definitions, protocol) come from `~/Desktop/fruticola_docs/` (external). `db/*.mjs` are dev tooling, not application code.
