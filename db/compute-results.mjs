// Calcula qc.inspection_results para inspecciones que aún no lo tienen.
// Réplica de la lógica de src/lib/repos/results.js, para backfill + prueba sobre datos reales.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sql from 'mssql'
const env = {}
for (const l of readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const p = await sql.connect({ server: env.AZURE_SQL_SERVER, database: 'fruticola_2026', user: env.AZURE_SQL_USER, password: env.AZURE_SQL_PASSWORD, port: 1433, options: { encrypt: true, trustServerCertificate: false } })
const q = async (t, par = {}) => { const r = p.request(); for (const [k, v] of Object.entries(par)) r.input(k, v); return (await r.query(t)).recordset }

const ids = (await q(`SELECT i.id FROM qc.inspections i LEFT JOIN qc.inspection_results r ON r.inspection_id=i.id WHERE r.inspection_id IS NULL`)).map(x => x.id)
console.log('Inspecciones sin resultados:', ids)

for (const id of ids) {
  const rows = await q(`SELECT mm.defect_id, d.family, d.unit, mm.value_num, i.standard_id
    FROM qc.inspection_measurements mm JOIN qc.inspections i ON i.id=mm.inspection_id JOIN qc.defects d ON d.id=mm.defect_id
    WHERE mm.inspection_id=@id AND mm.sample_id IS NULL`, { id })
  const standardId = rows[0]?.standard_id ?? null
  const tol = standardId == null ? [] : await q(`SELECT defect_id, band, min_pct, max_pct FROM qc.defect_tolerances WHERE standard_id=@s`, { s: standardId })
  const bandFor = (did, v) => { for (const b of tol) { if (b.defect_id !== did) continue; if (v >= Number(b.min_pct) && (b.max_pct == null || v <= Number(b.max_pct))) return b.band } return null }
  let quality = 0, condition = 0, worst = null, causal = null, causalVal = -1
  for (const r of rows) {
    if (r.unit !== '%' || r.value_num == null) continue
    const v = Number(r.value_num)
    if (r.family === 'quality') quality += v; else if (r.family === 'condition') condition += v
    const band = bandFor(r.defect_id, v)
    if (band == null) continue
    if (worst == null || band > worst || (band === worst && v > causalVal)) { worst = band; causal = r.defect_id; causalVal = v }
  }
  const total = Math.round((quality + condition) * 100) / 100
  quality = Math.round(quality * 100) / 100; condition = Math.round(condition * 100) / 100
  const resolution = worst == null ? null : (worst <= 2 ? 'approved' : worst === 3 ? 'conditional' : 'rejected')
  const score = Math.max(0, Math.round((100 - total) * 100) / 100)
  await q(`INSERT INTO qc.inspection_results (inspection_id, quality_total_pct, condition_total_pct, total_defects_pct, score, resolution, worst_band, causal_defect_id)
           VALUES (@id,@q,@c,@t,@score,@res,@worst,@causal)`,
    { id, q: quality, c: condition, t: total, score, res: resolution, worst, causal })
  const causalCode = causal == null ? '-' : (await q(`SELECT family+'.'+code k FROM qc.defects WHERE id=@d`, { d: causal }))[0].k
  console.log(`insp ${id}: quality=${quality} condition=${condition} total=${total} worstBand=${worst} resolution=${resolution} score=${score} causal=${causalCode}`)
}
await p.close()
