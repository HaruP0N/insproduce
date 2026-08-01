import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { listCommodities, listCommoditiesAdmin, createCommodity } from '@/lib/repos/catalog'

export async function GET(req) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response
  try {
    const all = new URL(req.url).searchParams.get('all')
    if (all && auth.user.role === 'admin') return ok(await listCommoditiesAdmin())
    return ok(await listCommodities())
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('commodities', e)
  }
}

export async function POST(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const body = await req.json().catch(() => null)
    if (!body) return fail(400, 'Body JSON inválido')
    const id = await createCommodity(body)
    return ok({ ok: true, id })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('commodities POST', e)
  }
}
