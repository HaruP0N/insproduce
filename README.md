# Fruitbrix Field — captura y gestión de inspecciones QC

App operativa del control de calidad frutícola (Family Tree Farms / berries). Los
inspectores capturan inspecciones en terreno desde el celular (métricas por plantilla,
fotos a Cloudinary) y el admin gestiona asignaciones, arribos por contenedor, tolerancias
y reportes PDF. Es la plataforma hermana de **Fruitbrix Sentry**, que consolida los Excel
y vigila las alertas post-cosecha.

Next.js 16 (App Router) + React 19 + Azure SQL (esquema `qc`).

## Correr en local

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # verificación principal (no hay suite de tests)
node db/run-migrations.mjs fruticola_2026   # aplica db/migrations/*.sql (idempotente)
```

Credenciales de desarrollo en `db/seed-users.mjs`. Las variables van en `.env.local`
(ver `.env.example`): `DB_*`, `JWT_SECRET` (obligatoria), `CLOUDINARY_*` y, opcionalmente,
las de Google Sheets.

## Qué incluye

- **Inspector** (móvil): cola de asignadas → captura guiada por plantilla → completadas.
- **Admin**: dashboard, inspecciones, carga masiva desde Excel, arribos por contenedor,
  asignaciones, lotes, reportes, commodities, tolerancias, plantillas, usuarios.
- **Motor de score**: bandas por defecto y por sumas de familia; resolución
  `approved / conditional / rejected` según el estándar elegido (FTF Destino, QIMA,
  Origen RR/FTF/Premium, Destino FTF v1.2).
- **PDF de inspección** con KPIs, distribución de bandas, notas automáticas y fotos.

Despliegue en Vercel + Azure SQL: ver [DEPLOY.md](DEPLOY.md).
