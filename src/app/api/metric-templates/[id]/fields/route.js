// src/app/api/metric-templates/[id]/fields/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { replaceTemplateFields } from '@/lib/repos/templates'

export async function PUT(req, { params }) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const p = await params
    const id = Number(p?.id)
    if (!Number.isInteger(id) || id <= 0) return fail(400, 'templateId inválido')
    const body = await req.json().catch(() => ({}))
    await replaceTemplateFields(id, body.fields, auth.user.id)
    return ok({ ok: true })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('metric-templates/:id/fields', e)
  }
}
