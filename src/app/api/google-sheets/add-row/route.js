// src/app/api/google-sheets/add-row/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { sheetsClient } from '@/lib/googleSheets'

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
    const { producer, lot, variety, commodity, inspector } = body

    if (!producer || !lot) {
      return NextResponse.json({ 
        msg: 'Productor y Lote son obligatorios' 
      }, { status: 400 })
    }

    // Obtener el rango actual para saber cuántas filas hay
    const rows = await sheetsClient.readSheet(spreadsheetId)
    const nextRow = rows.length + 1

    // Agregar nueva fila
    const newRowData = [
      [producer, lot, variety || '', commodity || '', inspector || '', '', '']
    ]

    await sheetsClient.writeSheet(
      spreadsheetId,
      `A${nextRow}:G${nextRow}`,
      newRowData
    )

    console.log(`✅ Fila agregada en posición ${nextRow}`)

    return NextResponse.json({ 
      msg: 'Fila agregada',
      rowNumber: nextRow
    })

  } catch (e) {
    console.error('[add-row]', e)
    return NextResponse.json({ 
      msg: 'Error al agregar: ' + e.message 
    }, { status: 500 })
  }
}