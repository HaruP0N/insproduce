// src/app/api/inspecciones/[id]/metrics/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { replaceMeasurements } from '@/lib/repos/inspections'

export async function PUT(req, context) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response
  try {
    const { id } = await context.params
    const nid = Number(id)
    if (!Number.isInteger(nid) || nid <= 0) return fail(400, 'ID inválido')
    const body = await req.json().catch(() => ({}))
    if (!body.values || typeof body.values !== 'object') return fail(400, 'values requerido')
    const { unknownKeys } = await replaceMeasurements(nid, body.values, auth.user)
    return ok({ ok: true, id: nid, warnings: { unknownKeys } })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('PUT inspecciones/:id/metrics', e)
  }
}
