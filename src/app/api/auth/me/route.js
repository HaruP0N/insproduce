// src/app/api/auth/me/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { getUserById } from '@/lib/repos/users'

export async function GET(req) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response
  try {
    const user = await getUserById(auth.user.id)
    if (!user) return fail(401, 'Usuario no encontrado')
    return ok({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  } catch (e) {
    return serverError('auth/me', e)
  }
}
