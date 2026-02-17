import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'

export async function PUT(req, context) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  try {
    const params = await context.params
    const id = Number(params?.id)
    
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ msg: 'ID inválido' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const { template_id, template_version, values } = body

    if (!values || typeof values !== 'object') {
      return NextResponse.json({ msg: 'values requerido' }, { status: 400 })
    }

    const metricsObj = {
      template_id: template_id ?? null,
      template_version: template_version ?? null,
      values
    }

    const metricsJson = JSON.stringify(metricsObj)

    // Actualizar métricas
    await query(
      `UPDATE inspections 
       SET metrics = @metrics, updated_at = GETDATE()
       WHERE id = @id`,
      { id, metrics: metricsJson }
    )

    // Invalidar PDF (está en tabla separada inspection_pdfs)
    await query(
      `UPDATE inspection_pdfs 
       SET status = 'PENDING', pdf_url = NULL, pdf_hash = NULL, updated_at = GETDATE()
       WHERE inspection_id = @id`,
      { id }
    )

    return NextResponse.json({ ok: true, id })
  } catch (e) {
    console.error('[PUT /inspecciones/[id]/metrics]', e)
    return NextResponse.json({ msg: 'Error al actualizar métricas' }, { status: 500 })
  }
}