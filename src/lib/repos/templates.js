// Repositorio de plantillas de métricas (schema qc). Las "fields" del front
// (key = "family.code") se materializan como qc.defects + qc.template_defects.
import { query, withTransaction, txRequest, appError } from '@/lib/db/mssql'
import { getCommodityByCode } from '@/lib/repos/catalog'

const FAMILIES = ['quality', 'condition', 'packaging', 'measurement']
const VTYPES = ['number', 'select', 'boolean', 'text']

function splitKey(key) {
  const dot = String(key).indexOf('.')
  const family = dot > 0 ? key.slice(0, dot) : 'quality'
  const code = dot > 0 ? key.slice(dot + 1) : key
  return { family: FAMILIES.includes(family) ? family : 'quality', code }
}

async function findOrCreateDefect(tx, commodityId, field) {
  const { family, code } = splitKey(field.key)
  const found = await txRequest(tx, { cid: commodityId, f: family, c: code }).query(
    `SELECT id, value_type FROM qc.defects WHERE commodity_id=@cid AND family=@f AND code=@c`)
  if (found.recordset?.length) return found.recordset[0].id
  const vt = VTYPES.includes(field.field_type) ? field.field_type : 'number'
  const ins = await txRequest(tx, {
    cid: commodityId, c: code, l: field.label || code, f: family, vt, u: field.unit || null
  }).query(
    `INSERT INTO qc.defects (commodity_id, code, label, family, value_type, unit)
     OUTPUT INSERTED.id VALUES (@cid, @c, @l, @f, @vt, @u)`)
  return ins.recordset[0].id
}

async function upsertOptions(tx, defectId, options) {
  if (!Array.isArray(options)) return
  for (let i = 0; i < options.length; i++) {
    const val = String(options[i])
    await txRequest(tx, { did: defectId, v: val, l: val, o: i }).query(
      `IF NOT EXISTS (SELECT 1 FROM qc.defect_options WHERE defect_id=@did AND value=@v)
       INSERT INTO qc.defect_options (defect_id, value, label, order_index) VALUES (@did, @v, @l, @o)`)
  }
}

async function addFields(tx, commodityId, templateId, fields) {
  let order = 0
  for (const field of fields) {
    if (!field?.key || !field?.label || !field?.field_type) continue
    const defectId = await findOrCreateDefect(tx, commodityId, field)
    await txRequest(tx, {
      tid: templateId, did: defectId,
      req: field.required ? 1 : 0,
      oi: field.order_index != null ? Number(field.order_index) : order++
    }).query(
      `IF NOT EXISTS (SELECT 1 FROM qc.template_defects WHERE template_id=@tid AND defect_id=@did)
       INSERT INTO qc.template_defects (template_id, defect_id, required, order_index) VALUES (@tid, @did, @req, @oi)`)
    if (field.field_type === 'select') await upsertOptions(tx, defectId, field.options)
  }
}

export async function createTemplate({ commodityCode, name, fields }, actorId) {
  const commodity = await getCommodityByCode(commodityCode)
  if (!commodity) throw appError(404, 'Commodity no encontrada o inactiva')
  if (!name) throw appError(400, 'name requerido')
  if (!Array.isArray(fields)) throw appError(400, 'fields debe ser array')

  return withTransaction(async (tx) => {
    const v = await txRequest(tx, { cid: commodity.id }).query(
      `SELECT ISNULL(MAX(version),0)+1 AS nv FROM qc.metric_templates WHERE commodity_id=@cid`)
    const version = v.recordset[0].nv
    await txRequest(tx, { cid: commodity.id }).query(
      `UPDATE qc.metric_templates SET active=0 WHERE commodity_id=@cid`)
    const t = await txRequest(tx, { cid: commodity.id, v: version, n: String(name) }).query(
      `INSERT INTO qc.metric_templates (commodity_id, version, name, active)
       OUTPUT INSERTED.id VALUES (@cid, @v, @n, 1)`)
    const templateId = t.recordset[0].id
    await addFields(tx, commodity.id, templateId, fields)
    return { templateId, version }
  }, { actorId })
}

export async function getTemplateById(templateId) {
  const t = await query(
    `SELECT t.id, t.name, t.version, t.commodity_id, c.code AS commodity_code
     FROM qc.metric_templates t JOIN qc.commodities c ON c.id=t.commodity_id WHERE t.id=@id`,
    { id: templateId })
  const tpl = t.recordset?.[0]
  if (!tpl) throw appError(404, 'Template no encontrado')
  const f = await query(
    `SELECT d.family + '.' + d.code AS [key], d.label, d.value_type AS field_type, td.required, d.unit, td.order_index
     FROM qc.template_defects td JOIN qc.defects d ON d.id=td.defect_id
     WHERE td.template_id=@id ORDER BY td.order_index, d.id`, { id: templateId })
  return { template: { id: tpl.id, name: tpl.name, version: tpl.version, commodity_code: tpl.commodity_code }, fields: f.recordset }
}

export async function replaceTemplateFields(templateId, fields, actorId) {
  const t = await query(`SELECT commodity_id FROM qc.metric_templates WHERE id=@id`, { id: templateId })
  if (!t.recordset?.length) throw appError(404, 'Template no encontrado')
  if (!Array.isArray(fields)) throw appError(400, 'fields debe ser array')
  const commodityId = t.recordset[0].commodity_id
  await withTransaction(async (tx) => {
    await txRequest(tx, { id: templateId }).query(`DELETE FROM qc.template_defects WHERE template_id=@id`)
    await addFields(tx, commodityId, templateId, fields)
  }, { actorId })
}

/** Lista de plantillas (admin) con commodity y cantidad de campos. */
export async function listTemplates() {
  const r = await query(
    `SELECT t.id, t.name, t.version, t.active, t.created_at,
            c.code AS commodity_code, c.name AS commodity_name,
            (SELECT COUNT(*) FROM qc.template_defects td WHERE td.template_id=t.id) AS fields
     FROM qc.metric_templates t
     JOIN qc.commodities c ON c.id=t.commodity_id
     ORDER BY c.name ASC, t.version DESC`)
  return r.recordset
}
