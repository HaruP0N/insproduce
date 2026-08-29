// src/app/api/inspecciones/asignadas/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { query } from '@/lib/db/mssql'

export async function GET(req) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response
  try {
    const r = await query(
      `SELECT a.id, a.created_at, a.producer, a.lot, a.variety, a.pallet_number, a.arrival_id,
              c.code AS commodity_code, a.status, a.instructions AS notes_admin
       FROM qc.assignments a
       LEFT JOIN qc.commodities c ON c.id = a.commodity_id
       WHERE a.user_id = @uid AND a.status = 'pendiente' AND a.deleted_at IS NULL
       ORDER BY a.created_at DESC`,
      { uid: auth.user.id })
    const inspecciones = (r.recordset || []).map(row => ({
      ...row, caliber: null, packaging_type: null
    }))
    return ok({ inspecciones })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('asignadas', e)
  }
}
