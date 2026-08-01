import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { listPendientes } from '@/lib/repos/assignments'

export async function GET(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    return ok({ asignaciones: await listPendientes() })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('assignments/pendientes', e)
  }
}
