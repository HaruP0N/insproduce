// src/app/api/google-sheets/add-row/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { sheetsClient } from '@/lib/googleSheets'
import { createAssignment } from '@/lib/repos/assignments'

export async function POST(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID
    if (!spreadsheetId) return fail(400, 'GOOGLE_SHEET_ID no configurado')

    const body = await req.json().catch(() => ({}))
    const { producer, lot, variety, commodity, inspector, estado } = body
    const id = await createAssignment(
      { lot, producer, variety, commodity, inspector_email: inspector }, auth.user.id)

    const rows = await sheetsClient.readSheet(spreadsheetId)
    const nextRow = rows.length + 1
    await sheetsClient.writeSheet(
      spreadsheetId, `A${nextRow}:G${nextRow}`,
      [[producer, lot, variety || '', commodity || '', inspector || '', estado || 'Pendiente', id]])

    return ok({ msg: 'Asignación creada', id, rowNumber: nextRow })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('google-sheets/add-row', e)
  }
}
