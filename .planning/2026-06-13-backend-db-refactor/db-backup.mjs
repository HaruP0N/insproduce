// Backup de seguridad (solo lectura) de las 8 tablas de aplicación. Enmascara password_hash.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sql from 'mssql'
const __dirname = dirname(fileURLToPath(import.meta.url))
const env = {}
for (const l of readFileSync(resolve(__dirname, '../../.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const config = {
  server: env.AZURE_SQL_SERVER, database: process.argv[2] || env.AZURE_SQL_DATABASE || 'fruticola_2026',
  user: env.AZURE_SQL_USER, password: env.AZURE_SQL_PASSWORD, port: 1433,
  options: { encrypt: true, trustServerCertificate: false }, connectionTimeout: 30000, requestTimeout: 120000,
}
const TABLES = ['users','commodities','metric_templates','metric_fields','assignments','inspections','inspection_photos','inspection_pdfs']
const main = async () => {
  const pool = await sql.connect(config)
  const out = { _meta: { db: config.database, tables: {} } }
  for (const t of TABLES) {
    const rows = (await pool.request().query(`SELECT * FROM dbo.[${t}]`)).recordset
    if (t === 'users') for (const r of rows) if ('password_hash' in r) r.password_hash = '***MASKED***'
    out[t] = rows
    out._meta.tables[t] = rows.length
  }
  await pool.close()
  writeFileSync(resolve(__dirname, 'db-backup-data.json'), JSON.stringify(out, null, 2))
  console.log('Backup OK ->', JSON.stringify(out._meta.tables))
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
