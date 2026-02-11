import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'

export async function GET(req) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ ok: false, msg: v.msg }, { status: v.status })

  try {
    const userId = Number(v.payload?.id)
    if (!userId) return NextResponse.json({ ok: false, msg: 'Token sin id' }, { status: 401 })

    const r = await query(
      `SELECT TOP 1 id, email, role
       FROM users
       WHERE id=@id`,
      { id: userId }
    )

    const user = r.recordset?.[0]
    if (!user) return NextResponse.json({ ok: false, msg: 'Usuario no encontrado' }, { status: 401 })

    return NextResponse.json({ ok: true, user })
  } catch (e) {
    console.error('[auth/me]', e)
    return NextResponse.json({ ok: false, msg: 'Error en /auth/me' }, { status: 500 })
  }
}
