// src/app/api/google-sheets/load/route.js
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { sheetsClient } from '@/lib/googleSheets'
import { query } from '@/lib/db/mssql'

export async function GET(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID
    if (!spreadsheetId) return fail(400, 'GOOGLE_SHEET_ID no configurado')

    const rows = await sheetsClient.readSheet(spreadsheetId)
    if (!rows || rows.length === 0) return ok({ inspecciones: [] })

    const inspecciones = sheetsClient.parseRows(rows)
    for (const insp of inspecciones) {
      const idInspeccion = insp['ID Inspección'] || insp['ID'] || insp['id'] || ''
      if (!idInspeccion) continue
      try {
        const r = await query(
          `SELECT c.code AS commodity_code FROM qc.assignments a
           LEFT JOIN qc.commodities c ON c.id = a.commodity_id WHERE a.id = @id`,
          { id: parseInt(idInspeccion) })
        if (r.recordset?.length) insp.commodity_code = r.recordset[0].commodity_code
      } catch { /* fila sin id válido: se ignora */ }
    }
    return ok({ inspecciones })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('google-sheets/load', e)
  }
}
