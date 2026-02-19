// src/app/api/google-sheets/add-row/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { sheetsClient } from '@/lib/googleSheets'
import { query } from '@/lib/db/mssql'

export async function POST(req) {
  const v = verifyTokenFromCookies(req)
  
  if (!v.ok || !v.user || v.user.role !== 'admin') {
    return NextResponse.json({ msg: 'No autorizado' }, { status: 403 })
  }

  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID
    
    if (!spreadsheetId) {
      return NextResponse.json({ 
        msg: 'GOOGLE_SHEET_ID no configurado' 
      }, { status: 400 })
    }

    const body = await req.json()
    const { producer, lot, variety, commodity, inspector, estado } = body

    if (!producer || !lot) {
      return NextResponse.json({ 
        msg: 'Productor y Lote son obligatorios' 
      }, { status: 400 })
    }

    // ← NUEVO: Buscar inspector por email
    let inspectorId = null
    if (inspector) {
      const userRes = await query(
        `SELECT id FROM users WHERE email = @email AND role = 'inspector' AND active = 1`,
        { email: inspector.trim().toLowerCase() }
      )
      
      if (userRes.recordset?.length > 0) {
        inspectorId = userRes.recordset[0].id
      }
    }

    // ← NUEVO: Crear en BD primero
    const result = await query(
      `INSERT INTO assignments (
        user_id, producer, lot, variety, commodity_code, status, created_at
      )
      OUTPUT INSERTED.id
      VALUES (
        @user_id, @producer, @lot, @variety, @commodity_code, 'pendiente', GETUTCDATE()
      )`,
      {
        user_id: inspectorId,
        producer: producer.trim(),
        lot: lot.trim(),
        variety: variety?.trim() || null,
        commodity_code: commodity?.trim() || null
      }
    )

    const newAssignmentId = result.recordset[0].id

    console.log(`✅ Asignación creada en BD con ID: ${newAssignmentId}`)

    // Ahora agregar al Sheet con el ID
    const rows = await sheetsClient.readSheet(spreadsheetId)
    const nextRow = rows.length + 1

    const newRowData = [
      [
        producer, 
        lot, 
        variety || '', 
        commodity || '', 
        inspector || '', 
        estado || 'Pendiente', 
        newAssignmentId
      ]
    ]

    await sheetsClient.writeSheet(
      spreadsheetId,
      `A${nextRow}:G${nextRow}`,
      newRowData
    )

    console.log(`✅ Fila agregada al Sheet en posición ${nextRow}`)

    return NextResponse.json({ 
      msg: 'Asignación creada',
      id: newAssignmentId,
      rowNumber: nextRow
    })

  } catch (e) {
    console.error('[add-row]', e)
    return NextResponse.json({ 
      msg: 'Error al agregar: ' + e.message 
    }, { status: 500 })
  }
}