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
      `SELECT id, email, role
       FROM dbo.users
       WHERE role='inspector'
       ORDER BY email ASC`
    )
    return NextResponse.json(r.recordset || [])
  } catch (e) {
    console.error('[users/inspectors]', e)
    return NextResponse.json({ msg: 'Error listando inspectores' }, { status: 500 })
  }
}
