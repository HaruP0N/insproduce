// Cómputo de resultados QC (totales, score, resolución, defecto causal) a partir de
// las mediciones y las tolerancias del estándar vigente. Se ejecuta dentro de la
// misma transacción que la creación/edición de la inspección.
import { txRequest } from '@/lib/db/mssql'

export async function computeAndStoreResults(tx, inspectionId) {
  const m = await txRequest(tx, { id: inspectionId }).query(
    `SELECT mm.defect_id, d.family, d.unit, mm.value_num, i.standard_id
     FROM qc.inspection_measurements mm
     JOIN qc.inspections i ON i.id = mm.inspection_id
     JOIN qc.defects d ON d.id = mm.defect_id
     WHERE mm.inspection_id = @id AND mm.sample_id IS NULL`)
  const rows = m.recordset
  const standardId = rows[0]?.standard_id ?? null

  let tol = []
  if (standardId != null) {
    const t = await txRequest(tx, { s: standardId }).query(
      `SELECT dt.defect_id, d.code AS defect_code, dt.band, dt.min_pct, dt.max_pct
       FROM qc.defect_tolerances dt
       JOIN qc.defects d ON d.id = dt.defect_id
       WHERE dt.standard_id = @s`)
    tol = t.recordset
  }
  const bandFor = (defectId, v) => {
    for (const b of tol) {
      if (b.defect_id !== defectId) continue
      if (v >= Number(b.min_pct) && (b.max_pct == null || v <= Number(b.max_pct))) return b.band
    }
    return null
  }

  let quality = 0, condition = 0, worst = null, causal = null, causalVal = -1
  for (const r of rows) {
    if (r.unit !== '%' || r.value_num == null) continue
    const v = Number(r.value_num)
    if (r.family === 'quality') quality += v
    else if (r.family === 'condition') condition += v
    const band = bandFor(r.defect_id, v)
    if (band == null) continue
    if (worst == null || band > worst || (band === worst && v > causalVal)) {
      worst = band; causal = r.defect_id; causalVal = v
    }
  }
  const total = Math.round((quality + condition) * 100) / 100
  quality = Math.round(quality * 100) / 100
  condition = Math.round(condition * 100) / 100

  // Las SUMAS por familia también se bandan (pseudo-defectos sum_quality /
  // sum_condition / sum_total, migración 0008): en los reportes reales el causal
  // más común es la suma de condición, no un defecto individual.
  for (const [code, v] of [['sum_quality', quality], ['sum_condition', condition], ['sum_total', total]]) {
    const first = tol.find(b => b.defect_code === code)
    if (!first) continue
    const band = bandFor(first.defect_id, v)
    if (band == null) continue
    if (worst == null || band > worst || (band === worst && v > causalVal)) {
      worst = band; causal = first.defect_id; causalVal = v
    }
  }

  const resolution = worst == null ? null : (worst <= 2 ? 'approved' : worst === 3 ? 'conditional' : 'rejected')
  const score = Math.max(0, Math.round((100 - total) * 100) / 100)

  await txRequest(tx, {
    id: inspectionId, q: quality, c: condition, t: total,
    score, res: resolution, worst, causal
  }).query(
    `MERGE qc.inspection_results AS tgt
     USING (SELECT @id AS inspection_id) src ON tgt.inspection_id = src.inspection_id
     WHEN MATCHED THEN UPDATE SET
       quality_total_pct=@q, condition_total_pct=@c, total_defects_pct=@t,
       score=@score, resolution=@res, worst_band=@worst, causal_defect_id=@causal, computed_at=SYSUTCDATETIME()
     WHEN NOT MATCHED THEN INSERT
       (inspection_id, quality_total_pct, condition_total_pct, total_defects_pct, score, resolution, worst_band, causal_defect_id)
       VALUES (@id, @q, @c, @t, @score, @res, @worst, @causal);`)

  return { quality_total_pct: quality, condition_total_pct: condition, total_defects_pct: total, score, resolution, worst_band: worst }
}
