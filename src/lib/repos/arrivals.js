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
        week_no, cartons, atmosphere, o2_pct, co2_pct, upc, fumigation, notes, created_by_user_id,
        order_number, shipper, packaging, airline, label, client, grower, destination, packing_date, inspection_date)
     OUTPUT INSERTED.id
     VALUES (@container, @cid, @wh, @carrier, @vessel, @adate, @wdate, @week, @cartons,
             @atm, @o2, @co2, @upc, @fum, @notes, @uid,
             @order_n, @shipper, @packaging, @airline, @label, @client, @grower, @destination, @pdate, @idate)`,
    {
      container, cid: commodityId,
      wh: body.warehouse || null, carrier: body.carrier_type || null, vessel: body.vessel || null,
      adate: body.arrival_date || null, wdate: body.warehouse_date || null,
      week: num(body.week_no), cartons: num(body.cartons),
      atm: body.atmosphere || null, o2: num(body.o2_pct), co2: num(body.co2_pct),
      upc: body.upc || null, fum: body.fumigation ? 1 : 0,
      notes: body.notes || null, uid: userId,
      order_n: body.order_number || null, shipper: body.shipper || null, packaging: body.packaging || null,
      airline: body.airline || null, label: body.label || null, client: body.client || null,
      grower: body.grower || null, destination: body.destination || null,
      pdate: body.packing_date || null, idate: body.inspection_date || null,
    })
  return r.recordset[0].id
}

/** Actualiza la info general del arribo (la precarga se corrige hasta que llega el contenedor). */
export async function updateArrival(id, body) {
  let commodityId
  if (body.commodity_code !== undefined) {
    commodityId = null
    if (body.commodity_code) {
      const c = await query(`SELECT id FROM qc.commodities WHERE code=@c`, { c: String(body.commodity_code).toUpperCase() })
      commodityId = c.recordset?.[0]?.id ?? null
    }
  }
  const r = await query(
    `UPDATE qc.arrivals SET
       container=@container, commodity_id=COALESCE(@cid, commodity_id),
       warehouse=@wh, carrier_type=@carrier, vessel=@vessel,
       arrival_date=@adate, warehouse_date=@wdate, week_no=@week, cartons=@cartons,
       atmosphere=@atm, o2_pct=@o2, co2_pct=@co2, upc=@upc, fumigation=@fum, notes=@notes,
       order_number=@order_n, shipper=@shipper, packaging=@packaging, airline=@airline, label=@label,
       client=@client, grower=@grower, destination=@destination, packing_date=@pdate, inspection_date=@idate
     WHERE id=@id AND deleted_at IS NULL;
     SELECT @@ROWCOUNT AS n`,
    {
      id, container: String(body.container || '').trim(), cid: commodityId ?? null,
      wh: body.warehouse || null, carrier: body.carrier_type || null, vessel: body.vessel || null,
      adate: body.arrival_date || null, wdate: body.warehouse_date || null,
      week: num(body.week_no), cartons: num(body.cartons),
      atm: body.atmosphere || null, o2: num(body.o2_pct), co2: num(body.co2_pct),
      upc: body.upc || null, fum: body.fumigation ? 1 : 0, notes: body.notes || null,
      order_n: body.order_number || null, shipper: body.shipper || null, packaging: body.packaging || null,
      airline: body.airline || null, label: body.label || null, client: body.client || null,
      grower: body.grower || null, destination: body.destination || null,
      pdate: body.packing_date || null, idate: body.inspection_date || null,
    })
  if (!r.recordset?.[0]?.n) throw appError(404, 'Arribo no encontrado')
}

/** Guarda las notas tipificadas del reporte (una fila por tipo; texto vacío elimina). */
export async function saveArrivalNotes(arrivalId, notes) {
  for (const { type, note } of notes) {
    const nt = String(type || '').trim().slice(0, 40)
    if (!nt) continue
    if (note && String(note).trim()) {
      await query(
        `MERGE qc.arrival_notes AS tgt
         USING (SELECT @aid AS arrival_id, @nt AS note_type) AS src
           ON tgt.arrival_id=src.arrival_id AND tgt.note_type=src.note_type
         WHEN MATCHED THEN UPDATE SET note=@note, updated_at=SYSUTCDATETIME()
         WHEN NOT MATCHED THEN INSERT (arrival_id, note_type, note) VALUES (@aid, @nt, @note);`,
        { aid: arrivalId, nt, note: String(note).trim() })
    } else {
      await query(`DELETE FROM qc.arrival_notes WHERE arrival_id=@aid AND note_type=@nt`, { aid: arrivalId, nt })
    }
  }
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
            u.name AS inspector_name,
            r.score, r.resolution, r.worst_band, d.label AS causal,
            i.firmness_min, i.firmness_mode, i.firmness_max, i.brix_avg,
            (SELECT TOP 1 status FROM qc.inspection_pdf_versions v WHERE v.inspection_id=i.id ORDER BY version DESC) AS pdf_status
     FROM qc.inspections i
     LEFT JOIN qc.pallets p ON p.id=i.pallet_id
     LEFT JOIN qc.lots l ON l.id=p.lot_id
     LEFT JOIN qc.producers pr ON pr.id=l.producer_id
     LEFT JOIN qc.users u ON u.id=i.created_by_user_id
     LEFT JOIN qc.inspection_results r ON r.inspection_id=i.id
     LEFT JOIN qc.defects d ON d.id=r.causal_defect_id
     WHERE i.arrival_id=@id AND i.deleted_at IS NULL
     ORDER BY i.created_at ASC`, { id })

  const notes = await query(
    `SELECT note_type, note, updated_at FROM qc.arrival_notes WHERE arrival_id=@id ORDER BY id`, { id })

  // pallets precargados: asignaciones del arribo aún pendientes (sin inspección hecha)
  const pending = await query(
    `SELECT a.id, a.pallet_number, a.lot, a.producer, a.variety, a.status, u.name AS inspector_name
     FROM qc.assignments a LEFT JOIN qc.users u ON u.id=a.user_id
     WHERE a.arrival_id=@id AND a.deleted_at IS NULL AND a.status='pendiente'
     ORDER BY a.id`, { id })

  const files = await query(
    `SELECT id, file_name, description, url, created_at FROM qc.arrival_files
     WHERE arrival_id=@id AND deleted_at IS NULL ORDER BY id`, { id })

  return {
    ...row, inspections: insp.recordset, notes_typed: notes.recordset,
    pending_assignments: pending.recordset, files: files.recordset,
  }
}

/** Promedio por defecto (%) entre los pallets del arribo — gráfico de defectos principales del reporte. */
export async function getArrivalDefectSummary(id) {
  const r = await query(
    `SELECT TOP 10 d.label, d.family, AVG(CAST(m.value_num AS FLOAT)) AS avg_pct, MAX(CAST(m.value_num AS FLOAT)) AS max_pct
     FROM qc.inspection_measurements m
     JOIN qc.inspections i ON i.id=m.inspection_id
     JOIN qc.defects d ON d.id=m.defect_id
     WHERE i.arrival_id=@id AND i.deleted_at IS NULL AND m.sample_id IS NULL
       AND d.unit='%' AND m.value_num IS NOT NULL AND d.family IN ('quality','condition')
     GROUP BY d.label, d.family
     HAVING AVG(CAST(m.value_num AS FLOAT)) > 0
     ORDER BY avg_pct DESC`, { id })
  return r.recordset
}

/** Mediciones % por pallet del arribo — matriz de defectos de la tabla SAMPLES. */
export async function getArrivalMeasurements(id) {
  const r = await query(
    `SELECT m.inspection_id, d.label, CAST(m.value_num AS FLOAT) AS value_num
     FROM qc.inspection_measurements m
     JOIN qc.inspections i ON i.id=m.inspection_id
     JOIN qc.defects d ON d.id=m.defect_id
     WHERE i.arrival_id=@id AND i.deleted_at IS NULL AND m.sample_id IS NULL
       AND d.unit='%' AND m.value_num IS NOT NULL AND d.family IN ('quality','condition')`, { id })
  return r.recordset
}

export async function addArrivalFile(arrivalId, { file_name, description, url, public_id }, userId) {
  const r = await query(
    `INSERT INTO qc.arrival_files (arrival_id, file_name, description, url, public_id, uploaded_by_user_id)
     OUTPUT INSERTED.id VALUES (@aid, @name, @descr, @url, @pubid, @uid)`,
    { aid: arrivalId, name: String(file_name).slice(0, 200), descr: description ? String(description).slice(0, 300) : null,
      url, pubid: public_id || null, uid: userId })
  return r.recordset[0].id
}

export async function deleteArrivalFile(arrivalId, fileId) {
  const r = await query(
    `UPDATE qc.arrival_files SET deleted_at=SYSUTCDATETIME()
     WHERE id=@fid AND arrival_id=@aid AND deleted_at IS NULL; SELECT @@ROWCOUNT AS n`,
    { fid: fileId, aid: arrivalId })
  if (!r.recordset?.[0]?.n) throw appError(404, 'Archivo no encontrado')
}

export async function softDeleteArrival(id) {
  const r = await query(
    `UPDATE qc.arrivals SET deleted_at=SYSUTCDATETIME() WHERE id=@id AND deleted_at IS NULL;
     SELECT @@ROWCOUNT AS n`, { id })
  if (!r.recordset?.[0]?.n) throw appError(404, 'Arribo no encontrado')
}
