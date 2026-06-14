import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { listLots } from '@/lib/repos/catalog'

export async function GET(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    return ok(await listLots())
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('lots', e)
  }
}
