// src/app/api/inspecciones/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { createInspection, listByCreator } from '@/lib/repos/inspections'

// POST — crear inspección (modelo qc: cabecera + mediciones + fotos + resultados, transaccional)
export async function POST(req) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return fail(400, 'Body JSON inválido')

  try {
    const { id, warnings } = await createInspection(auth.user, body)
    return ok({ ok: true, id, warnings })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('POST /inspecciones', e)
  }
}

// GET — inspecciones creadas por el usuario
export async function GET(req) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response
  try {
    return ok(await listByCreator(auth.user.id))
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('GET /inspecciones', e)
  }
}
