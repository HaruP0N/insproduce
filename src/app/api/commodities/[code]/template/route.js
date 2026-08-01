// src/app/api/commodities/[code]/template/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { getTemplateFieldsByCommodityCode } from '@/lib/repos/catalog'

export async function GET(req, context) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response
  try {
    const params = await context.params
    const code = String(params?.code || '').trim().toUpperCase()
    if (!code) return fail(400, 'code requerido')
    if (code === 'CHERRY') return fail(400, 'CHERRY deshabilitado')
    const { commodity, template, fields } = await getTemplateFieldsByCommodityCode(code)
    return ok({ commodity, template, fields })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('commodities/template', e)
  }
}
