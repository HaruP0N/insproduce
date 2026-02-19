// src/app/api/google-sheets/sync/route.js - VERSIÓN CORREGIDA
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { query } from '@/lib/db/mssql'
import { sheetsClient } from '@/lib/googleSheets'

export async function POST(req) {
  console.log('🔄 [POST /api/google-sheets/sync] Iniciando sincronización bidireccional...')
  
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

    const rows = await sheetsClient.readSheet(spreadsheetId)
    
    if (!rows || rows.length === 0) {
      return NextResponse.json({ 
        msg: 'El Google Sheet está vacío' 
      }, { status: 400 })
    }

    console.log('📋 Filas leídas del Sheet:', rows.length)

    // ═══════════════════════════════════════════════════════════
    // PASO 1: Sincronizar BD → Sheet (nuevas asignaciones)
    // ═══════════════════════════════════════════════════════════
    
    console.log('📤 PASO 1: Sincronizando BD → Sheet...')
    
    const assignmentsResult = await query(
      `SELECT 
        a.id, a.producer, a.lot, a.variety, a.status,
        u.email as inspector_email
       FROM assignments a
       INNER JOIN users u ON a.user_id = u.id
       WHERE a.status = 'pendiente'
       ORDER BY a.created_at ASC`
    )

    const assignmentsFromDB = assignmentsResult.recordset || []
    console.log('📦 Asignaciones en BD:', assignmentsFromDB.length)

    const sheetData = sheetsClient.parseRows(rows)
    
    const newRowsToAdd = []
    
    for (const assignment of assignmentsFromDB) {
      const existsInSheet = sheetData.find(row => 
        row.Lote === assignment.lot && row.Productor === assignment.producer
      )
      
      if (!existsInSheet) {
        console.log(`➕ Nueva fila para Sheet: ${assignment.lot}`)
        newRowsToAdd.push({
          producer: assignment.producer,
          lot: assignment.lot,
          variety: assignment.variety || '',
          commodity: '',
          inspector: assignment.inspector_email,
          estado: 'Pendiente',
          id: assignment.id.toString()
        })
      }
    }

    if (newRowsToAdd.length > 0) {
      console.log(`📝 Agregando ${newRowsToAdd.length} filas nuevas al Sheet...`)
      
      const nextRow = rows.length + 1
      const newRowsData = newRowsToAdd.map(row => [
        row.producer, row.lot, row.variety, row.commodity,
        row.inspector, row.estado, row.id
      ])

      await sheetsClient.writeSheet(
        spreadsheetId,
        `A${nextRow}:G${nextRow + newRowsData.length - 1}`,
        newRowsData
      )
      
      console.log('✅ Filas agregadas al Sheet')
    } else {
      console.log('ℹ️ No hay filas nuevas para agregar al Sheet')
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 2: Sincronizar Sheet → BD (importar nuevas)
    // ═══════════════════════════════════════════════════════════
    
    console.log('📥 PASO 2: Sincronizando Sheet → BD...')

    const updatedRows = await sheetsClient.readSheet(spreadsheetId)
    const inspecciones = sheetsClient.parseRows(updatedRows)
    
    console.log('📦 Inspecciones parseadas del Sheet:', inspecciones.length)

    let nuevas = 0
    let skipped = 0
    let errores = 0
    const updates = []

    for (const insp of inspecciones) {
      try {
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

        // Si ya tiene ID en el Sheet, skip
        if (idInspeccion) {
          console.log(`⏭️ Fila ${insp._rowNumber}: Ya tiene ID (${idInspeccion}), skip`)
          skipped++
          continue
        }

        // ✅ VERIFICAR SI YA EXISTE EN BD (evitar duplicados)
        const existingAssignment = await query(
          `SELECT id, status FROM assignments 
           WHERE lot = @lot AND producer = @producer`,
          { lot: lot.trim(), producer: producer.trim() }
        )

        if (existingAssignment.recordset?.length > 0) {
          const existing = existingAssignment.recordset[0]
          console.log(`⏭️ Fila ${insp._rowNumber}: Ya existe en BD (ID: ${existing.id}, estado: ${existing.status})`)
          
          // Actualizar el Sheet con el ID existente
          const idCol = 7
          updates.push({
            range: `${sheetsClient.numberToColumn(idCol)}${insp._rowNumber}`,
            values: [[existing.id]]
          })
          
          skipped++
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

        // Insertar en assignments
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

        console.log(`✅ [${nuevas + 1}] Creada: ${lot} - ${producer} (ID: ${newAssignmentId})`)

        // Preparar actualización del Sheet
        const estadoCol = 6  // Columna F
        const idCol = 7      // Columna G

        updates.push({
          range: `${sheetsClient.numberToColumn(estadoCol)}${insp._rowNumber}`,
          values: [['Pendiente']]
        })

        updates.push({
          range: `${sheetsClient.numberToColumn(idCol)}${insp._rowNumber}`,
          values: [[newAssignmentId]]
        })

        nuevas++

      } catch (err) {
        console.error(`❌ Error en fila ${insp._rowNumber}:`, err.message)
        errores++

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

    console.log(`✅ Sincronización completada:`)
    console.log(`   - ${newRowsToAdd.length} filas agregadas al Sheet (BD → Sheet)`)
    console.log(`   - ${nuevas} asignaciones nuevas importadas (Sheet → BD)`)
    console.log(`   - ${skipped} omitidas (ya existen)`)
    console.log(`   - ${errores} errores`)

    return NextResponse.json({
      msg: 'Sincronización bidireccional completada',
      bd_to_sheet: newRowsToAdd.length,
      sheet_to_bd: nuevas,
      nuevas,
      skipped,
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