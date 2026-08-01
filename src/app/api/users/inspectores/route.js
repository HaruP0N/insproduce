// src/app/api/users/inspectores/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { listInspectors } from '@/lib/repos/users'

export async function GET(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    return ok(await listInspectors())
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('users/inspectores', e)
  }
}
