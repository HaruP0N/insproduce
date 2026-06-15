import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { upsertDefectTolerances } from '@/lib/repos/tolerances'

// PUT — reemplaza las bandas de tolerancia de un defecto en el estándar.
export async function PUT(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const { id } = await context.params
    const nid = Number(id)
    if (!Number.isInteger(nid) || nid <= 0) return fail(400, 'ID inválido')
    const body = await req.json().catch(() => null)
    if (!body?.defect_id) return fail(400, 'defect_id requerido')
    await upsertDefectTolerances(nid, Number(body.defect_id), body.bands || [])
    return ok({ ok: true })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('standards/:id/tolerances PUT', e)
  }
}
