import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { getStandardDetail } from '@/lib/repos/tolerances'

export async function GET(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const { id } = await context.params
    const nid = Number(id)
    if (!Number.isInteger(nid) || nid <= 0) return fail(400, 'ID inválido')
    return ok(await getStandardDetail(nid))
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('standards/:id GET', e)
  }
}
