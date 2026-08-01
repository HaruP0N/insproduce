// src/app/api/inspecciones/[id]/generar-pdf/route.js
import { requireAuth, authorizeOwnership } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { query } from '@/lib/db/mssql'
import { buildPdfInput, recordPdfVersion } from '@/lib/repos/inspections'
import { generateInspectionPDF, uploadPDFToCloudinary } from '@/lib/pdf'

export async function POST(req, context) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response
  let nid
  try {
    const { id } = await context.params
    nid = Number(id)
    if (!Number.isInteger(nid) || nid <= 0) return fail(400, 'ID inválido')

    const own = await query(`SELECT created_by_user_id FROM qc.inspections WHERE id=@id AND deleted_at IS NULL`, { id: nid })
    if (!own.recordset?.length) return fail(404, 'Inspección no encontrada')
    if (!authorizeOwnership(auth.user, [own.recordset[0].created_by_user_id])) return fail(403, 'Sin permiso sobre esta inspección')

    const report = await buildPdfInput(nid)
    const buffer = await generateInspectionPDF(report)
    const ts = Date.now()
    const { url, public_id } = await uploadPDFToCloudinary(buffer, `inspeccion-${nid}-${ts}`)
    await recordPdfVersion(nid, { status: 'OK', url, hash: public_id }, auth.user.id)
    return ok({ ok: true, id: nid, pdf_url: url, msg: 'PDF generado exitosamente' })
  } catch (e) {
    try { if (nid) await recordPdfVersion(nid, { status: 'ERROR', error: e.message }, auth.user.id) } catch { /* noop */ }
    if (e.status) return fail(e.status, e.message)
    return serverError('generar-pdf', e)
  }
}
