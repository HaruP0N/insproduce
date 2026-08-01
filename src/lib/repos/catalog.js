// Repositorio de catálogos (schema qc). Aísla el SQL del resto de la app.
import { query, txRequest, appError, sql } from '@/lib/db/mssql'

export async function listCommodities() {
  const r = await query(
    `SELECT id, code, name FROM qc.commodities
     WHERE active = 1 AND code <> 'CHERRY' ORDER BY name ASC`)
  return r.recordset
}

export async function getCommodityByCode(code) {
  const r = await query(
    `SELECT TOP 1 id, code, name, active FROM qc.commodities WHERE code = @code`,
    { code: String(code || '').trim().toUpperCase() })
  return r.recordset?.[0] || null
}

/** Plantilla activa de mayor versión para un commodity. */
export async function getActiveTemplate(commodityId) {
  const r = await query(
    `SELECT TOP 1 id, name, version FROM qc.metric_templates
     WHERE commodity_id = @cid AND active = 1 ORDER BY version DESC, id DESC`,
    { cid: commodityId })
  return r.recordset?.[0] || null
}

/** Estándar de calidad activo (p.ej. FTF Destino) para un commodity. */
export async function getActiveStandard(commodityId) {
  const r = await query(
    `SELECT TOP 1 id, name FROM qc.quality_standards
     WHERE commodity_id = @cid AND active = 1 ORDER BY id ASC`,
    { cid: commodityId })
  return r.recordset?.[0] || null
}

/**
 * Devuelve los "fields" de la plantilla activa con el contrato que espera el front:
 * key = "family.code", + label/field_type/required/unit/options.
 */
export async function getTemplateFieldsByCommodityCode(code) {
  const commodity = await getCommodityByCode(code)
  if (!commodity) throw appError(404, `Commodity ${code} no encontrado`)
  if (!commodity.active) throw appError(400, `Commodity ${code} inactivo`)

  const template = await getActiveTemplate(commodity.id)
  if (!template) return { commodity, template: null, fields: [] }

  const f = await query(
    `SELECT d.family + '.' + d.code AS [key], d.label, d.value_type AS field_type,
            td.required, d.unit, td.order_index
     FROM qc.template_defects td
     JOIN qc.defects d ON d.id = td.defect_id
     WHERE td.template_id = @tid
     ORDER BY td.order_index ASC, d.id ASC`,
    { tid: template.id })

  const fields = []
  for (const row of f.recordset) {
    const opts = await query(
      `SELECT o.value, o.label FROM qc.defect_options o
       JOIN qc.defects d ON d.id = o.defect_id
       WHERE d.family + '.' + d.code = @key AND d.commodity_id = @cid
       ORDER BY o.order_index`,
      { key: row.key, cid: commodity.id })
    fields.push({
      key: row.key,
      label: row.label,
      field_type: row.field_type,
      required: !!row.required,
      unit: row.unit ?? null,
      options: opts.recordset.map(o => o.value)
    })
  }
  return { commodity, template, fields }
}

/** Mapa "family.code" -> { id, value_type, family, unit } de los defectos de un commodity. */
export async function getDefectMap(tx, commodityId) {
  const r = await txRequest(tx, { cid: commodityId }).query(
    `SELECT id, family, code, value_type, unit FROM qc.defects WHERE commodity_id = @cid`)
  const map = new Map()
  for (const d of r.recordset) map.set(`${d.family}.${d.code}`, d)
  return map
}

export async function findOrCreateProducer(tx, name) {
  const n = String(name || '').trim()
  if (!n) return null
  const found = await txRequest(tx, { n }).query(
    `SELECT id FROM qc.producers WHERE name = @n`)
  if (found.recordset?.length) return found.recordset[0].id
  const ins = await txRequest(tx, { n }).query(
    `INSERT INTO qc.producers (name) OUTPUT INSERTED.id VALUES (@n)`)
  return ins.recordset[0].id
}

/** Tipo de embalaje por etiqueta (find-or-create). Devuelve id o null. */
export async function findOrCreatePackagingType(tx, label) {
  const l = String(label || '').trim()
  if (!l) return null
  const found = await txRequest(tx, { l }).query(
    `SELECT id FROM qc.packaging_types WHERE label = @l`)
  if (found.recordset?.length) return found.recordset[0].id
  // code derivado de la etiqueta (A-Z0-9_), único
  const code = l.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50) || 'PKG'
  const ins = await txRequest(tx, { code, l }).query(
    `INSERT INTO qc.packaging_types (code, label) OUTPUT INSERTED.id VALUES (@code, @l)`)
  return ins.recordset[0].id
}

export async function findOrCreateLot(tx, { commodityId, lotCode, producerId, variety, packagingDate, packagingTypeId }) {
  const code = String(lotCode || '').trim() || 'SIN-LOTE'
  const found = await txRequest(tx, { cid: commodityId, code }).query(
    `SELECT id FROM qc.lots WHERE commodity_id = @cid AND lot_code = @code`)
  if (found.recordset?.length) return found.recordset[0].id
  const ins = await txRequest(tx, {
    cid: commodityId, code,
    pid: producerId ?? null,
    variety: variety ? String(variety).trim() : null,
    pdate: packagingDate || null,
    ptid: packagingTypeId ?? null
  }).query(
    `INSERT INTO qc.lots (commodity_id, producer_id, lot_code, variety, packaging_date, packaging_type_id)
     OUTPUT INSERTED.id VALUES (@cid, @pid, @code, @variety, @pdate, @ptid)`)
  return ins.recordset[0].id
}

export async function findOrCreatePallet(tx, lotId, palletCode = 'P1') {
  const found = await txRequest(tx, { lid: lotId, code: palletCode }).query(
    `SELECT id FROM qc.pallets WHERE lot_id = @lid AND pallet_code = @code`)
  if (found.recordset?.length) return found.recordset[0].id
  const ins = await txRequest(tx, { lid: lotId, code: palletCode }).query(
    `INSERT INTO qc.pallets (lot_id, pallet_code) OUTPUT INSERTED.id VALUES (@lid, @code)`)
  return ins.recordset[0].id
}

/* ────────── Commodities CRUD (admin) ────────── */
export async function listCommoditiesAdmin() {
  const r = await query(
    `SELECT c.id, c.code, c.name, c.active, c.created_at,
            (SELECT COUNT(*) FROM qc.metric_templates t WHERE t.commodity_id=c.id AND t.active=1) AS templates,
            (SELECT COUNT(*) FROM qc.quality_standards s WHERE s.commodity_id=c.id AND s.active=1) AS standards,
            (SELECT COUNT(*) FROM qc.defects d WHERE d.commodity_id=c.id AND d.active=1) AS defects
     FROM qc.commodities c ORDER BY c.active DESC, c.name ASC`)
  return r.recordset
}

export async function createCommodity({ code, name }) {
  const c = String(code || '').trim().toUpperCase()
  const n = String(name || '').trim()
  if (!c || !n) throw appError(400, 'Código y nombre son obligatorios')
  if (!/^[A-Z0-9_]+$/.test(c)) throw appError(400, 'Código: solo A-Z, 0-9, guion bajo')
  const dup = await query(`SELECT 1 FROM qc.commodities WHERE code=@c OR name=@n`, { c, n })
  if (dup.recordset?.length) throw appError(409, 'Ya existe un commodity con ese código o nombre')
  const r = await query(`INSERT INTO qc.commodities (code, name, active) OUTPUT INSERTED.id VALUES (@c, @n, 1)`, { c, n })
  return r.recordset[0].id
}

export async function updateCommodity(code, { name, active }) {
  const c = String(code || '').trim().toUpperCase()
  const ex = await getCommodityByCode(c)
  if (!ex) throw appError(404, 'Commodity no encontrado')
  await query(
    `UPDATE qc.commodities SET name = COALESCE(@n, name), active = COALESCE(@a, active) WHERE code=@c`,
    { c, n: name != null ? String(name).trim() : null, a: typeof active === 'boolean' ? (active ? 1 : 0) : null })
}

/* ────────── Lotes (admin, solo lectura + edición de cabecera) ────────── */
export async function listLots() {
  const r = await query(
    `SELECT l.id, l.lot_code, l.variety, l.packaging_date, l.created_at,
            c.code AS commodity_code, c.name AS commodity_name,
            pr.name AS producer,
            (SELECT COUNT(*) FROM qc.pallets p WHERE p.lot_id=l.id) AS pallets,
            (SELECT COUNT(*) FROM qc.inspections i JOIN qc.pallets p ON p.id=i.pallet_id WHERE p.lot_id=l.id AND i.deleted_at IS NULL) AS inspections
     FROM qc.lots l
     JOIN qc.commodities c ON c.id=l.commodity_id
     LEFT JOIN qc.producers pr ON pr.id=l.producer_id
     ORDER BY l.created_at DESC`)
  return r.recordset
}

export async function updateLot(id, { variety, producer }) {
  const ex = await query(`SELECT id FROM qc.lots WHERE id=@id`, { id })
  if (!ex.recordset?.length) throw appError(404, 'Lote no encontrado')
  let producerId = null
  if (producer != null && String(producer).trim()) {
    const p = await query(`SELECT id FROM qc.producers WHERE name=@n`, { n: String(producer).trim() })
    if (p.recordset?.length) producerId = p.recordset[0].id
    else { const ins = await query(`INSERT INTO qc.producers (name) OUTPUT INSERTED.id VALUES (@n)`, { n: String(producer).trim() }); producerId = ins.recordset[0].id }
  }
  await query(
    `UPDATE qc.lots SET variety = COALESCE(@v, variety), producer_id = COALESCE(@pid, producer_id) WHERE id=@id`,
    { id, v: variety != null ? String(variety).trim() : null, pid: producerId })
}
