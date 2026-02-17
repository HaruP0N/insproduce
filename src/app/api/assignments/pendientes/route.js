// src/app/api/assignments/pendientes/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { query } from '@/lib/db/mssql'

export async function GET(req) {
  console.log('🔍 [GET /api/assignments/pendientes] Iniciando...')
  
  const v = verifyTokenFromCookies(req)
  
  if (!v.ok || !v.user) {
    return NextResponse.json({ msg: 'No autenticado' }, { status: 401 })
  }

  if (v.user.role !== 'admin') {
    return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })
  }

  try {
    const result = await query(
      `SELECT 
        a.id,
        a.created_at,
        a.producer,
        a.lot,
        a.variety,
        a.status,
        a.notes_admin,
        u.id as inspector_id,
        u.name as inspector_name,
        u.email as inspector_email
       FROM assignments a
       INNER JOIN users u ON a.user_id = u.id
       WHERE a.status = 'pendiente'
       ORDER BY a.created_at DESC`
    )

    console.log('✅ Asignaciones pendientes:', result.recordset?.length || 0)

    return NextResponse.json({
      asignaciones: result.recordset || []
    })

  } catch (e) {
    console.error('❌ [pendientes]', e)
    return NextResponse.json({ 
      msg: 'Error: ' + e.message 
    }, { status: 500 })
  }
}