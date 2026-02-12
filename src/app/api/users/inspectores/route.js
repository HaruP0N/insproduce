import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'

export async function GET(req) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })
  if (v.user.role !== 'admin') {
    return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })
  }

  try {
    const r = await query(`SELECT id, email, role, active FROM users ORDER BY id`)
    return NextResponse.json(r.recordset || [])
  } catch (e) {
    console.error('[GET /api/users]', e)
    return NextResponse.json({ msg: 'Error al obtener usuarios' }, { status: 500 })
  }
}