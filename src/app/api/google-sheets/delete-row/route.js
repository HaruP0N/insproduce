// src/app/api/google-sheets/delete-row/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { sheetsClient } from '@/lib/googleSheets'

export async function DELETE(req) {
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
    const { rowNumber } = body

    if (!rowNumber) {
      return NextResponse.json({ 
        msg: 'rowNumber es obligatorio' 
      }, { status: 400 })
    }

    // Limpiar la fila (dejarla vacía)
    const emptyRow = [['', '', '', '', '', '', '']]

    await sheetsClient.writeSheet(
      spreadsheetId,
      `A${rowNumber}:G${rowNumber}`,
      emptyRow
    )

    console.log(`✅ Fila ${rowNumber} eliminada`)

    return NextResponse.json({ 
      msg: 'Fila eliminada'
    })

  } catch (e) {
    console.error('[delete-row]', e)
    return NextResponse.json({ 
      msg: 'Error al eliminar: ' + e.message 
    }, { status: 500 })
  }
}