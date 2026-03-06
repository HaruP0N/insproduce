// src/app/api/inspecciones/[id]/pdf/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'

export async function GET(req, context) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  try {
    const params = await context.params
    const id = Number(params?.id)

    if (!Number.isInteger(id) || id <= 0)
      return NextResponse.json({ msg: 'ID inválido' }, { status: 400 })

    const result = await query(
      `SELECT pdf_url, status, error_message FROM inspection_pdfs WHERE inspection_id = @id`,
      { id }
    )

    if (!result.recordset?.length)
      return NextResponse.json({ msg: 'PDF no encontrado. Genera el PDF primero.' }, { status: 404 })

    const { pdf_url, status, error_message } = result.recordset[0]

    if (status === 'ERROR')
      return NextResponse.json({ msg: `Error al generar PDF: ${error_message || 'Error desconocido'}` }, { status: 500 })

    if (status === 'PENDING' || !pdf_url)
      return NextResponse.json({ msg: 'PDF aún no generado.' }, { status: 404 })

    return NextResponse.redirect(pdf_url, 302)
  } catch (e) {
    console.error('[pdf]', e)
    return NextResponse.json({ msg: 'Error al obtener PDF: ' + e.message }, { status: 500 })
  }
}