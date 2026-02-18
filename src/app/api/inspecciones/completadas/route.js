// src/app/api/inspecciones/completadas/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { query } from '@/lib/db/mssql'

export async function GET(req) {
  const v = verifyTokenFromCookies(req)
  
  if (!v.ok || !v.user) {
    return NextResponse.json({ msg: 'No autenticado' }, { status: 401 })
  }

  try {
    // Todas las inspecciones del usuario son "completadas" (ya fueron guardadas)
    // No hay columna "status" en la tabla inspections
    const result = await query(
      `SELECT 
        i.id, 
        i.created_at, 
        i.producer, 
        i.lot, 
        i.variety, 
        i.caliber,
        c.code AS commodity_code,
        c.name AS commodity_name,
        i.packaging_type,
        p.pdf_url
       FROM inspections i
       LEFT JOIN commodities c ON c.id = i.commodity_id
       LEFT JOIN inspection_pdfs p ON p.inspection_id = i.id
       WHERE i.created_by_user_id = @userId
       ORDER BY i.created_at DESC`,
      { userId: v.user.id }
    )

    return NextResponse.json({
      inspecciones: result.recordset || []
    })

  } catch (e) {
    console.error('[completadas]', e)
    return NextResponse.json({ 
      msg: 'Error al cargar: ' + e.message 
    }, { status: 500 })
  }
}