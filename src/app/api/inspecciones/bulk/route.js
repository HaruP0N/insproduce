// Importación masiva: recibe las filas ya parseadas en el navegador y crea una
// inspección por fila. Cada fila es independiente — si una falla, las demás siguen.
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { createInspection } from '@/lib/repos/inspections'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_ROWS = 500

export async function POST(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response

  const body = await req.json().catch(() => null)
  const rows = Array.isArray(body?.rows) ? body.rows : null
  if (!rows) return fail(400, 'rows requerido')
  if (!rows.length) return fail(400, 'No hay filas para importar')
  if (rows.length > MAX_ROWS) return fail(400, `Máximo ${MAX_ROWS} filas por carga`)

  const created = []
  const failed = []
  try {
    for (const r of rows) {
      const excelRow = r.__row ?? null
      try {
        const payload = { ...r }
        delete payload.__row
        if (body.standard_id) payload.standard_id = body.standard_id
        if (body.arrival_id) payload.arrival_id = body.arrival_id
        const { id, warnings } = await createInspection(auth.user, payload)
        created.push({ row: excelRow, id, lot: r.lot, unknownKeys: warnings?.unknownKeys || [] })
      } catch (e) {
        failed.push({ row: excelRow, lot: r.lot || null, msg: e?.message || 'error' })
      }
    }
    return ok({ ok: true, created: created.length, failed: failed.length, details: { created, failed } })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('inspecciones/bulk', e)
  }
}
