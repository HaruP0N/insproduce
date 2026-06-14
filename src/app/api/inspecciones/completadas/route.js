// src/app/api/inspecciones/completadas/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { listByCreator } from '@/lib/repos/inspections'

export async function GET(req) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response
  try {
    return ok({ inspecciones: await listByCreator(auth.user.id) })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('completadas', e)
  }
}
