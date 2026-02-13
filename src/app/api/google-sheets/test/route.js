// src/app/api/google-sheets/test/route.js
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
        msg: 'GOOGLE_SHEET_ID no configurado en .env.local' 
      }, { status: 400 })
    }

    console.log('🧪 Probando conexión con Google Sheet:', spreadsheetId)

    const metadata = await sheetsClient.getSheetMetadata(spreadsheetId)
    
    console.log('✅ Conexión exitosa:', metadata.title)

    return NextResponse.json({
      msg: 'Conexión exitosa',
      title: metadata.title,
      sheets: metadata.sheets.length,
      rowCount: metadata.sheets[0]?.rowCount || 0,
      columnCount: metadata.sheets[0]?.columnCount || 0
    })

  } catch (e) {
    console.error('❌ [test]', e)
    return NextResponse.json({ 
      msg: 'Error al conectar: ' + e.message 
    }, { status: 500 })
  }
}