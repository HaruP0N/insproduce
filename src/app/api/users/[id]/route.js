// src/app/api/users/[id]/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { updateUser, setUserActive, softDeleteUser } from '@/lib/repos/users'

function parseId(params) {
  const id = Number(params?.id)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function PUT(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const id = parseId(await context.params)
    if (!id) return fail(400, 'ID inválido')
    await updateUser(id, await req.json().catch(() => ({})), auth.user.id)
    return ok({ ok: true, msg: 'Usuario actualizado' })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('PUT /users/:id', e)
  }
}

export async function PATCH(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const id = parseId(await context.params)
    if (!id) return fail(400, 'ID inválido')
    const { active } = await req.json().catch(() => ({}))
    if (typeof active !== 'boolean') return fail(400, 'Campo active requerido')
    await setUserActive(id, active, auth.user.id)
    return ok({ ok: true, msg: active ? 'Usuario activado' : 'Usuario desactivado' })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('PATCH /users/:id', e)
  }
}

export async function DELETE(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const id = parseId(await context.params)
    if (!id) return fail(400, 'ID inválido')
    await softDeleteUser(id, auth.user.id)
    return ok({ ok: true, msg: 'Usuario eliminado' })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('DELETE /users/:id', e)
  }
}
