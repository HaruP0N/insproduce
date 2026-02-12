// src/app/api/users/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import bcrypt from 'bcryptjs'

// GET - Listar usuarios
export async function GET(req) {
  const v = verifyTokenFromCookies(req)
  
  console.log('🔍 Verificación token:', v) // 🔧 DEBUG
  
  if (!v.ok) {
    return NextResponse.json({ msg: v.msg }, { status: v.status })
  }
  
  // 🔧 FIX: Validar que v.user existe
  if (!v.user) {
    return NextResponse.json({ msg: 'Usuario no autenticado' }, { status: 401 })
  }
  
  if (v.user.role !== 'admin') {
    return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })
  }

  try {
    console.log('✅ Usuario autenticado:', v.user.email, 'Role:', v.user.role) // DEBUG
    
    const r = await query(`
      SELECT 
        id, 
        name, 
        email, 
        role, 
        CAST(active AS int) as active,
        created_at 
      FROM users 
      ORDER BY created_at DESC
    `)
    
    console.log('📋 Usuarios encontrados:', r.recordset?.length || 0)
    
    return NextResponse.json(r.recordset || [])
  } catch (e) {
    console.error('❌ [GET /api/users]', e)
    return NextResponse.json({ 
      msg: 'Error al obtener usuarios', 
      error: e.message 
    }, { status: 500 })
  }
}

// POST - Crear usuario
export async function POST(req) {
  const v = verifyTokenFromCookies(req)
  
  if (!v.ok) {
    return NextResponse.json({ msg: v.msg }, { status: v.status })
  }
  
  // 🔧 FIX: Validar que v.user existe
  if (!v.user) {
    return NextResponse.json({ msg: 'Usuario no autenticado' }, { status: 401 })
  }
  
  if (v.user.role !== 'admin') {
    return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { name, email, password, role } = body

    if (!name || !email || !password || !role) {
      return NextResponse.json({ msg: 'Todos los campos son requeridos' }, { status: 400 })
    }

    if (!['admin', 'inspector'].includes(role)) {
      return NextResponse.json({ msg: 'Rol inválido' }, { status: 400 })
    }

    const existing = await query(`SELECT id FROM users WHERE email = @email`, { email })
    if (existing.recordset?.length) {
      return NextResponse.json({ msg: 'El email ya está registrado' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)

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

    return NextResponse.json({ 
      ok: true, 
      id: userId,
      msg: 'Usuario creado exitosamente' 
    }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/users]', e)
    return NextResponse.json({ msg: 'Error al crear usuario: ' + e.message }, { status: 500 })
  }
}