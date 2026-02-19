// src/app/api/google-sheets/load/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { sheetsClient } from '@/lib/googleSheets'
import { query } from '@/lib/db/mssql'

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
    
    // ← NUEVO: Enriquecer con datos de la BD (commodity_code)
    const enrichedInspecciones = []
    
    for (const insp of inspecciones) {
      const idInspeccion = insp['ID Inspección'] || insp['ID'] || insp['id'] || ''
      
      if (idInspeccion) {
        // Buscar en BD el commodity_code
        try {
          const result = await query(
            `SELECT commodity_code FROM assignments WHERE id = @id`,
            { id: parseInt(idInspeccion) }
          )
          
          if (result.recordset?.length > 0) {
            insp.commodity_code = result.recordset[0].commodity_code
          }
        } catch (err) {
          console.error(`Error buscando commodity para assignment ${idInspeccion}:`, err)
        }
      }
      
      enrichedInspecciones.push(insp)
    }
    
    return NextResponse.json({ inspecciones: enrichedInspecciones })

  } catch (e) {
    console.error('[load]', e)
    return NextResponse.json({ 
      msg: 'Error al cargar: ' + e.message 
    }, { status: 500 })
  }
}