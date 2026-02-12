// src/app/api/users/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import bcrypt from 'bcryptjs'

// GET - Listar usuarios
export async function GET(req) {
  console.log('🔍 [GET /api/users] Iniciando...')
  
  const v = verifyTokenFromCookies(req)
  
  console.log('🔍 Verificación token:', {
    ok: v.ok,
    status: v.status,
    msg: v.msg,
    hasUser: !!v.user,
    userEmail: v.user?.email,
    userRole: v.user?.role
  })
  
  if (!v.ok) {
    console.error('❌ Token inválido:', v.msg)
    return NextResponse.json({ msg: v.msg }, { status: v.status })
  }
  
  if (!v.user) {
    console.error('❌ Usuario no encontrado en token')
    return NextResponse.json({ msg: 'Usuario no autenticado' }, { status: 401 })
  }
  
  if (v.user.role !== 'admin') {
    console.error('❌ Usuario no es admin:', v.user.email, 'Role:', v.user.role)
    return NextResponse.json({ msg: 'Solo admin puede ver usuarios' }, { status: 403 })
  }

  try {
    console.log('✅ Usuario autenticado:', v.user.email, 'Role:', v.user.role)
    
    const sqlQuery = `
      SELECT 
        id, 
        name, 
        email, 
        role, 
        CAST(active AS int) as active,
        created_at 
      FROM users 
      ORDER BY created_at DESC
    `
    
    console.log('📝 Ejecutando query:', sqlQuery)
    
    const r = await query(sqlQuery)
    
    console.log('📋 Resultados:', {
      totalUsuarios: r.recordset?.length || 0,
      usuarios: r.recordset
    })
    
    // 🔧 Asegurar que devolvemos un array
    const usuarios = r.recordset || []
    
    return NextResponse.json(usuarios, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (e) {
    console.error('❌ [GET /api/users] Error:', e)
    console.error('Stack:', e.stack)
    
    return NextResponse.json({ 
      msg: 'Error al obtener usuarios', 
      error: e.message,
      details: process.env.NODE_ENV === 'development' ? e.stack : undefined
    }, { status: 500 })
  }
}

// POST - Crear usuario
export async function POST(req) {
  console.log('🔍 [POST /api/users] Iniciando...')
  
  const v = verifyTokenFromCookies(req)
  
  if (!v.ok) {
    console.error('❌ Token inválido:', v.msg)
    return NextResponse.json({ msg: v.msg }, { status: v.status })
  }
  
  if (!v.user) {
    console.error('❌ Usuario no encontrado en token')
    return NextResponse.json({ msg: 'Usuario no autenticado' }, { status: 401 })
  }
  
  if (v.user.role !== 'admin') {
    console.error('❌ Usuario no es admin:', v.user.email)
    return NextResponse.json({ msg: 'Solo admin puede crear usuarios' }, { status: 403 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    console.log('📝 Body recibido:', { ...body, password: '***' })
    
    const { name, email, password, role } = body

    if (!name || !email || !password || !role) {
      console.error('❌ Campos faltantes:', { name: !!name, email: !!email, password: !!password, role: !!role })
      return NextResponse.json({ msg: 'Todos los campos son requeridos' }, { status: 400 })
    }

    if (!['admin', 'inspector'].includes(role)) {
      console.error('❌ Rol inválido:', role)
      return NextResponse.json({ msg: 'Rol inválido. Debe ser "admin" o "inspector"' }, { status: 400 })
    }

    console.log('🔍 Verificando si email existe:', email)
    const existing = await query(`SELECT id FROM users WHERE email = @email`, { email })
    
    if (existing.recordset?.length) {
      console.error('❌ Email ya existe:', email)
      return NextResponse.json({ msg: 'El email ya está registrado' }, { status: 400 })
    }

    console.log('🔒 Hasheando contraseña...')
    const passwordHash = await bcrypt.hash(password, 10)

    console.log('💾 Insertando usuario...')
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, active) 
       OUTPUT INSERTED.id
       VALUES (@name, @email, @password_hash, @role, 1)`,
      { 
        name, 
        email, 
        password_hash: passwordHash, 
        role 
      }
    )

    const userId = result.recordset[0].id
    console.log('✅ Usuario creado con ID:', userId)

    return NextResponse.json({ 
      ok: true, 
      id: userId,
      msg: 'Usuario creado exitosamente' 
    }, { status: 201 })
  } catch (e) {
    console.error('❌ [POST /api/users] Error:', e)
    console.error('Stack:', e.stack)
    
    return NextResponse.json({ 
      msg: 'Error al crear usuario: ' + e.message,
      details: process.env.NODE_ENV === 'development' ? e.stack : undefined
    }, { status: 500 })
  }
}