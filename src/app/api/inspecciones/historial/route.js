import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'

export async function GET(req) {
  const v = await verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  if (v.payload?.role !== 'admin') {
    return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })
  }

  try {
    const r = await query(
      `SELECT TOP 500
         id, created_at, updated_at,
         producer, lot, variety, caliber,
         packaging_code, packaging_type, packaging_date,
         notes, metrics,
         created_by_user_id,
         commodity_code, commodity_name,
         pdf_status, pdf_url
       FROM dbo.vw_inspections_admin
       ORDER BY created_at DESC`
    )
    return NextResponse.json(r.recordset || [])
  } catch (e) {
    console.error('[inspections/historial]', e)
    return NextResponse.json({ msg: 'Error historial' }, { status: 500 })
  }
}
