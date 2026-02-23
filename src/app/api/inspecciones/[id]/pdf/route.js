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
    
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ msg: 'ID inválido' }, { status: 400 })
    }

    console.log(`[pdf] Solicitando PDF para inspección #${id}`)

    // Obtener URL del PDF desde la BD
    const result = await query(
      `SELECT pdf_url, status, error_message
       FROM inspection_pdfs 
       WHERE inspection_id = @id`,
      { id }
    )

    if (!result.recordset?.length) {
      return NextResponse.json({ 
        msg: 'PDF no encontrado. Genera el PDF primero haciendo click en "⚙️ Generar PDF".' 
      }, { status: 404 })
    }

    const { pdf_url, status, error_message } = result.recordset[0]

    if (status === 'ERROR') {
      return NextResponse.json({ 
        msg: `Error al generar PDF: ${error_message || 'Error desconocido'}` 
      }, { status: 500 })
    }

    if (status === 'PENDING' || !pdf_url) {
      return NextResponse.json({ 
        msg: 'PDF aún no generado. Intenta generar el PDF primero.' 
      }, { status: 404 })
    }

    console.log(`[pdf] Redirigiendo a Cloudinary: ${pdf_url}`)

    // Redirigir a la URL de Cloudinary
    return NextResponse.redirect(pdf_url, 302)

  } catch (e) {
    console.error('[pdf] Error:', e)
    return NextResponse.json({ 
      msg: 'Error al obtener PDF: ' + e.message 
    }, { status: 500 })
  }
}