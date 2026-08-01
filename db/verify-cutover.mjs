import { readFileSync } from 'node:fs'
import sql from 'mssql'
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const p = await sql.connect({ server: env.AZURE_SQL_SERVER, database: 'fruticola_2026', user: env.AZURE_SQL_USER, password: env.AZURE_SQL_PASSWORD, port: 1433, options: { encrypt: true, trustServerCertificate: false } })
const q = async (t) => (await p.request().query(t)).recordset
const legacy = ['users', 'commodities', 'metric_templates', 'metric_fields', 'assignments', 'inspections', 'inspection_photos', 'inspection_pdfs']
const dboTables = (await q(`SELECT name FROM sys.tables WHERE schema_id=SCHEMA_ID('dbo') ORDER BY name`)).map(r => r.name)
const dboViews = (await q(`SELECT name FROM sys.views WHERE schema_id=SCHEMA_ID('dbo')`)).map(r => r.name)
const qcCount = (await q(`SELECT COUNT(*) c FROM sys.tables WHERE schema_id=SCHEMA_ID('qc')`))[0].c
const stillLegacy = dboTables.filter(t => legacy.includes(t))
console.log('Legacy dbo restante (debe ser []):', JSON.stringify(stillLegacy))
console.log('dbo.vw_inspections_admin presente:', dboViews.includes('vw_inspections_admin'))
console.log('Tablas dbo que quedan:', JSON.stringify(dboTables))
console.log('Vistas dbo que quedan:', JSON.stringify(dboViews))
console.log('Tablas qc (intactas):', qcCount)
await p.close()
