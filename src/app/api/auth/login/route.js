// src/app/api/auth/login/route.js
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { fail, serverError } from '@/lib/http'
import { getUserByEmail } from '@/lib/repos/users'

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '').trim()
    if (!email || !password) return fail(400, 'Email y contraseña requeridos')

    const user = await getUserByEmail(email)
    if (!user) return fail(401, 'Credenciales inválidas')
    if (!user.active) return fail(403, 'Usuario inactivo. Contacte al administrador.')

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return fail(401, 'Credenciales inválidas')

    const secret = process.env.JWT_SECRET
    if (!secret) return fail(500, 'Error de configuración del servidor')

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' })

    const res = NextResponse.json({
      token, role: user.role,
      user: { id: user.id, email: user.email, role: user.role, name: user.name }
    })
    const isProd = process.env.NODE_ENV === 'production'
    res.cookies.set('token', token, { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/', maxAge: 60 * 60 * 8 })
    res.cookies.set('role', user.role, { httpOnly: false, sameSite: 'lax', secure: isProd, path: '/', maxAge: 60 * 60 * 8 })
    return res
  } catch (e) {
    return serverError('login', e)
  }
}
