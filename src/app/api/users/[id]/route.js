// src/app/api/users/[id]/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import bcrypt from 'bcryptjs'

// PUT - Actualizar usuario
export async function PUT(req, context) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })
  if (v.user.role !== 'admin') {
    return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })
  }

  try {
    const params = await context.params
    const id = Number(params?.id)
    
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ msg: 'ID inválido' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const { name, email, role, password } = body

    // Verificar que el usuario existe
    const existing = await query(`SELECT id FROM users WHERE id = @id`, { id })
    if (!existing.recordset?.length) {
      return NextResponse.json({ msg: 'Usuario no encontrado' }, { status: 404 })
    }

    // Si se está cambiando el email, verificar que no esté en uso
    if (email) {
      const emailCheck = await query(
        `SELECT id FROM users WHERE email = @email AND id != @id`,
        { email, id }
      )
      if (emailCheck.recordset?.length) {
        return NextResponse.json({ msg: 'El email ya está en uso' }, { status: 400 })
      }
    }

    // Construir query dinámica
    let updateQuery = 'UPDATE users SET updated_at = GETDATE()'
    const queryParams = { id }

    if (name) {
      updateQuery += ', name = @name'
      queryParams.name = name
    }

    if (email) {
      updateQuery += ', email = @email'
      queryParams.email = email
    }

    if (role && ['admin', 'inspector'].includes(role)) {
      updateQuery += ', role = @role'
      queryParams.role = role
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10)
      updateQuery += ', password_hash = @password_hash'
      queryParams.password_hash = passwordHash
    }

    updateQuery += ' WHERE id = @id'

    await query(updateQuery, queryParams)

    return NextResponse.json({ ok: true, msg: 'Usuario actualizado' })
  } catch (e) {
    console.error('[PUT /api/users/[id]]', e)
    return NextResponse.json({ msg: 'Error al actualizar usuario' }, { status: 500 })
  }
}

// PATCH - Activar/Desactivar usuario
export async function PATCH(req, context) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })
  if (v.user.role !== 'admin') {
    return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })
  }

  try {
    const params = await context.params
    const id = Number(params?.id)
    
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ msg: 'ID inválido' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const { active } = body

    if (typeof active !== 'boolean') {
      return NextResponse.json({ msg: 'Campo active requerido' }, { status: 400 })
    }

    await query(
      `UPDATE users SET active = @active, updated_at = GETDATE() WHERE id = @id`,
      { id, active: active ? 1 : 0 }
    )

    return NextResponse.json({ 
      ok: true, 
      msg: active ? 'Usuario activado' : 'Usuario desactivado' 
    })
  } catch (e) {
    console.error('[PATCH /api/users/[id]]', e)
    return NextResponse.json({ msg: 'Error al cambiar estado' }, { status: 500 })
  }
}

// DELETE - Eliminar usuario (opcional, mejor usar desactivar)
export async function DELETE(req, context) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })
  if (v.user.role !== 'admin') {
    return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })
  }

  try {
    const params = await context.params
    const id = Number(params?.id)
    
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ msg: 'ID inválido' }, { status: 400 })
    }

    // No permitir eliminar al usuario actual
    if (id === v.user.id) {
      return NextResponse.json({ msg: 'No puedes eliminarte a ti mismo' }, { status: 400 })
    }

    await query(`DELETE FROM users WHERE id = @id`, { id })

    return NextResponse.json({ ok: true, msg: 'Usuario eliminado' })
  } catch (e) {
    console.error('[DELETE /api/users/[id]]', e)
    return NextResponse.json({ msg: 'Error al eliminar usuario' }, { status: 500 })
  }
}