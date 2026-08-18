# Deploy QA — Vercel + Azure SQL

La app corre en Vercel (Next.js) contra la base Azure SQL existente (`fruticola_2026`).
Las migraciones se aplican desde tu máquina con `node db/run-migrations.mjs fruticola_2026`
(ya están todas aplicadas hasta la 0011).

## 1. Azure — permitir que Vercel llegue a la base (1 vez)

Portal de Azure → SQL Server **fruticola** → **Networking**:
- En "Exceptions", marcar **"Allow Azure services and resources to access this server"** → Save.
  (Vercel no tiene IP fija; sin esto las funciones serverless no conectan.)

## 2. Vercel — importar y configurar

1. [vercel.com](https://vercel.com) → **Add New → Project** → importar `HaruP0N/insproduce`
   (framework: Next.js, sin cambios de build).
2. **Settings → Environment Variables** — copiar estos valores desde tu `.env.local`
   (los nombres deben quedar EXACTOS):

   | Variable | Nota |
   |---|---|
   | `DB_SERVER` | fruticola.database.windows.net |
   | `DB_DATABASE` | fruticola_2026 |
   | `DB_USER` / `DB_PASSWORD` | credenciales SQL |
   | `DB_PORT` | 1433 |
   | `DB_ENCRYPT` | true |
   | `DB_TRUST_CERT` | false |
   | `JWT_SECRET` | obligatoria — sin ella el login devuelve 500 |
   | `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | fotos y PDFs |
   | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | idem |
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `GOOGLE_SHEET_ID` | opcional (integración Sheets) |

   Para `GOOGLE_PRIVATE_KEY`: pegarla tal cual está en `.env.local` (con los `\n`).
3. **Deploy**. La URL resultante es el ambiente QA.

## 3. Verificación post-deploy (2 minutos)

1. `https://<tu-app>.vercel.app/api/health/db` → debe responder OK (prueba la conexión a Azure).
2. Login con `admin@insproduce.cl` → dashboard con las inspecciones reales.
3. Crear una inspección de prueba en **Inspecciones → + Nueva inspección** y borrarla.

## Notas

- Cada push a `main` en GitHub redespliega automáticamente.
- Las migraciones NO corren en Vercel: siempre `node db/run-migrations.mjs fruticola_2026`
  desde local antes de pushear código que dependa de un schema nuevo.
- Si la conexión falla con timeout: revisar el paso 1 (firewall) primero.
