// src/app/api/metric-templates/code/[code]/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { getTemplateFieldsByCommodityCode } from '@/lib/repos/catalog'

export async function GET(req, context) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response

  const params = await context.params
  const code = String(params?.code || '').trim().toUpperCase()
  if (!code) return fail(400, 'code requerido')

  try {
    const { template, fields } = await getTemplateFieldsByCommodityCode(code)
    if (!template) return fail(404, `Commodity sin plantilla: ${code}`)
    return ok({ template: { id: template.id, name: template.name, version: template.version }, fields })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('metric-templates/code', e)
  }
}
