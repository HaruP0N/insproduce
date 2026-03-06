// src/app/api/auth/login/route.js
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { query } from '@/lib/db/mssql'

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const email    = String(body.email    || '').trim().toLowerCase()
    const password = String(body.password || '').trim()

    if (!email || !password)
      return NextResponse.json({ msg: 'Email y contraseña requeridos' }, { status: 400 })

    const r = await query(
      `SELECT TOP 1 id, name, email, password_hash, role, active
       FROM users WHERE email = @email`,
      { email }
    )

    const user = r.recordset?.[0]
    if (!user) return NextResponse.json({ msg: 'Credenciales inválidas' }, { status: 401 })
    if (!user.active) return NextResponse.json({ msg: 'Usuario inactivo. Contacte al administrador.' }, { status: 403 })

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return NextResponse.json({ msg: 'Credenciales inválidas' }, { status: 401 })

    const secret = process.env.JWT_SECRET
    if (!secret) return NextResponse.json({ msg: 'Error de configuración del servidor' }, { status: 500 })

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    )

    const res = NextResponse.json({
      token,
      role: user.role,
      user: { id: user.id, email: user.email, role: user.role, name: user.name }
    })

    const isProd = process.env.NODE_ENV === 'production'
    res.cookies.set('token', token, { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/', maxAge: 60 * 60 * 8 })
    res.cookies.set('role', user.role,  { httpOnly: false, sameSite: 'lax', secure: isProd, path: '/', maxAge: 60 * 60 * 8 })

    return res
  } catch (e) {
    console.error('[login]', e)
    return NextResponse.json({ msg: 'Error en login: ' + e.message }, { status: 500 })
  }
}