// Manifiesto del contenedor: el Excel se parsea en el navegador; aquí llegan
// las filas ya normalizadas y se reemplaza el manifiesto completo.
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { saveArrivalManifest } from '@/lib/repos/arrivals'

const MAX_ROWS = 2000

export async function PUT(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const { id } = await context.params
    const nid = Number(id)
    if (!Number.isInteger(nid) || nid <= 0) return fail(400, 'ID inválido')
    const body = await req.json().catch(() => null)
    const rows = body?.rows
    if (!Array.isArray(rows) || !rows.length) return fail(400, 'rows requerido')
    if (rows.length > MAX_ROWS) return fail(400, `Máximo ${MAX_ROWS} filas`)
    if (rows.some((r) => !String(r?.pallet_code || '').trim())) return fail(400, 'Toda fila necesita pallet_code')
    const n = await saveArrivalManifest(nid, rows)
    return ok({ ok: true, rows: n })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('arrivals/:id/manifest', e)
  }
}
