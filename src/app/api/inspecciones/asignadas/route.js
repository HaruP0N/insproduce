// src/app/api/inspecciones/asignadas/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { query } from '@/lib/db/mssql'

export async function GET(req) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok || !v.user) return NextResponse.json({ msg: 'No autenticado' }, { status: 401 })

  try {
    const result = await query(
      `SELECT id, created_at, producer, lot, variety, commodity_code,
              status, user_id, notes_admin
       FROM assignments
       WHERE user_id = @userId AND status = 'pendiente'
       ORDER BY created_at DESC`,
      { userId: v.user.id }
    )

    const inspecciones = result.recordset?.map(row => ({
      id:             row.id,
      created_at:     row.created_at,
      producer:       row.producer,
      lot:            row.lot,
      variety:        row.variety,
      commodity_code: row.commodity_code,
      status:         row.status,
      notes_admin:    row.notes_admin,
      caliber:        null,
      packaging_type: null
    })) || []

    return NextResponse.json({ inspecciones })
  } catch (e) {
    console.error('[asignadas]', e)
    return NextResponse.json({ msg: 'Error al cargar: ' + e.message }, { status: 500 })
  }
}