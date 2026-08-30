// Repositorio de inspecciones (schema qc). Encapsula la creación transaccional
// (inspección + mediciones + fotos + resultados + auditoría) y las lecturas.
import { query, withTransaction, txRequest, appError, sql } from '@/lib/db/mssql'
import { isAllowedPhotoUrl } from '@/lib/security/photoUrls'
import {
  getCommodityByCode, getActiveTemplate, getActiveStandard,
  getDefectMap, findOrCreateProducer, findOrCreateLot, findOrCreatePallet, findOrCreatePackagingType
} from '@/lib/repos/catalog'
import { computeAndStoreResults } from '@/lib/repos/results'

const num = (v) => {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Inserta una medición tipada según el value_type del defecto. */
async function insertMeasurement(tx, inspectionId, d, raw) {
  if (d.value_type === 'select') {
    const opt = await txRequest(tx, { did: d.id, val: String(raw) }).query(
      `SELECT TOP 1 id FROM qc.defect_options WHERE defect_id=@did AND value=@val`)
    if (!opt.recordset?.length) return false
    await txRequest(tx, { iid: inspectionId, did: d.id, oid: opt.recordset[0].id }).query(
      `INSERT INTO qc.inspection_measurements (inspection_id, defect_id, value_option_id) VALUES (@iid, @did, @oid)`)
  } else if (d.value_type === 'boolean') {
    await txRequest(tx, { iid: inspectionId, did: d.id, b: (raw === true || raw === 'true' || raw === 1 || raw === '1') ? 1 : 0 }).query(
      `INSERT INTO qc.inspection_measurements (inspection_id, defect_id, value_bool) VALUES (@iid, @did, @b)`)
  } else if (d.value_type === 'text') {
    await txRequest(tx, { iid: inspectionId, did: d.id, t: String(raw).slice(0, 200) }).query(
      `INSERT INTO qc.inspection_measurements (inspection_id, defect_id, value_text) VALUES (@iid, @did, @t)`)
  } else {
    const n = num(raw)
    if (n == null) return false
    await txRequest(tx, { iid: inspectionId, did: d.id, n }).query(
      `INSERT INTO qc.inspection_measurements (inspection_id, defect_id, value_num) VALUES (@iid, @did, @n)`)
  }
  return true
}

async function writeAudit(tx, { actorId, action, table, pk, newValues }) {
  await txRequest(tx, {
    a: actorId ?? null, act: action, t: table, pk: String(pk),
    nv: newValues ? JSON.stringify(newValues) : null
  }).query(
    `INSERT INTO qc.audit_log (actor_user_id, action, table_name, record_pk, new_values)
     VALUES (@a, @act, @t, @pk, @nv)`)
}

/**
 * Crea una inspección a partir del payload del front (compatible con el modelo viejo:
 * metrics = { "family.code": valor }, photos = { metricKey: [urls] }).
 * Todo en una transacción: si algo falla, no queda nada a medias.
 */
export async function createInspection(user, body) {
  const commodityCode = String(body?.commodity_code || '').trim().toUpperCase()
  if (!commodityCode) throw appError(400, 'commodity_code requerido')

  const commodity = await getCommodityByCode(commodityCode)
  if (!commodity) throw appError(404, `Commodity ${commodityCode} no encontrado`)
  if (!commodity.active) throw appError(400, `Commodity ${commodityCode} inactivo`)

  const template = await getActiveTemplate(commodity.id)
  let standard = await getActiveStandard(commodity.id)
  // Estándar explícito (selector del admin): debe pertenecer al commodity y estar activo
  if (body.standard_id != null) {
    const s = await query(
      `SELECT id, name FROM qc.quality_standards WHERE id=@s AND commodity_id=@cid AND active=1`,
      { s: Number(body.standard_id), cid: commodity.id })
    if (!s.recordset?.length) throw appError(400, 'standard_id inválido para este commodity')
    standard = s.recordset[0]
  }

  // Arribo (contenedor) al que pertenece esta inspección, si aplica
  let arrivalId = null
  if (body.arrival_id != null) {
    const a = await query(`SELECT id FROM qc.arrivals WHERE id=@a AND deleted_at IS NULL`, { a: Number(body.arrival_id) })
    if (!a.recordset?.length) throw appError(400, 'arrival_id inválido')
    arrivalId = a.recordset[0].id
  }

  // Reinspección: enlaza con la inspección original (prevalece la más reciente)
  let reinspectionOf = null
  if (body.reinspection_of != null) {
    const o = await query(`SELECT id FROM qc.inspections WHERE id=@o AND deleted_at IS NULL`, { o: Number(body.reinspection_of) })
    if (!o.recordset?.length) throw appError(400, 'reinspection_of inválido')
    reinspectionOf = o.recordset[0].id
  }
  const metrics = (body.metrics && typeof body.metrics === 'object') ? body.metrics : {}
  const photos = (body.photos && typeof body.photos === 'object') ? body.photos : {}
  const unknownKeys = []
  let skippedPhotos = 0

  return withTransaction(async (tx) => {
    const producerId = await findOrCreateProducer(tx, body.producer)
    const packagingTypeId = await findOrCreatePackagingType(tx, body.packaging_type)
    const lotId = await findOrCreateLot(tx, {
      commodityId: commodity.id, lotCode: body.lot, producerId,
      variety: body.variety, packagingDate: body.packaging_date, packagingTypeId
    })
    // N° de pallet real del payload; sin él se mantiene el pallet sintético 'P1'
    const palletCode = String(body.pallet_number ?? '').trim().slice(0, 50) || 'P1'
    const palletId = await findOrCreatePallet(tx, lotId, palletCode)

    // Insert cabecera
    const ins = await txRequest(tx, {
      pallet: palletId,
      assignment: body.assignment_id ? Number(body.assignment_id) : null,
      cid: commodity.id,
      tpl: template?.id ?? null,
      tver: template?.version ?? null,
      std: standard?.id ?? null,
      uid: user.id,
      brix: num(body.brix_avg), brixMin: num(body.brix_min), brixMax: num(body.brix_max),
      brixMode: num(body.brix_mode),
      diaMin: num(body.diameter_min), diaMax: num(body.diameter_max),
      tw: num(body.temp_water), ta: num(body.temp_ambient), tp: num(body.temp_pulp),
      nw: num(body.net_weight) > 0 ? num(body.net_weight) : null,
      sw: num(body.sample_weight_g) > 0 ? num(body.sample_weight_g) : null,
      fMin: num(body.baxlo_min), fMode: num(body.baxlo_mode), fMax: num(body.baxlo_max),
      arrival: arrivalId, reinsp: reinspectionOf,
      notes: body.notes ? String(body.notes) : null
    }).query(
      `INSERT INTO qc.inspections
        (pallet_id, assignment_id, commodity_id, template_id, template_version, standard_id,
         created_by_user_id, brix_avg, brix_min, brix_max, brix_mode, diameter_min, diameter_max,
         temp_water, temp_ambient, temp_pulp, net_weight, sample_weight_g,
         firmness_min, firmness_mode, firmness_max, arrival_id, reinspection_of, notes)
       OUTPUT INSERTED.id
       VALUES (@pallet, @assignment, @cid, @tpl, @tver, @std, @uid, @brix, @brixMin, @brixMax, @brixMode, @diaMin, @diaMax, @tw, @ta, @tp, @nw, @sw, @fMin, @fMode, @fMax, @arrival, @reinsp, @notes)`)
    const inspectionId = ins.recordset[0].id

    // Mediciones (traducir JSON plano -> filas tipadas)
    const defectMap = await getDefectMap(tx, commodity.id)
    for (const [key, raw] of Object.entries(metrics)) {
      if (raw === '' || raw == null) continue
      const d = defectMap.get(key)
      if (!d) { unknownKeys.push(key); continue }

      if (d.value_type === 'select') {
        const opt = await txRequest(tx, { did: d.id, val: String(raw) }).query(
          `SELECT TOP 1 id FROM qc.defect_options WHERE defect_id=@did AND value=@val`)
        if (!opt.recordset?.length) continue
        await txRequest(tx, { iid: inspectionId, did: d.id, oid: opt.recordset[0].id }).query(
          `INSERT INTO qc.inspection_measurements (inspection_id, defect_id, value_option_id)
           VALUES (@iid, @did, @oid)`)
      } else if (d.value_type === 'boolean') {
        await txRequest(tx, { iid: inspectionId, did: d.id, b: (raw === true || raw === 'true' || raw === 1 || raw === '1') ? 1 : 0 }).query(
          `INSERT INTO qc.inspection_measurements (inspection_id, defect_id, value_bool) VALUES (@iid, @did, @b)`)
      } else if (d.value_type === 'text') {
        await txRequest(tx, { iid: inspectionId, did: d.id, t: String(raw).slice(0, 200) }).query(
          `INSERT INTO qc.inspection_measurements (inspection_id, defect_id, value_text) VALUES (@iid, @did, @t)`)
      } else { // number
        const n = num(raw)
        if (n == null) continue
        await txRequest(tx, { iid: inspectionId, did: d.id, n }).query(
          `INSERT INTO qc.inspection_measurements (inspection_id, defect_id, value_num) VALUES (@iid, @did, @n)`)
      }
    }

    // Fotos (allowlist anti-SSRF). 'header.<tag>' = set de fotos oficial FTF;
    // el resto se asocia al defecto de la métrica.
    for (const [metricKey, urls] of Object.entries(photos)) {
      if (!Array.isArray(urls)) continue
      const isHeader = metricKey.startsWith('header.')
      const headerTag = isHeader ? metricKey.slice(7, 37) : null
      const d = isHeader ? null : defectMap.get(metricKey)
      for (const url of urls) {
        if (!isAllowedPhotoUrl(url)) { skippedPhotos++; continue }
        await txRequest(tx, { iid: inspectionId, did: d?.id ?? null, kind: isHeader ? 'header' : 'defect', tag: headerTag, url: String(url) }).query(
          `INSERT INTO qc.inspection_photos (inspection_id, defect_id, photo_kind, header_tag, url)
           VALUES (@iid, @did, @kind, @tag, @url)`)
      }
    }

    // Resultados (score/resolución/causal)
    await computeAndStoreResults(tx, inspectionId)

    // Versión de PDF pendiente
    await txRequest(tx, { iid: inspectionId }).query(
      `INSERT INTO qc.inspection_pdf_versions (inspection_id, version, status) VALUES (@iid, 1, 'PENDING')`)

    // Cierra la asignación de origen
    if (body.assignment_id) {
      await txRequest(tx, { aid: Number(body.assignment_id) }).query(
        `UPDATE qc.assignments SET status='completada', updated_at=SYSUTCDATETIME() WHERE id=@aid`)
    }

    await writeAudit(tx, { actorId: user.id, action: 'INSERT', table: 'qc.inspections', pk: inspectionId, newValues: { commodity: commodityCode, lot: body.lot } })

    return { id: inspectionId, warnings: { unknownKeys, skippedPhotos } }
  }, { actorId: user.id })
}

/** Detalle completo; reconstruye metrics.values para compatibilidad con el front actual. */
export async function getInspectionDetail(id, user) {
  const head = await query(
    `SELECT i.id, i.created_at, i.updated_at, i.commodity_id, i.created_by_user_id,
            i.brix_avg, i.brix_min, i.brix_max, i.brix_mode, i.diameter_min, i.diameter_max,
            i.firmness_min, i.firmness_mode, i.firmness_max,
            i.temp_water, i.temp_ambient, i.temp_pulp, i.net_weight, i.sample_weight_g, i.notes,
            i.standard_id, st.name AS standard_name,
            c.code AS commodity_code, c.name AS commodity_name,
            l.lot_code AS lot, l.variety, pr.name AS producer, p.pallet_code,
            r.quality_total_pct, r.condition_total_pct, r.total_defects_pct, r.score, r.resolution, r.worst_band,
            (SELECT TOP 1 status FROM qc.inspection_pdf_versions v WHERE v.inspection_id=i.id ORDER BY version DESC) AS pdf_status,
            (SELECT TOP 1 pdf_url FROM qc.inspection_pdf_versions v WHERE v.inspection_id=i.id ORDER BY version DESC) AS pdf_url
     FROM qc.inspections i
     JOIN qc.commodities c ON c.id = i.commodity_id
     LEFT JOIN qc.pallets p ON p.id = i.pallet_id
     LEFT JOIN qc.lots l ON l.id = p.lot_id
     LEFT JOIN qc.producers pr ON pr.id = l.producer_id
     LEFT JOIN qc.inspection_results r ON r.inspection_id = i.id
     LEFT JOIN qc.quality_standards st ON st.id = i.standard_id
     WHERE i.id = @id AND i.deleted_at IS NULL`,
    { id })
  const row = head.recordset?.[0]
  if (!row) throw appError(404, 'Inspección no encontrada')
  if (user.role !== 'admin' && Number(row.created_by_user_id) !== Number(user.id))
    throw appError(403, 'Sin permiso sobre esta inspección')

  const meas = await query(
    `SELECT d.family + '.' + d.code AS [key], d.label, d.value_type,
            m.value_num, m.value_bool, m.value_text, o.value AS option_value
     FROM qc.inspection_measurements m
     JOIN qc.defects d ON d.id = m.defect_id
     LEFT JOIN qc.defect_options o ON o.id = m.value_option_id
     WHERE m.inspection_id = @id AND m.sample_id IS NULL`,
    { id })
  const values = {}
  for (const m of meas.recordset) {
    values[m.key] = m.value_num != null ? String(m.value_num)
      : m.option_value != null ? m.option_value
      : m.value_bool != null ? (m.value_bool ? 'true' : 'false')
      : m.value_text ?? ''
  }

  const photos = await query(
    `SELECT defect_id, photo_kind, header_tag, url FROM qc.inspection_photos WHERE inspection_id=@id ORDER BY id`,
    { id })

  return { ...row, metrics: { template_id: null, values }, measurements: meas.recordset, photos: photos.recordset || [] }
}

/** Reemplaza las mediciones de una inspección (edición admin/dueño), recalcula e invalida el PDF. */
export async function replaceMeasurements(inspectionId, values, user) {
  const head = await query(
    `SELECT commodity_id, created_by_user_id FROM qc.inspections WHERE id=@id AND deleted_at IS NULL`,
    { id: inspectionId })
  const row = head.recordset?.[0]
  if (!row) throw appError(404, 'Inspección no encontrada')
  if (user.role !== 'admin' && Number(row.created_by_user_id) !== Number(user.id))
    throw appError(403, 'Sin permiso sobre esta inspección')

  const unknownKeys = []
  await withTransaction(async (tx) => {
    const defectMap = await getDefectMap(tx, row.commodity_id)
    await txRequest(tx, { id: inspectionId }).query(
      `DELETE FROM qc.inspection_measurements WHERE inspection_id=@id AND sample_id IS NULL`)
    for (const [key, raw] of Object.entries(values || {})) {
      if (raw === '' || raw == null) continue
      const d = defectMap.get(key)
      if (!d) { unknownKeys.push(key); continue }
      await insertMeasurement(tx, inspectionId, d, raw)
    }
    await computeAndStoreResults(tx, inspectionId)
    // invalida PDF: nueva versión PENDING
    await txRequest(tx, { id: inspectionId }).query(
      `INSERT INTO qc.inspection_pdf_versions (inspection_id, version, status)
       SELECT @id, ISNULL(MAX(version),0)+1, 'PENDING' FROM qc.inspection_pdf_versions WHERE inspection_id=@id`)
    await writeAudit(tx, { actorId: user.id, action: 'UPDATE', table: 'qc.inspection_measurements', pk: inspectionId })
  }, { actorId: user.id })
  return { unknownKeys }
}

/** Reporte completo para el PDF estilo Power BI (cabecera + resultados + defectos con banda + distribuciones + fotos). */
export async function buildPdfInput(id) {
  const head = await query(
    `SELECT i.id, i.created_at, i.notes, i.commodity_id, i.standard_id,
            i.brix_avg, i.brix_min, i.brix_max, i.brix_mode, i.diameter_min, i.diameter_max,
            i.firmness_min, i.firmness_max, i.firmness_mode,
            i.temp_water, i.temp_ambient, i.temp_pulp, i.net_weight, i.sample_weight_g,
            c.code AS commodity_code, c.name AS commodity_name,
            l.lot_code AS lot, l.variety, pr.name AS producer, p.pallet_code, u.name AS inspector_name,
            s.name AS standard_name,
            r.quality_total_pct, r.condition_total_pct, r.total_defects_pct, r.score, r.resolution, r.worst_band, r.causal_defect_id
     FROM qc.inspections i
     JOIN qc.commodities c ON c.id=i.commodity_id
     LEFT JOIN qc.pallets p ON p.id=i.pallet_id
     LEFT JOIN qc.lots l ON l.id=p.lot_id
     LEFT JOIN qc.producers pr ON pr.id=l.producer_id
     LEFT JOIN qc.users u ON u.id=i.created_by_user_id
     LEFT JOIN qc.quality_standards s ON s.id=i.standard_id
     LEFT JOIN qc.inspection_results r ON r.inspection_id=i.id
     WHERE i.id=@id AND i.deleted_at IS NULL`, { id })
  const row = head.recordset?.[0]
  if (!row) throw appError(404, 'Inspección no encontrada')

  const meas = await query(
    `SELECT d.id AS defect_id, d.family + '.' + d.code AS [key], d.label, d.family, d.unit,
            m.value_num, m.value_text, o.value AS option_value
     FROM qc.inspection_measurements m
     JOIN qc.defects d ON d.id=m.defect_id
     LEFT JOIN qc.defect_options o ON o.id=m.value_option_id
     WHERE m.inspection_id=@id AND m.sample_id IS NULL
     ORDER BY d.family, d.code`, { id })

  let tol = []
  if (row.standard_id != null) {
    tol = (await query(
      `SELECT defect_id, band, band_label, min_pct, max_pct FROM qc.defect_tolerances WHERE standard_id=@s`,
      { s: row.standard_id })).recordset
  }
  const bandFor = (defectId, v) => {
    for (const b of tol) {
      if (b.defect_id !== defectId) continue
      if (v >= Number(b.min_pct) && (b.max_pct == null || v <= Number(b.max_pct)))
        return { band: b.band, band_label: b.band_label, min_pct: Number(b.min_pct), max_pct: b.max_pct == null ? null : Number(b.max_pct) }
    }
    return null
  }

  const defects = []
  const values = {}
  const bandCounts = [0, 0, 0, 0, 0]
  for (const m of meas.recordset) {
    values[m.key] = m.value_num != null ? String(m.value_num) : m.option_value != null ? m.option_value : (m.value_text ?? '')
    const v = m.value_num != null ? Number(m.value_num) : null
    const tb = (m.unit === '%' && v != null) ? bandFor(m.defect_id, v) : null
    if (tb) bandCounts[tb.band - 1]++
    defects.push({
      key: m.key, label: m.label, family: m.family, unit: m.unit,
      value: v, option: m.option_value, text: m.value_text,
      band: tb?.band ?? null, band_label: tb?.band_label ?? null,
      tol_min: tb?.min_pct ?? null, tol_max: tb?.max_pct ?? null,
    })
  }

  const causal = row.causal_defect_id
    ? (await query(`SELECT label FROM qc.defects WHERE id=@d`, { d: row.causal_defect_id })).recordset?.[0]?.label || null
    : null

  const sizeDist = (await query(
    `SELECT sb.code, d.pct FROM qc.inspection_size_distribution d JOIN qc.size_bands sb ON sb.id=d.size_band_id
     WHERE d.inspection_id=@id ORDER BY sb.min_mm`, { id })).recordset
  const colorDist = (await query(
    `SELECT cb.code, d.pct FROM qc.inspection_color_distribution d JOIN qc.color_bands cb ON cb.id=d.color_band_id
     WHERE d.inspection_id=@id`, { id })).recordset

  const trend = (await query(
    `SELECT TOP 8 r.score FROM qc.inspections i2 JOIN qc.inspection_results r ON r.inspection_id=i2.id
     WHERE i2.commodity_id=@cid AND i2.deleted_at IS NULL AND r.score IS NOT NULL
     ORDER BY i2.created_at DESC`, { cid: row.commodity_id })).recordset.map(x => Number(x.score)).reverse()

  const ph = await query(
    `SELECT ph.photo_kind, ph.header_tag, ph.url, d.family + '.' + d.code AS [key], d.label
     FROM qc.inspection_photos ph LEFT JOIN qc.defects d ON d.id=ph.defect_id
     WHERE ph.inspection_id=@id ORDER BY ph.id`, { id })
  const photos = {}
  for (const p of ph.recordset) {
    const key = p.photo_kind === 'header' ? `header.${p.header_tag}` : (p.key || 'other')
    ;(photos[key] = photos[key] || []).push(p.url)
  }

  const results = {
    quality_total_pct: row.quality_total_pct != null ? Number(row.quality_total_pct) : null,
    condition_total_pct: row.condition_total_pct != null ? Number(row.condition_total_pct) : null,
    total_defects_pct: row.total_defects_pct != null ? Number(row.total_defects_pct) : null,
    score: row.score != null ? Number(row.score) : null,
    resolution: row.resolution || null,
    worst_band: row.worst_band || null,
    causal,
  }
  return {
    inspection: { ...row, metrics: { values } },
    results, defects, bandCounts, sizeDist, colorDist, trend, photos,
  }
}

/** Registra una nueva versión de PDF (append-only). */
export async function recordPdfVersion(id, { status, url = null, hash = null, error = null }, userId) {
  await query(
    `INSERT INTO qc.inspection_pdf_versions (inspection_id, version, status, pdf_url, pdf_hash, error_message, generated_by_user_id)
     SELECT @id, ISNULL(MAX(version),0)+1, @status, @url, @hash, @err, @uid
     FROM qc.inspection_pdf_versions WHERE inspection_id=@id`,
    { id, status, url, hash, err: error, uid: userId ?? null })
}

export async function getLatestPdf(id) {
  const r = await query(
    `SELECT TOP 1 status, pdf_url, error_message FROM qc.inspection_pdf_versions
     WHERE inspection_id=@id ORDER BY version DESC`, { id })
  return r.recordset?.[0] || null
}

/** Todas las inspecciones (historial admin). */
export async function listAll(limit = 500) {
  const r = await query(
    `SELECT TOP (${Number(limit) || 500})
            i.id, i.created_at, i.updated_at, c.code AS commodity_code, c.name AS commodity_name,
            l.lot_code AS lot, l.variety, pr.name AS producer, p.pallet_code, i.created_by_user_id, u.name AS inspector_name,
            res.score, res.resolution,
            (SELECT TOP 1 status FROM qc.inspection_pdf_versions v WHERE v.inspection_id=i.id ORDER BY version DESC) AS pdf_status,
            (SELECT TOP 1 pdf_url FROM qc.inspection_pdf_versions v WHERE v.inspection_id=i.id ORDER BY version DESC) AS pdf_url
     FROM qc.inspections i
     JOIN qc.commodities c ON c.id=i.commodity_id
     LEFT JOIN qc.pallets p ON p.id=i.pallet_id
     LEFT JOIN qc.lots l ON l.id=p.lot_id
     LEFT JOIN qc.producers pr ON pr.id=l.producer_id
     LEFT JOIN qc.users u ON u.id=i.created_by_user_id
     LEFT JOIN qc.inspection_results res ON res.inspection_id=i.id
     WHERE i.deleted_at IS NULL
     ORDER BY i.created_at DESC`)
  return r.recordset || []
}

/** Inspecciones creadas por un usuario (vista "completadas" del inspector). */
export async function listByCreator(userId) {
  const r = await query(
    `SELECT i.id, i.created_at, c.code AS commodity_code, c.name AS commodity_name,
            l.lot_code AS lot, l.variety, pr.name AS producer, p.pallet_code,
            res.score, res.resolution,
            (SELECT TOP 1 status FROM qc.inspection_pdf_versions v WHERE v.inspection_id=i.id ORDER BY version DESC) AS pdf_status,
            (SELECT TOP 1 pdf_url FROM qc.inspection_pdf_versions v WHERE v.inspection_id=i.id ORDER BY version DESC) AS pdf_url
     FROM qc.inspections i
     JOIN qc.commodities c ON c.id=i.commodity_id
     LEFT JOIN qc.pallets p ON p.id=i.pallet_id
     LEFT JOIN qc.lots l ON l.id=p.lot_id
     LEFT JOIN qc.producers pr ON pr.id=l.producer_id
     LEFT JOIN qc.inspection_results res ON res.inspection_id=i.id
     WHERE i.created_by_user_id=@uid AND i.deleted_at IS NULL
     ORDER BY i.created_at DESC`,
    { uid: userId })
  return r.recordset || []
}
