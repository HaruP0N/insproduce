// src/app/api/inspecciones/[id]/route.js
import { requireAuth, authorizeOwnership } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { withTransaction, txRequest, query, appError } from '@/lib/db/mssql'
import { getInspectionDetail } from '@/lib/repos/inspections'
import { computeAndStoreResults } from '@/lib/repos/results'

const num = (v) => (v === '' || v == null) ? null : (Number.isFinite(Number(v)) ? Number(v) : null)

// GET — detalle (admin o dueño)
export async function GET(req, context) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response
  try {
    const { id } = await context.params
    const nid = Number(id)
    if (!Number.isInteger(nid) || nid <= 0) return fail(400, 'ID inválido')
    return ok(await getInspectionDetail(nid, auth.user))
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('GET inspecciones/:id', e)
  }
}

// PUT — editar cabecera (solo admin). Recalcula resultados y audita.
export async function PUT(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response

  try {
    const { id } = await context.params
    const nid = Number(id)
    if (!Number.isInteger(nid) || nid <= 0) return fail(400, 'ID inválido')
    const body = await req.json().catch(() => null)
    if (!body) return fail(400, 'Body JSON inválido')

    await withTransaction(async (tx) => {
      const exists = await txRequest(tx, { id: nid }).query(
        `SELECT pallet_id FROM qc.inspections WHERE id=@id AND deleted_at IS NULL`)
      if (!exists.recordset?.length) throw appError(404, 'Inspección no encontrada')

      await txRequest(tx, {
        id: nid,
        brix_avg: num(body.brix_avg), brix_min: num(body.brix_min), brix_max: num(body.brix_max), brix_mode: num(body.brix_moda ?? body.brix_mode),
        diameter_min: num(body.diameter_min), diameter_max: num(body.diameter_max),
        temp_water: num(body.temp_water), temp_ambient: num(body.temp_ambient), temp_pulp: num(body.temp_pulp),
        sample_weight_g: num(body.sample_weight_g), ten_pieces_weight_g: num(body.ten_pieces_weight_g),
        net_weight: num(body.net_weight) > 0 ? num(body.net_weight) : null,
        notes: body.notes != null ? String(body.notes) : null,
        uid: auth.user.id
      }).query(
        `UPDATE qc.inspections SET
           brix_avg=@brix_avg, brix_min=@brix_min, brix_max=@brix_max, brix_mode=@brix_mode,
           diameter_min=@diameter_min, diameter_max=@diameter_max,
           temp_water=@temp_water, temp_ambient=@temp_ambient, temp_pulp=@temp_pulp, sample_weight_g=@sample_weight_g, ten_pieces_weight_g=@ten_pieces_weight_g,
           net_weight=@net_weight, notes=@notes, updated_by_user_id=@uid, updated_at=SYSUTCDATETIME()
         WHERE id=@id`)

      // Actualiza variedad/productor del lote asociado, si vienen
      const palletId = exists.recordset[0].pallet_id
      if (palletId && (body.variety != null || body.producer != null)) {
        await txRequest(tx, { pid: palletId, variety: body.variety != null ? String(body.variety) : null, producer: body.producer != null ? String(body.producer) : null }).query(
          `UPDATE l SET
              variety = COALESCE(@variety, l.variety),
              producer_id = COALESCE((SELECT id FROM qc.producers WHERE name=@producer), l.producer_id)
           FROM qc.lots l JOIN qc.pallets p ON p.lot_id=l.id WHERE p.id=@pid`)
      }

      await computeAndStoreResults(tx, nid)
      await txRequest(tx, { a: auth.user.id, pk: String(nid) }).query(
        `INSERT INTO qc.audit_log (actor_user_id, action, table_name, record_pk) VALUES (@a, 'UPDATE', 'qc.inspections', @pk)`)
    }, { actorId: auth.user.id })

    return ok({ ok: true, msg: 'Cabecera actualizada' })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('PUT inspecciones/:id', e)
  }
}
