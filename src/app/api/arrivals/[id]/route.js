import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { getArrival, softDeleteArrival, updateArrival } from '@/lib/repos/arrivals'

const parseId = async (context) => {
  const { id } = await context.params
  const nid = Number(id)
  return Number.isInteger(nid) && nid > 0 ? nid : null
}

export async function GET(req, context) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response
  try {
    const nid = await parseId(context)
    if (!nid) return fail(400, 'ID inválido')
    return ok(await getArrival(nid))
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('arrivals/:id GET', e)
  }
}

export async function PUT(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const nid = await parseId(context)
    if (!nid) return fail(400, 'ID inválido')
    const body = await req.json().catch(() => null)
    if (!body || !String(body.container || '').trim()) return fail(400, 'container requerido')
    await updateArrival(nid, body)
    return ok({ ok: true })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('arrivals/:id PUT', e)
  }
}

export async function DELETE(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const nid = await parseId(context)
    if (!nid) return fail(400, 'ID inválido')
    await softDeleteArrival(nid)
    return ok({ ok: true })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('arrivals/:id DELETE', e)
  }
}
