// src/app/api/assignments/[id]/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { getAssignment, updateStatus, cancelAssignment } from '@/lib/repos/assignments'

function parseId(params) {
  const id = Number(params?.id)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function GET(req, context) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response
  try {
    const id = parseId(await context.params)
    if (!id) return fail(400, 'ID inválido')
    return ok(await getAssignment(id, auth.user))
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('GET assignments/:id', e)
  }
}

export async function PATCH(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const id = parseId(await context.params)
    if (!id) return fail(400, 'ID inválido')
    const { status } = await req.json().catch(() => ({}))
    await updateStatus(id, status, auth.user.id)
    return ok({ ok: true, msg: `Estado cambiado a "${status}"` })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('PATCH assignments/:id', e)
  }
}

export async function DELETE(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const id = parseId(await context.params)
    if (!id) return fail(400, 'ID inválido')
    await cancelAssignment(id, auth.user.id)
    return ok({ ok: true, msg: 'Asignación cancelada' })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('DELETE assignments/:id', e)
  }
}
