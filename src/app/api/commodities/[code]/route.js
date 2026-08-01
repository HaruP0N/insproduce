import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { updateCommodity } from '@/lib/repos/catalog'

export async function PUT(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const { code } = await context.params
    const body = await req.json().catch(() => null)
    if (!body) return fail(400, 'Body JSON inválido')
    await updateCommodity(code, body)
    return ok({ ok: true })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('commodities PUT', e)
  }
}
