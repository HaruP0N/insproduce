import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { listCommodities } from '@/lib/repos/catalog'

export async function GET(req) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response
  try {
    return ok(await listCommodities())
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('commodities', e)
  }
}
