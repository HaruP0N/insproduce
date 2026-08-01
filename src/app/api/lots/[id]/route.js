import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { updateLot } from '@/lib/repos/catalog'

export async function PUT(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const { id } = await context.params
    const nid = Number(id)
    if (!Number.isInteger(nid) || nid <= 0) return fail(400, 'ID inválido')
    const body = await req.json().catch(() => null)
    if (!body) return fail(400, 'Body JSON inválido')
    await updateLot(nid, body)
    return ok({ ok: true })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('lots PUT', e)
  }
}
