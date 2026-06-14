// Runner de migraciones SQL para fruticola_2026 (Azure SQL).
// Aplica db/migrations/*.sql en orden alfabético, una sola vez (registra en dbo.schema_migrations).
// Divide cada archivo por separadores `GO` (en su propia línea). Lee credenciales de .env.local.
// Uso: node db/run-migrations.mjs [database]
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, basename } from 'node:path'
import sql from 'mssql'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const env = {}
for (const l of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const pick = (...k) => k.map(x => env[x]).find(Boolean)
const config = {
  server: pick('DB_SERVER', 'AZURE_SQL_SERVER'),
  database: process.argv[2] || pick('DB_DATABASE', 'AZURE_SQL_DATABASE') || 'fruticola_2026',
  user: pick('DB_USER', 'AZURE_SQL_USER'),
  password: pick('DB_PASSWORD', 'AZURE_SQL_PASSWORD'),
  port: Number(pick('DB_PORT', 'AZURE_SQL_PORT') || 1433),
  options: { encrypt: true, trustServerCertificate: false },
  connectionTimeout: 30000, requestTimeout: 120000,
}

const splitBatches = (text) =>
  text.split(/^\s*GO\s*$/im).map(s => s.trim()).filter(Boolean)

const main = async () => {
  const pool = await sql.connect(config)
  await pool.request().query(`
    IF OBJECT_ID('dbo.schema_migrations') IS NULL
    CREATE TABLE dbo.schema_migrations (
      id VARCHAR(100) NOT NULL CONSTRAINT PK_schema_migrations PRIMARY KEY,
      applied_at DATETIME2(3) NOT NULL CONSTRAINT DF_schema_migrations_at DEFAULT SYSUTCDATETIME()
    )`)
  const applied = new Set((await pool.request().query('SELECT id FROM dbo.schema_migrations')).recordset.map(r => r.id))
  const files = readdirSync(resolve(__dirname, 'migrations')).filter(f => f.endsWith('.sql')).sort()

  for (const f of files) {
    if (applied.has(f)) { console.log('skip   ', f); continue }
    const sqlText = readFileSync(resolve(__dirname, 'migrations', f), 'utf8')
    const batches = splitBatches(sqlText)
    const tx = pool.transaction()
    await tx.begin()
    try {
      for (const b of batches) await new sql.Request(tx).batch(b)
      const ins = new sql.Request(tx); ins.input('id', sql.VarChar(100), f)
      await ins.query('INSERT INTO dbo.schema_migrations (id) VALUES (@id)')
      await tx.commit()
      console.log('applied', f, `(${batches.length} batches)`)
    } catch (e) {
      await tx.rollback()
      console.error('FAILED ', f, '::', e.message)
      process.exit(1)
    }
  }
  await pool.close()
  console.log('done.')
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
