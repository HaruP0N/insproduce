// src/app/api/ops/inspecciones/route.js — inspecciones del inspector (las que creó)
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { listByCreator } from '@/lib/repos/inspections'

export async function GET(req) {
  const auth = requireAuth(req, { role: 'inspector' })
  if (auth.response) return auth.response
  try {
    return ok(await listByCreator(auth.user.id))
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('ops/inspecciones', e)
  }
}
