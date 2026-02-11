import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'

export async function PUT(req, { params }) {
  const v = await verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  if (v.payload?.role !== 'admin') {
    return NextResponse.json({ msg: 'Solo admin puede asignar inspecciones' }, { status: 403 })
  }

  try {
    const inspectionId = Number(params.id)
    if (!inspectionId) {
      return NextResponse.json({ msg: 'ID inválido' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const assigned_to_user_id = body.assigned_to_user_id
      ? Number(body.assigned_to_user_id)
      : null

    await query(
      `
      UPDATE inspections
      SET assigned_to_user_id = @assigned_to_user_id
      WHERE id = @id
      `,
      {
        id: inspectionId,
        assigned_to_user_id
      }
    )

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[asignar inspeccion]', e)
    return NextResponse.json({ msg: 'Error asignando inspección' }, { status: 500 })
  }
}
