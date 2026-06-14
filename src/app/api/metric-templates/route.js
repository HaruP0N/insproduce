// src/app/api/metric-templates/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { createTemplate } from '@/lib/repos/templates'

export async function POST(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const body = await req.json().catch(() => ({}))
    const { templateId, version } = await createTemplate({
      commodityCode: String(body.commodityCode || '').trim().toUpperCase(),
      name: body.name, fields: body.fields
    }, auth.user.id)
    return ok({ ok: true, templateId, version })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('metric-templates POST', e)
  }
}
