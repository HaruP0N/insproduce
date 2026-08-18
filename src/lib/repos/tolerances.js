// Repositorio de estándares de calidad y tolerancias (schema qc).
// Las tolerancias (5 bandas por defecto) alimentan el cálculo de score/resolución.
import { query, withTransaction, txRequest, appError } from '@/lib/db/mssql'

export const BANDS = [
  { band: 1, label: 'Excellent' }, { band: 2, label: 'Good' }, { band: 3, label: 'Fair' },
  { band: 4, label: 'Poor' }, { band: 5, label: 'Bad' },
]

/** Lista de estándares con commodity y nº de tolerancias definidas. */
export async function listStandards() {
  const r = await query(
    `SELECT s.id, s.name, s.active, s.updated_at, s.source_doc,
            c.code AS commodity_code, c.name AS commodity_name,
            (SELECT COUNT(DISTINCT t.defect_id) FROM qc.defect_tolerances t WHERE t.standard_id=s.id) AS defects_with_tol
     FROM qc.quality_standards s
     JOIN qc.commodities c ON c.id=s.commodity_id
     ORDER BY c.name ASC, s.name ASC`)
  return r.recordset
}

export async function createStandard({ commodityCode, name }) {
  const code = String(commodityCode || '').trim().toUpperCase()
  const n = String(name || '').trim()
  if (!code || !n) throw appError(400, 'Commodity y nombre son obligatorios')
  const c = await query(`SELECT id FROM qc.commodities WHERE code=@c`, { c: code })
  if (!c.recordset?.length) throw appError(404, `Commodity ${code} no encontrado`)
  const dup = await query(`SELECT 1 FROM qc.quality_standards WHERE commodity_id=@cid AND name=@n`, { cid: c.recordset[0].id, n })
  if (dup.recordset?.length) throw appError(409, 'Ya existe un estándar con ese nombre para el commodity')
  const r = await query(`INSERT INTO qc.quality_standards (name, commodity_id, active, updated_at) OUTPUT INSERTED.id VALUES (@n, @cid, 1, SYSUTCDATETIME())`, { n, cid: c.recordset[0].id })
  return r.recordset[0].id
}

/** Defectos del commodity del estándar + sus 5 bandas (las que falten van en blanco). */
export async function getStandardDetail(standardId) {
  const s = await query(
    `SELECT s.id, s.name, s.active, s.commodity_id, s.updated_at, s.source_doc,
            c.code AS commodity_code, c.name AS commodity_name
     FROM qc.quality_standards s JOIN qc.commodities c ON c.id=s.commodity_id WHERE s.id=@id`, { id: standardId })
  const std = s.recordset?.[0]
  if (!std) throw appError(404, 'Estándar no encontrado')

  const defs = await query(
    `SELECT id, code, label, family, unit, is_major FROM qc.defects
     WHERE commodity_id=@cid AND active=1 ORDER BY family, label`, { cid: std.commodity_id })
  const tol = await query(
    `SELECT defect_id, band, band_label, min_pct, max_pct FROM qc.defect_tolerances WHERE standard_id=@id`, { id: standardId })

  const byDefect = new Map()
  for (const t of tol.recordset) {
    if (!byDefect.has(t.defect_id)) byDefect.set(t.defect_id, {})
    byDefect.get(t.defect_id)[t.band] = { band_label: t.band_label, min_pct: t.min_pct == null ? null : Number(t.min_pct), max_pct: t.max_pct == null ? null : Number(t.max_pct) }
  }
  const defects = defs.recordset.map(d => ({
    defect_id: d.id, code: d.code, label: d.label, family: d.family, unit: d.unit, is_major: !!d.is_major,
    bands: BANDS.map(b => {
      const ex = byDefect.get(d.id)?.[b.band]
      return { band: b.band, band_label: ex?.band_label || b.label, min_pct: ex?.min_pct ?? null, max_pct: ex?.max_pct ?? null }
    }),
    hasTol: byDefect.has(d.id),
  }))
  return { standard: { id: std.id, name: std.name, active: std.active, commodity_code: std.commodity_code, commodity_name: std.commodity_name, updated_at: std.updated_at, source_doc: std.source_doc }, defects }
}

/** Reemplaza las 5 bandas de un defecto en un estándar. */
export async function upsertDefectTolerances(standardId, defectId, bands) {
  if (!defectId) throw appError(400, 'defect_id requerido')
  await withTransaction(async (tx) => {
    await txRequest(tx, { sid: standardId, did: defectId }).query(
      `DELETE FROM qc.defect_tolerances WHERE standard_id=@sid AND defect_id=@did`)
    for (const b of bands || []) {
      if (b.min_pct == null && b.max_pct == null) continue
      await txRequest(tx, {
        sid: standardId, did: defectId, band: b.band,
        bl: b.band_label || null,
        mn: b.min_pct == null || b.min_pct === '' ? null : Number(b.min_pct),
        mx: b.max_pct == null || b.max_pct === '' ? null : Number(b.max_pct),
      }).query(
        `INSERT INTO qc.defect_tolerances (standard_id, defect_id, band, band_label, min_pct, max_pct)
         VALUES (@sid, @did, @band, @bl, @mn, @mx)`)
    }
    // Sello de última actualización del estándar (lo muestra la pantalla Tolerancias)
    await txRequest(tx, { sid: standardId }).query(
      `UPDATE qc.quality_standards SET updated_at=SYSUTCDATETIME() WHERE id=@sid`)
  })
}
