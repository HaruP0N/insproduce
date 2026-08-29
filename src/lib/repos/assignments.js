// Repositorio de asignaciones (schema qc).
import { query, withTransaction, txRequest, appError } from '@/lib/db/mssql'
import { getCommodityByCode, findOrCreateProducer, findOrCreateLot } from '@/lib/repos/catalog'

const ALLOWED = ['pendiente', 'completada', 'cancelada']

export async function listPendientes() {
  const r = await query(
    `SELECT a.id, a.created_at, a.producer, a.lot, a.variety, a.pallet_number, a.arrival_id, c.code AS commodity_code,
            a.status, a.instructions AS notes_admin,
            u.id AS inspector_id, u.name AS inspector_name, u.email AS inspector_email
     FROM qc.assignments a
     JOIN qc.users u ON u.id = a.user_id
     LEFT JOIN qc.commodities c ON c.id = a.commodity_id
     WHERE a.status='pendiente' AND a.deleted_at IS NULL
     ORDER BY a.created_at DESC`)
  return r.recordset || []
}

export async function getAssignment(id, user) {
  const r = await query(
    `SELECT a.id, a.user_id, a.producer, a.lot, a.variety, a.status, a.instructions AS notes_admin, a.created_at,
            c.code AS commodity_code, u.id AS inspector_id, u.name AS inspector_name, u.email AS inspector_email
     FROM qc.assignments a
     LEFT JOIN qc.users u ON u.id = a.user_id
     LEFT JOIN qc.commodities c ON c.id = a.commodity_id
     WHERE a.id = @id AND a.deleted_at IS NULL`, { id })
  const row = r.recordset?.[0]
  if (!row) throw appError(404, 'Asignación no encontrada')
  if (user.role !== 'admin' && Number(row.user_id) !== Number(user.id))
    throw appError(403, 'Sin permiso sobre esta asignación')
  return row
}

export async function updateStatus(id, status, actorId) {
  if (!ALLOWED.includes(status)) throw appError(400, `Estado inválido. Permitidos: ${ALLOWED.join(', ')}`)
  const r = await query(
    `UPDATE qc.assignments SET status=@s, updated_at=SYSUTCDATETIME(), updated_by_user_id=@actor
     WHERE id=@id AND deleted_at IS NULL`, { id, s: status, actor: actorId ?? null })
  if (!r.rowsAffected?.[0]) throw appError(404, 'Asignación no encontrada')
}

export async function cancelAssignment(id, actorId) {
  const r = await query(
    `UPDATE qc.assignments SET status='cancelada', updated_at=SYSUTCDATETIME(), updated_by_user_id=@actor
     WHERE id=@id AND deleted_at IS NULL`, { id, actor: actorId ?? null })
  if (!r.rowsAffected?.[0]) throw appError(404, 'Asignación no encontrada')
}

export async function createAssignment({ lot, producer, variety, commodity, inspector_email, pallet_number, arrival_id, instructions }, actorId) {
  if (!lot || !producer) throw appError(400, 'Lote y Productor son obligatorios')
  if (!inspector_email) throw appError(400, 'Debes seleccionar un inspector')

  const insp = await query(
    `SELECT id FROM qc.users WHERE email=@e AND role='inspector' AND active=1 AND deleted_at IS NULL`,
    { e: String(inspector_email).trim().toLowerCase() })
  if (!insp.recordset?.length) throw appError(404, 'Inspector no encontrado o inactivo')
  const inspectorId = insp.recordset[0].id

  const commodityRow = commodity ? await getCommodityByCode(commodity) : null

  return withTransaction(async (tx) => {
    let lotId = null
    if (commodityRow) {
      const producerId = await findOrCreateProducer(tx, producer)
      lotId = await findOrCreateLot(tx, { commodityId: commodityRow.id, lotCode: lot, producerId, variety })
    }
    const r = await txRequest(tx, {
      uid: inspectorId, lid: lotId, cid: commodityRow?.id ?? null,
      producer: String(producer).trim(), lot: String(lot).trim(),
      variety: variety ? String(variety).trim() : null,
      pallet: pallet_number ? String(pallet_number).trim().slice(0, 50) : null,
      arrival: arrival_id ? Number(arrival_id) : null,
      instr: instructions ? String(instructions).trim() : null,
    }).query(
      `INSERT INTO qc.assignments (user_id, lot_id, commodity_id, producer, lot, variety, pallet_number, arrival_id, instructions, status)
       OUTPUT INSERTED.id VALUES (@uid, @lid, @cid, @producer, @lot, @variety, @pallet, @arrival, @instr, 'pendiente')`)
    return r.recordset[0].id
  }, { actorId })
}
