// src/app/api/metric-templates/[id]/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { getTemplateById, replaceTemplateFields } from '@/lib/repos/templates'

function parseId(params) {
  const id = Number(params?.id)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function GET(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const id = parseId(await context.params)
    if (!id) return fail(400, 'templateId inválido')
    return ok(await getTemplateById(id))
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('metric-templates/:id GET', e)
  }
}

export async function PUT(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const id = parseId(await context.params)
    if (!id) return fail(400, 'templateId inválido')
    const body = await req.json().catch(() => ({}))
    await replaceTemplateFields(id, body.fields, auth.user.id)
    return ok({ ok: true })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('metric-templates/:id PUT', e)
  }
}
