// Repositorio de arribos (contenedores): agrupan inspecciones por pallet.
import { query, appError } from '@/lib/db/mssql'

const num = (v) => {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function listArrivals() {
  const r = await query(
    `SELECT a.id, a.container, a.warehouse, a.carrier_type, a.arrival_date, a.week_no,
            a.cartons, a.created_at, c.code AS commodity_code, c.name AS commodity_name,
            (SELECT COUNT(*) FROM qc.inspections i WHERE i.arrival_id=a.id AND i.deleted_at IS NULL) AS pallets,
            (SELECT AVG(CAST(r2.score AS FLOAT)) FROM qc.inspections i JOIN qc.inspection_results r2 ON r2.inspection_id=i.id
             WHERE i.arrival_id=a.id AND i.deleted_at IS NULL) AS avg_score,
            (SELECT COUNT(*) FROM qc.inspections i JOIN qc.inspection_results r2 ON r2.inspection_id=i.id
             WHERE i.arrival_id=a.id AND i.deleted_at IS NULL AND r2.resolution='rejected') AS rejected,
            (SELECT COUNT(*) FROM qc.inspections i JOIN qc.inspection_results r2 ON r2.inspection_id=i.id
             WHERE i.arrival_id=a.id AND i.deleted_at IS NULL AND r2.resolution='conditional') AS conditional,
            (SELECT TOP 1 d.label FROM qc.inspections i
             JOIN qc.inspection_results r2 ON r2.inspection_id=i.id
             JOIN qc.defects d ON d.id=r2.causal_defect_id
             WHERE i.arrival_id=a.id AND i.deleted_at IS NULL
             GROUP BY d.label ORDER BY COUNT(*) DESC) AS main_problem
     FROM qc.arrivals a
     LEFT JOIN qc.commodities c ON c.id=a.commodity_id
     WHERE a.deleted_at IS NULL
     ORDER BY a.created_at DESC`)
  return r.recordset
}

export async function createArrival(body, userId) {
  const container = String(body?.container || '').trim()
  if (!container) throw appError(400, 'container requerido')
  let commodityId = null
  if (body.commodity_code) {
    const c = await query(`SELECT id FROM qc.commodities WHERE code=@c`, { c: String(body.commodity_code).toUpperCase() })
    commodityId = c.recordset?.[0]?.id ?? null
  }
  const r = await query(
    `INSERT INTO qc.arrivals
       (container, commodity_id, warehouse, carrier_type, vessel, arrival_date, warehouse_date,
        week_no, cartons, atmosphere, o2_pct, co2_pct, upc, fumigation, notes, created_by_user_id)
     OUTPUT INSERTED.id
     VALUES (@container, @cid, @wh, @carrier, @vessel, @adate, @wdate, @week, @cartons,
             @atm, @o2, @co2, @upc, @fum, @notes, @uid)`,
    {
      container, cid: commodityId,
      wh: body.warehouse || null, carrier: body.carrier_type || null, vessel: body.vessel || null,
      adate: body.arrival_date || null, wdate: body.warehouse_date || null,
      week: num(body.week_no), cartons: num(body.cartons),
      atm: body.atmosphere || null, o2: num(body.o2_pct), co2: num(body.co2_pct),
      upc: body.upc || null, fum: body.fumigation ? 1 : 0,
      notes: body.notes || null, uid: userId,
    })
  return r.recordset[0].id
}

export async function getArrival(id) {
  const head = await query(
    `SELECT a.*, c.code AS commodity_code, c.name AS commodity_name
     FROM qc.arrivals a LEFT JOIN qc.commodities c ON c.id=a.commodity_id
     WHERE a.id=@id AND a.deleted_at IS NULL`, { id })
  const row = head.recordset?.[0]
  if (!row) throw appError(404, 'Arribo no encontrado')

  const insp = await query(
    `SELECT i.id, i.created_at, i.reinspection_of, l.lot_code AS lot, l.variety, pr.name AS producer, p.pallet_code,
            r.score, r.resolution, r.worst_band, d.label AS causal,
            i.firmness_min, i.firmness_mode, i.firmness_max, i.brix_avg,
            (SELECT TOP 1 status FROM qc.inspection_pdf_versions v WHERE v.inspection_id=i.id ORDER BY version DESC) AS pdf_status
     FROM qc.inspections i
     LEFT JOIN qc.pallets p ON p.id=i.pallet_id
     LEFT JOIN qc.lots l ON l.id=p.lot_id
     LEFT JOIN qc.producers pr ON pr.id=l.producer_id
     LEFT JOIN qc.inspection_results r ON r.inspection_id=i.id
     LEFT JOIN qc.defects d ON d.id=r.causal_defect_id
     WHERE i.arrival_id=@id AND i.deleted_at IS NULL
     ORDER BY i.created_at ASC`, { id })

  return { ...row, inspections: insp.recordset }
}

export async function softDeleteArrival(id) {
  const r = await query(
    `UPDATE qc.arrivals SET deleted_at=SYSUTCDATETIME() WHERE id=@id AND deleted_at IS NULL;
     SELECT @@ROWCOUNT AS n`, { id })
  if (!r.recordset?.[0]?.n) throw appError(404, 'Arribo no encontrado')
}
