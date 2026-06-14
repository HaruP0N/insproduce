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

export async function findOrCreateLot(tx, { commodityId, lotCode, producerId, variety, packagingDate }) {
  const code = String(lotCode || '').trim() || 'SIN-LOTE'
  const found = await txRequest(tx, { cid: commodityId, code }).query(
    `SELECT id FROM qc.lots WHERE commodity_id = @cid AND lot_code = @code`)
  if (found.recordset?.length) return found.recordset[0].id
  const ins = await txRequest(tx, {
    cid: commodityId, code,
    pid: producerId ?? null,
    variety: variety ? String(variety).trim() : null,
    pdate: packagingDate || null
  }).query(
    `INSERT INTO qc.lots (commodity_id, producer_id, lot_code, variety, packaging_date)
     OUTPUT INSERTED.id VALUES (@cid, @pid, @code, @variety, @pdate)`)
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
