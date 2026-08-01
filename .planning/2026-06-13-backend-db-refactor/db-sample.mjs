// Muestreo de datos reales para auditar normalización/calidad. No expone password_hash.
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
  server: env.AZURE_SQL_SERVER, database: process.argv[2] || env.AZURE_SQL_DATABASE,
  user: env.AZURE_SQL_USER, password: env.AZURE_SQL_PASSWORD, port: 1433,
  options: { encrypt: true, trustServerCertificate: false }, connectionTimeout: 30000, requestTimeout: 60000,
}
const main = async () => {
  const pool = await sql.connect(config)
  const q = async (sqlText) => (await pool.request().query(sqlText)).recordset
  const out = {}
  out.users = await q(`SELECT id, name, email, role, CAST(active AS int) active, created_at FROM users`)
  out.commodities = await q(`SELECT id, code, name, CAST(active AS int) active FROM commodities`)
  out.metric_templates = await q(`SELECT id, commodity_id, commodity_code, version, name, CAST(active AS int) active FROM metric_templates`)
  out.metric_fields_sample = await q(`SELECT TOP 12 template_id, [key], label, field_type, required, unit, min_value, max_value FROM metric_fields ORDER BY template_id, order_index`)
  out.metric_fields_keys = await q(`SELECT DISTINCT [key] FROM metric_fields ORDER BY [key]`)
  out.assignments = await q(`SELECT id, user_id, producer, lot, variety, status, commodity_code, notes_admin FROM assignments`)
  out.inspections = await q(`SELECT id, commodity_id, created_by_user_id, assigned_to_user_id, producer, lot, variety, caliber, brix_avg, brix_min, brix_max, brix_moda, diameter_min, diameter_max, temp_pulp, net_weight, metrics, header_photos FROM inspections`)
  out.photos = await q(`SELECT id, inspection_id, metric_key, label, LEFT(url, 60) AS url_head FROM inspection_photos ORDER BY inspection_id`)
  out.pdfs = await q(`SELECT inspection_id, status, pdf_hash, LEFT(pdf_url,60) AS url_head FROM inspection_pdfs`)
  await pool.close()
  writeFileSync(resolve(__dirname, 'db-sample.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
