// src/app/api/google-sheets/load/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { sheetsClient } from '@/lib/googleSheets'

export async function GET(req) {
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

    const rows = await sheetsClient.readSheet(spreadsheetId)
    
    if (!rows || rows.length === 0) {
      return NextResponse.json({ inspecciones: [] })
    }

    const inspecciones = sheetsClient.parseRows(rows)
    
    return NextResponse.json({ inspecciones })

  } catch (e) {
    console.error('[load]', e)
    return NextResponse.json({ 
      msg: 'Error al cargar: ' + e.message 
    }, { status: 500 })
  }
}