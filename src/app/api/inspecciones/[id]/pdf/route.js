// src/app/api/inspecciones/[id]/pdf/route.js
import { NextResponse } from 'next/server'
import { requireAuth, authorizeOwnership } from '@/lib/auth/requireAuth'
import { fail, serverError } from '@/lib/http'
import { query } from '@/lib/db/mssql'
import { getLatestPdf } from '@/lib/repos/inspections'

export async function GET(req, context) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response
  try {
    const { id } = await context.params
    const nid = Number(id)
    if (!Number.isInteger(nid) || nid <= 0) return fail(400, 'ID inválido')

    const own = await query(`SELECT created_by_user_id FROM qc.inspections WHERE id=@id AND deleted_at IS NULL`, { id: nid })
    if (!own.recordset?.length) return fail(404, 'Inspección no encontrada')
    if (!authorizeOwnership(auth.user, [own.recordset[0].created_by_user_id])) return fail(403, 'Sin permiso sobre esta inspección')

    const pdf = await getLatestPdf(nid)
    if (pdf?.status === 'ERROR') return fail(500, `Error al generar PDF: ${pdf.error_message || 'desconocido'}`)
    if (!pdf || pdf.status === 'PENDING' || !pdf.pdf_url) return fail(404, 'PDF aún no generado.')
    return NextResponse.redirect(pdf.pdf_url, 302)
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('pdf', e)
  }
}
