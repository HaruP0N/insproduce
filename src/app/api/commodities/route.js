import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
// 🔧 CAMBIAR A COOKIES
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'

export async function GET(req) {
  // 🔧 SIN AWAIT
  const v = verifyTokenFromCookies(req)
  if (!v.ok) {
    return NextResponse.json({ msg: v.msg }, { status: v.status })
  }

  try {
    const r = await query(
      `SELECT id, code, name
       FROM commodities
       WHERE active = 1 AND code <> 'CHERRY'
       ORDER BY name ASC`
    )

    return NextResponse.json(r.recordset)
  } catch (e) {
    console.error('[commodities]', e)
    return NextResponse.json(
      { msg: 'Error al cargar commodities' },
      { status: 500 }
    )
  }
}