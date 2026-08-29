// Notas tipificadas del reporte del arribo (Quality & Condition, Temperature, …)
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { saveArrivalNotes } from '@/lib/repos/arrivals'

export async function PUT(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const { id } = await context.params
    const nid = Number(id)
    if (!Number.isInteger(nid) || nid <= 0) return fail(400, 'ID inválido')
    const body = await req.json().catch(() => null)
    if (!Array.isArray(body?.notes)) return fail(400, 'notes debe ser una lista {type, note}')
    await saveArrivalNotes(nid, body.notes)
    return ok({ ok: true })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('arrivals/:id/notes', e)
  }
}
