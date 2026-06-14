// src/app/api/users/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { listUsers, createUser } from '@/lib/repos/users'

export async function GET(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    return ok(await listUsers())
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('GET /users', e)
  }
}

export async function POST(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const body = await req.json().catch(() => ({}))
    const id = await createUser(body)
    return ok({ ok: true, id, msg: 'Usuario creado exitosamente' }, 201)
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('POST /users', e)
  }
}
