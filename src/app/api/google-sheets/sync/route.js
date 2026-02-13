// src/app/api/google-sheets/sync/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { query } from '@/lib/db/mssql'
import { sheetsClient } from '@/lib/googleSheets'

export async function POST(req) {
  console.log('🔄 [POST /api/google-sheets/sync] Iniciando sincronización...')
  
  const v = verifyTokenFromCookies(req)
  
  if (!v.ok || !v.user) {
    return NextResponse.json({ msg: 'No autenticado' }, { status: 401 })
  }

  if (v.user.role !== 'admin') {
    return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })
  }

  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID
    
    if (!spreadsheetId) {
      return NextResponse.json({ 
        msg: 'No está configurado GOOGLE_SHEET_ID en .env.local' 
      }, { status: 400 })
    }

    console.log('📊 Leyendo Google Sheet:', spreadsheetId)

    // Leer todas las filas
    const rows = await sheetsClient.readSheet(spreadsheetId)
    
    if (!rows || rows.length === 0) {
      return NextResponse.json({ 
        msg: 'El Google Sheet está vacío' 
      }, { status: 400 })
    }

    console.log('📋 Filas leídas:', rows.length)

    // Parsear filas a objetos
    const inspecciones = sheetsClient.parseRows(rows)
    
    console.log('📦 Inspecciones parseadas:', inspecciones.length)

    let nuevas = 0
    let actualizadas = 0
    let errores = 0
    const updates = []

    // Procesar cada inspección
    for (const insp of inspecciones) {
      try {
        // Mapear columnas (flexible)
        const producer = insp['Productor'] || insp['productor'] || insp['Producer'] || ''
        const lot = insp['Lote'] || insp['lote'] || insp['Lot'] || ''
        const variety = insp['Variedad'] || insp['variedad'] || insp['Variety'] || ''
        const commodity = insp['Commodity'] || insp['commodity'] || insp['Codigo'] || ''
        const inspectorEmail = insp['Inspector'] || insp['inspector'] || insp['Email Inspector'] || ''
        const estado = insp['Estado'] || insp['estado'] || insp['Status'] || ''
        const idInspeccion = insp['ID Inspección'] || insp['ID'] || insp['id'] || ''

        // Validar datos mínimos
        if (!producer || !lot) {
          console.warn(`⚠️ Fila ${insp._rowNumber}: Falta productor o lote, omitiendo`)
          continue
        }

        // Si ya tiene ID de inspección y estado "Importada", skip
        if (idInspeccion && estado === 'Importada') {
          console.log(`⏭️ Fila ${insp._rowNumber}: Ya importada (ID: ${idInspeccion})`)
          continue
        }

        // Buscar inspector por email
        let inspectorId = null
        if (inspectorEmail) {
          const userRes = await query(
            `SELECT id FROM users WHERE email = @email AND role = 'inspector' AND active = 1`,
            { email: inspectorEmail.trim().toLowerCase() }
          )
          
          if (userRes.recordset?.length > 0) {
            inspectorId = userRes.recordset[0].id
          } else {
            console.warn(`⚠️ Inspector no encontrado: ${inspectorEmail}`)
          }
        }

        // Insertar inspección
        const result = await query(
          `INSERT INTO inspections (
            producer, lot, variety, commodity_code,
            assigned_to_user_id, created_by_user_id,
            status
          )
          OUTPUT INSERTED.id
          VALUES (
            @producer, @lot, @variety, @commodity_code,
            @assigned_to_user_id, @created_by_user_id,
            'pending'
          )`,
          {
            producer: producer.trim(),
            lot: lot.trim(),
            variety: variety.trim(),
            commodity_code: commodity.trim(),
            assigned_to_user_id: inspectorId,
            created_by_user_id: v.user.id
          }
        )

        const newInspectionId = result.recordset[0].id

        console.log(`✅ [${nuevas + 1}] Creada: ${lot} - ${producer} (ID: ${newInspectionId})`)

        // Preparar actualización del Sheet
        // Columnas: Productor | Lote | Variedad | Commodity | Inspector | Estado | ID Inspección
        const estadoCol = 6  // Columna F
        const idCol = 7      // Columna G

        updates.push({
          range: `${sheetsClient.numberToColumn(estadoCol)}${insp._rowNumber}`,
          values: [['Importada']]
        })

        updates.push({
          range: `${sheetsClient.numberToColumn(idCol)}${insp._rowNumber}`,
          values: [[newInspectionId]]
        })

        nuevas++

      } catch (err) {
        console.error(`❌ Error en fila ${insp._rowNumber}:`, err.message)
        errores++

        // Marcar error en el Sheet
        const estadoCol = 6
        updates.push({
          range: `${sheetsClient.numberToColumn(estadoCol)}${insp._rowNumber}`,
          values: [[`Error: ${err.message}`]]
        })
      }
    }

    // Actualizar el Sheet con los resultados
    if (updates.length > 0) {
      console.log(`📝 Actualizando ${updates.length} celdas en el Sheet...`)
      await sheetsClient.batchUpdate(spreadsheetId, updates)
      console.log('✅ Sheet actualizado')
    }

    console.log(`✅ Sincronización completada: ${nuevas} nuevas, ${actualizadas} actualizadas, ${errores} errores`)

    return NextResponse.json({
      msg: 'Sincronización completada',
      nuevas,
      actualizadas,
      errores,
      total: inspecciones.length
    })

  } catch (e) {
    console.error('❌ [sync]', e)
    return NextResponse.json({ 
      msg: 'Error al sincronizar: ' + e.message 
    }, { status: 500 })
  }
}
