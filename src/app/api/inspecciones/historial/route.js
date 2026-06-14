import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { listAll } from '@/lib/repos/inspections'

export async function GET(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    return ok(await listAll(500))
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('inspecciones/historial', e)
  }
}
