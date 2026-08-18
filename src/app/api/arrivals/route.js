import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { listArrivals, createArrival } from '@/lib/repos/arrivals'

export async function GET(req) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response
  try {
    return ok(await listArrivals())
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('arrivals GET', e)
  }
}

export async function POST(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const body = await req.json().catch(() => null)
    if (!body) return fail(400, 'Body JSON inválido')
    const id = await createArrival(body, auth.user.id)
    return ok({ ok: true, id })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('arrivals POST', e)
  }
}
