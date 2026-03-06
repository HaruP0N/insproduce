// src/app/api/google-sheets/sync/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { query } from '@/lib/db/mssql'
import { sheetsClient } from '@/lib/googleSheets'

export async function POST(req) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok || !v.user) return NextResponse.json({ msg: 'No autenticado' }, { status: 401 })
  if (v.user.role !== 'admin') return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })

  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID
    if (!spreadsheetId)
      return NextResponse.json({ msg: 'No está configurado GOOGLE_SHEET_ID en .env.local' }, { status: 400 })

    const rows = await sheetsClient.readSheet(spreadsheetId)
    if (!rows || rows.length === 0)
      return NextResponse.json({ msg: 'El Google Sheet está vacío' }, { status: 400 })

    // ── PASO 1: BD → Sheet ──────────────────────────────────
    const assignmentsResult = await query(
      `SELECT a.id, a.producer, a.lot, a.variety, a.status, u.email as inspector_email
       FROM assignments a
       INNER JOIN users u ON a.user_id = u.id
       WHERE a.status = 'pendiente'
       ORDER BY a.created_at ASC`
    )

    const assignmentsFromDB = assignmentsResult.recordset || []
    const sheetData         = sheetsClient.parseRows(rows)
    const newRowsToAdd      = []

    for (const assignment of assignmentsFromDB) {
      const existsInSheet = sheetData.find(row =>
        row.Lote === assignment.lot && row.Productor === assignment.producer
      )
      if (!existsInSheet) {
        newRowsToAdd.push({
          producer:  assignment.producer,
          lot:       assignment.lot,
          variety:   assignment.variety || '',
          commodity: '',
          inspector: assignment.inspector_email,
          estado:    'Pendiente',
          id:        assignment.id.toString()
        })
      }
    }

    if (newRowsToAdd.length > 0) {
      const nextRow    = rows.length + 1
      const newRowsData = newRowsToAdd.map(r => [r.producer, r.lot, r.variety, r.commodity, r.inspector, r.estado, r.id])
      await sheetsClient.writeSheet(spreadsheetId, `A${nextRow}:G${nextRow + newRowsData.length - 1}`, newRowsData)
    }

    // ── PASO 2: Sheet → BD ──────────────────────────────────
    const updatedRows  = await sheetsClient.readSheet(spreadsheetId)
    const inspecciones = sheetsClient.parseRows(updatedRows)

    let nuevas  = 0
    let skipped = 0
    let errores = 0
    const updates = []

    for (const insp of inspecciones) {
      try {
        const producer       = insp['Productor']     || insp['productor']      || insp['Producer']       || ''
        const lot            = insp['Lote']           || insp['lote']           || insp['Lot']            || ''
        const variety        = insp['Variedad']       || insp['variedad']       || insp['Variety']        || ''
        const commodity      = insp['Commodity']      || insp['commodity']      || insp['Codigo']         || ''
        const inspectorEmail = insp['Inspector']      || insp['inspector']      || insp['Email Inspector'] || ''
        const idInspeccion   = insp['ID Inspección']  || insp['ID']             || insp['id']             || ''

        if (!producer || !lot) continue

        if (idInspeccion) { skipped++; continue }

        const existingAssignment = await query(
          `SELECT id, status FROM assignments WHERE lot = @lot AND producer = @producer`,
          { lot: lot.trim(), producer: producer.trim() }
        )

        if (existingAssignment.recordset?.length > 0) {
          const existing = existingAssignment.recordset[0]
          updates.push({ range: `${sheetsClient.numberToColumn(7)}${insp._rowNumber}`, values: [[existing.id]] })
          skipped++
          continue
        }

        let inspectorId = null
        if (inspectorEmail) {
          const userRes = await query(
            `SELECT id FROM users WHERE email = @email AND role = 'inspector' AND active = 1`,
            { email: inspectorEmail.trim().toLowerCase() }
          )
          if (userRes.recordset?.length > 0) inspectorId = userRes.recordset[0].id
        }

        const result = await query(
          `INSERT INTO assignments (user_id, producer, lot, variety, status, created_at, notes_admin)
           OUTPUT INSERTED.id
           VALUES (@user_id, @producer, @lot, @variety, 'pendiente', GETUTCDATE(), @notes)`,
          {
            user_id:  inspectorId,
            producer: producer.trim(),
            lot:      lot.trim(),
            variety:  variety?.trim() || null,
            notes:    `Commodity: ${commodity || 'N/A'}`
          }
        )

        const newAssignmentId = result.recordset[0].id
        updates.push({ range: `${sheetsClient.numberToColumn(6)}${insp._rowNumber}`, values: [['Pendiente']] })
        updates.push({ range: `${sheetsClient.numberToColumn(7)}${insp._rowNumber}`, values: [[newAssignmentId]] })
        nuevas++

      } catch (err) {
        console.error(`[sync] Error en fila ${insp._rowNumber}:`, err.message)
        errores++
        updates.push({ range: `${sheetsClient.numberToColumn(6)}${insp._rowNumber}`, values: [[`Error: ${err.message}`]] })
      }
    }

    if (updates.length > 0) await sheetsClient.batchUpdate(spreadsheetId, updates)

    return NextResponse.json({
      msg:         'Sincronización bidireccional completada',
      bd_to_sheet: newRowsToAdd.length,
      sheet_to_bd: nuevas,
      nuevas,
      skipped,
      errores,
      total: inspecciones.length
    })

  } catch (e) {
    console.error('[sync]', e)
    return NextResponse.json({ msg: 'Error al sincronizar: ' + e.message }, { status: 500 })
  }
}