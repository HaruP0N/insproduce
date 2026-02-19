// src/app/api/inspecciones/asignadas/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { query } from '@/lib/db/mssql'

export async function GET(req) {
  console.log('🔍 [GET /api/inspecciones/asignadas] Iniciando...')
  
  const v = verifyTokenFromCookies(req)
  
  console.log('📊 Verificación:', {
    ok: v.ok,
    hasUser: !!v.user,
    userId: v.user?.id
  })
  
  if (!v.ok || !v.user) {
    console.log('❌ No autenticado')
    return NextResponse.json({ msg: 'No autenticado' }, { status: 401 })
  }

  try {
    console.log('🔍 Buscando asignaciones para usuario:', v.user.id)
    
    const result = await query(
      `SELECT 
        id, 
        created_at, 
        producer, 
        lot, 
        variety,
        commodity_code,
        status,
        user_id,
        notes_admin
       FROM assignments
       WHERE user_id = @userId
         AND status = 'pendiente'
       ORDER BY created_at DESC`,
      { userId: v.user.id }
    )

    console.log('✅ Asignaciones encontradas:', result.recordset?.length || 0)

    // Mapear a formato que espera el frontend
    const inspecciones = result.recordset?.map(row => ({
      id: row.id,
      created_at: row.created_at,
      producer: row.producer,
      lot: row.lot,
      variety: row.variety,
      commodity_code: row.commodity_code, // ← ACTUALIZADO
      status: row.status,
      notes_admin: row.notes_admin,
      caliber: null,
      packaging_type: null
    })) || []

    return NextResponse.json({
      inspecciones
    })

  } catch (e) {
    console.error('❌ [asignadas] Error:', e)
    console.error('Stack:', e.stack)
    return NextResponse.json({ 
      msg: 'Error al cargar: ' + e.message 
    }, { status: 500 })
  }
}