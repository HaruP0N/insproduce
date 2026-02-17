// src/app/api/inspecciones/asignar/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { query } from '@/lib/db/mssql'

export async function POST(req) {
  console.log('📌 [POST /api/inspecciones/asignar] Iniciando...')
  
  const v = verifyTokenFromCookies(req)
  
  if (!v.ok || !v.user) {
    return NextResponse.json({ msg: 'No autenticado' }, { status: 401 })
  }

  if (v.user.role !== 'admin') {
    return NextResponse.json({ msg: 'Solo admin puede asignar' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { lot, producer, variety, commodity, inspector_email } = body

    if (!lot || !producer) {
      return NextResponse.json({ 
        msg: 'Lote y Productor son obligatorios' 
      }, { status: 400 })
    }

    if (!inspector_email) {
      return NextResponse.json({ 
        msg: 'Debes seleccionar un inspector' 
      }, { status: 400 })
    }

    console.log('🔍 Buscando inspector:', inspector_email)

    // Buscar el inspector por email
    const inspectorRes = await query(
      `SELECT id FROM users 
       WHERE email = @email 
         AND role = 'inspector' 
         AND active = 1`,
      { email: inspector_email.trim().toLowerCase() }
    )

    if (!inspectorRes.recordset || inspectorRes.recordset.length === 0) {
      return NextResponse.json({ 
        msg: 'Inspector no encontrado o inactivo' 
      }, { status: 404 })
    }

    const inspectorId = inspectorRes.recordset[0].id
    console.log('✅ Inspector encontrado. ID:', inspectorId)

    // Crear la asignación en la tabla assignments
    const result = await query(
      `INSERT INTO assignments (
        user_id, producer, lot, variety, status, created_at, notes_admin
      )
      OUTPUT INSERTED.id
      VALUES (
        @user_id, @producer, @lot, @variety, 'pendiente', GETUTCDATE(), @notes
      )`,
      {
        user_id: inspectorId,
        producer: producer.trim(),
        lot: lot.trim(),
        variety: variety?.trim() || null,
        notes: `Commodity: ${commodity || 'N/A'}`
      }
    )

    const newAssignmentId = result.recordset[0].id
    console.log('✅ Asignación creada con ID:', newAssignmentId)

    return NextResponse.json({ 
      msg: 'Inspección asignada exitosamente',
      assignment_id: newAssignmentId
    })

  } catch (e) {
    console.error('❌ [asignar]', e)
    return NextResponse.json({ 
      msg: 'Error al asignar: ' + e.message 
    }, { status: 500 })
  }
}