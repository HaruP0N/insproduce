// src/app/api/auth/login/route.js
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { query } from '@/lib/db/mssql'

export async function POST(req) {
  console.log('🔐 [POST /api/auth/login] Iniciando...')
  
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '').trim()

    console.log('📧 Email recibido:', email)

    if (!email || !password) {
      console.log('❌ Email o password vacío')
      return NextResponse.json({ msg: 'Email y contraseña requeridos' }, { status: 400 })
    }

    console.log('🔍 Buscando usuario en BD...')
    const r = await query(
      `SELECT TOP 1 id, name, email, password_hash, role, active
       FROM users
       WHERE email=@email`,
      { email }
    )

    const user = r.recordset?.[0]
    
    if (!user) {
      console.log('❌ Usuario no encontrado:', email)
      return NextResponse.json({ msg: 'Credenciales inválidas' }, { status: 401 })
    }

    console.log('👤 Usuario encontrado:', {
      id: user.id,
      email: user.email,
      role: user.role,
      active: user.active
    })

    // 🔧 Verificar que el usuario esté activo
    if (!user.active) {
      console.log('❌ Usuario inactivo')
      return NextResponse.json({ msg: 'Usuario inactivo. Contacte al administrador.' }, { status: 403 })
    }

    console.log('🔒 Verificando password...')
    const ok = await bcrypt.compare(password, user.password_hash)
    
    if (!ok) {
      console.log('❌ Password incorrecto')
      return NextResponse.json({ msg: 'Credenciales inválidas' }, { status: 401 })
    }

    console.log('✅ Password correcto')

    const secret = process.env.JWT_SECRET
    if (!secret) {
      console.error('❌ JWT_SECRET no configurado')
      return NextResponse.json({ msg: 'Error de configuración del servidor' }, { status: 500 })
    }

    // 🔧 MEJORADO: Incluir más datos en el token
    const tokenPayload = {
      id: user.id,
      email: user.email,  // ← AGREGADO
      role: user.role,
      name: user.name     // ← AGREGADO
    }

    console.log('🎫 Creando JWT con payload:', tokenPayload)

    const token = jwt.sign(
      tokenPayload,
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    )

    console.log('✅ JWT creado exitosamente')

    const responseData = {
      token,
      role: user.role,
      user: { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name 
      }
    }

    console.log('📤 Enviando respuesta con role:', user.role)

    const res = NextResponse.json(responseData)

    // ✅ cookies para middleware (server-side)
    const isProd = process.env.NODE_ENV === 'production'

    res.cookies.set('token', token, {
      httpOnly: true,      // ✅ más seguro
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: 60 * 60 * 8  // 8 horas
    })

    res.cookies.set('role', user.role, {
      httpOnly: false,     // esto puede ser visible (solo para routing UI)
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: 60 * 60 * 8
    })

    console.log('✅ Cookies configuradas')
    console.log('═══════════════════════════════════════════')

    return res
  } catch (e) {
    console.error('❌ [login] Error:', e)
    console.error('Stack:', e.stack)
    return NextResponse.json({ msg: 'Error en login: ' + e.message }, { status: 500 })
  }
}