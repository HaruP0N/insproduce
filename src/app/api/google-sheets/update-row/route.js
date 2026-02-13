// src/app/api/google-sheets/update-row/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { sheetsClient } from '@/lib/googleSheets'

export async function PUT(req) {
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
    const { rowNumber, data } = body

    if (!rowNumber || !data) {
      return NextResponse.json({ 
        msg: 'rowNumber y data son obligatorios' 
      }, { status: 400 })
    }

    // Actualizar solo las primeras 5 columnas (no tocar Estado e ID)
    const rowData = [
      [
        data.producer || '',
        data.lot || '',
        data.variety || '',
        data.commodity || '',
        data.inspector || ''
      ]
    ]

    await sheetsClient.writeSheet(
      spreadsheetId,
      `A${rowNumber}:E${rowNumber}`,
      rowData
    )

    console.log(`✅ Fila ${rowNumber} actualizada`)

    return NextResponse.json({ 
      msg: 'Fila actualizada'
    })

  } catch (e) {
    console.error('[update-row]', e)
    return NextResponse.json({ 
      msg: 'Error al actualizar: ' + e.message 
    }, { status: 500 })
  }
}