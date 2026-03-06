// src/app/api/users/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import bcrypt from 'bcryptjs'

export async function GET(req) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok || !v.user) return NextResponse.json({ msg: v.msg }, { status: v.status || 401 })
  if (v.user.role !== 'admin') return NextResponse.json({ msg: 'Solo admin puede ver usuarios' }, { status: 403 })

  try {
    const r = await query(
      `SELECT id, name, email, role, CAST(active AS int) as active, created_at
       FROM users ORDER BY created_at DESC`
    )
    return NextResponse.json(r.recordset || [])
  } catch (e) {
    console.error('[GET /api/users]', e)
    return NextResponse.json({ msg: 'Error al obtener usuarios' }, { status: 500 })
  }
}

export async function POST(req) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok || !v.user) return NextResponse.json({ msg: v.msg }, { status: v.status || 401 })
  if (v.user.role !== 'admin') return NextResponse.json({ msg: 'Solo admin puede crear usuarios' }, { status: 403 })

  try {
    const body = await req.json().catch(() => ({}))
    const { name, email, password, role } = body

    if (!name || !email || !password || !role)
      return NextResponse.json({ msg: 'Todos los campos son requeridos' }, { status: 400 })

    if (!['admin', 'inspector'].includes(role))
      return NextResponse.json({ msg: 'Rol inválido. Debe ser "admin" o "inspector"' }, { status: 400 })

    const existing = await query(`SELECT id FROM users WHERE email = @email`, { email })
    if (existing.recordset?.length)
      return NextResponse.json({ msg: 'El email ya está registrado' }, { status: 400 })

    const passwordHash = await bcrypt.hash(password, 10)

    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, active)
       OUTPUT INSERTED.id
       VALUES (@name, @email, @password_hash, @role, 1)`,
      { name, email, password_hash: passwordHash, role }
    )

    return NextResponse.json({ ok: true, id: result.recordset[0].id, msg: 'Usuario creado exitosamente' }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/users]', e)
    return NextResponse.json({ msg: 'Error al crear usuario: ' + e.message }, { status: 500 })
  }
}