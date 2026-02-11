import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'

export async function GET(req) {
  const v = await verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  if (v.payload?.role !== 'inspector') {
    return NextResponse.json({ msg: 'Solo inspector' }, { status: 403 })
  }

  const myId = Number(v.payload?.id)
  try {
    const r = await query(
      `SELECT TOP 200
         i.id, i.created_at, i.updated_at,
         i.producer, i.lot, i.variety, i.caliber,
         i.packaging_code, i.packaging_type, i.packaging_date,
         i.notes, i.metrics,
         c.code AS commodity_code,
         c.name AS commodity_name,
         p.status AS pdf_status,
         p.pdf_url
       FROM dbo.inspections i
       JOIN dbo.commodities c ON c.id=i.commodity_id
       LEFT JOIN dbo.inspection_pdfs p ON p.inspection_id=i.id
       WHERE i.assigned_to_user_id=@myId
       ORDER BY i.created_at DESC`,
      { myId }
    )

    return NextResponse.json(r.recordset || [])
  } catch (e) {
    console.error('[ops/inspections]', e)
    return NextResponse.json({ msg: 'Error cargando asignadas' }, { status: 500 })
  }
}
