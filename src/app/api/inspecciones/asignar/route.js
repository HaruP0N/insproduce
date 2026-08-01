// src/app/api/inspecciones/asignar/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { createAssignment } from '@/lib/repos/assignments'

export async function POST(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const body = await req.json().catch(() => ({}))
    const id = await createAssignment(body, auth.user.id)
    return ok({ msg: 'Inspección asignada exitosamente', assignment_id: id })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('inspecciones/asignar', e)
  }
}
