// src/app/api/assignments/[id]/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { query } from '@/lib/db/mssql'

// GET - Obtener datos de una asignación
export async function GET(req, context) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok || !v.user) return NextResponse.json({ msg: 'No autenticado' }, { status: 401 })

  try {
    const params = await context.params
    const { id } = params

    const result = await query(
      `SELECT 
        a.id, a.producer, a.lot, a.variety, a.status, a.notes_admin, a.created_at,
        u.id as inspector_id, u.name as inspector_name, u.email as inspector_email
       FROM assignments a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.id = @id`,
      { id: parseInt(id) }
    )

    if (!result.recordset?.length) {
      return NextResponse.json({ msg: 'Asignación no encontrada' }, { status: 404 })
    }

    return NextResponse.json(result.recordset[0])
  } catch (e) {
    console.error('❌ [get assignment]', e)
    return NextResponse.json({ msg: 'Error: ' + e.message }, { status: 500 })
  }
}

// PATCH - Cambiar estado de una asignación (solo admin)
export async function PATCH(req, context) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok || !v.user) return NextResponse.json({ msg: 'No autenticado' }, { status: 401 })
  if (v.user.role !== 'admin') return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })

  try {
    const params = await context.params
    const { id } = params
    const body = await req.json().catch(() => ({}))
    const { status } = body

    const allowed = ['pendiente', 'completada', 'cancelada']
    if (!status || !allowed.includes(status)) {
      return NextResponse.json({ msg: `Estado inválido. Valores permitidos: ${allowed.join(', ')}` }, { status: 400 })
    }

    await query(
      `UPDATE assignments SET status = @status WHERE id = @id`,
      { id: parseInt(id), status }
    )

    return NextResponse.json({ ok: true, msg: `Estado cambiado a "${status}"` })
  } catch (e) {
    console.error('❌ [patch assignment]', e)
    return NextResponse.json({ msg: 'Error: ' + e.message }, { status: 500 })
  }
}

// DELETE - Cancelar una asignación
export async function DELETE(req, context) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok || !v.user) return NextResponse.json({ msg: 'No autenticado' }, { status: 401 })
  if (v.user.role !== 'admin') return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })

  try {
    const params = await context.params
    const { id } = params

    await query(
      `UPDATE assignments 
       SET status = 'cancelada', 
           notes_admin = CONCAT(ISNULL(notes_admin, ''), ' [CANCELADA POR ADMIN]')
       WHERE id = @id`,
      { id: parseInt(id) }
    )

    return NextResponse.json({ msg: 'Asignación cancelada' })
  } catch (e) {
    console.error('❌ [delete assignment]', e)
    return NextResponse.json({ msg: 'Error: ' + e.message }, { status: 500 })
  }
}