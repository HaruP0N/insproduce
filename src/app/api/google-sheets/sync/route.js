// src/app/api/google-sheets/sync/route.js — sincronización bidireccional BD(qc) <-> Sheet
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { query } from '@/lib/db/mssql'
import { sheetsClient } from '@/lib/googleSheets'
import { createAssignment } from '@/lib/repos/assignments'

export async function POST(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID
    if (!spreadsheetId) return fail(400, 'GOOGLE_SHEET_ID no configurado')

    const rows = await sheetsClient.readSheet(spreadsheetId)
    if (!rows || rows.length === 0) return fail(400, 'El Google Sheet está vacío')

    // PASO 1: BD -> Sheet (asignaciones pendientes que no estén en la planilla)
    const bd = await query(
      `SELECT a.id, a.producer, a.lot, a.variety, u.email AS inspector_email
       FROM qc.assignments a JOIN qc.users u ON u.id = a.user_id
       WHERE a.status='pendiente' AND a.deleted_at IS NULL ORDER BY a.created_at ASC`)
    const sheetData = sheetsClient.parseRows(rows)
    const newRows = []
    for (const a of bd.recordset || []) {
      const exists = sheetData.find(r => r.Lote === a.lot && r.Productor === a.producer)
      if (!exists) newRows.push([a.producer, a.lot, a.variety || '', '', a.inspector_email, 'Pendiente', String(a.id)])
    }
    if (newRows.length) {
      const nextRow = rows.length + 1
      await sheetsClient.writeSheet(spreadsheetId, `A${nextRow}:G${nextRow + newRows.length - 1}`, newRows)
    }

    // PASO 2: Sheet -> BD (filas nuevas sin ID -> crear asignación)
    const updatedRows = await sheetsClient.readSheet(spreadsheetId)
    const inspecciones = sheetsClient.parseRows(updatedRows)
    let nuevas = 0, skipped = 0, errores = 0
    const updates = []

    for (const insp of inspecciones) {
      try {
        const producer = insp['Productor'] || insp['productor'] || insp['Producer'] || ''
        const lot = insp['Lote'] || insp['lote'] || insp['Lot'] || ''
        const variety = insp['Variedad'] || insp['variedad'] || insp['Variety'] || ''
        const commodity = insp['Commodity'] || insp['commodity'] || insp['Codigo'] || ''
        const inspectorEmail = insp['Inspector'] || insp['inspector'] || insp['Email Inspector'] || ''
        const idInsp = insp['ID Inspección'] || insp['ID'] || insp['id'] || ''
        if (!producer || !lot) continue
        if (idInsp) { skipped++; continue }

        const existing = await query(
          `SELECT id FROM qc.assignments WHERE lot=@lot AND producer=@producer AND deleted_at IS NULL`,
          { lot: lot.trim(), producer: producer.trim() })
        if (existing.recordset?.length) {
          updates.push({ range: `${sheetsClient.numberToColumn(7)}${insp._rowNumber}`, values: [[existing.recordset[0].id]] })
          skipped++
          continue
        }

        const newId = await createAssignment(
          { lot, producer, variety, commodity, inspector_email: inspectorEmail }, auth.user.id)
        updates.push({ range: `${sheetsClient.numberToColumn(6)}${insp._rowNumber}`, values: [['Pendiente']] })
        updates.push({ range: `${sheetsClient.numberToColumn(7)}${insp._rowNumber}`, values: [[newId]] })
        nuevas++
      } catch (err) {
        errores++
        updates.push({ range: `${sheetsClient.numberToColumn(6)}${insp._rowNumber}`, values: [[`Error: ${err.message}`]] })
      }
    }
    if (updates.length) await sheetsClient.batchUpdate(spreadsheetId, updates)

    // Registrar la última sincronización (la muestra la pantalla Integraciones)
    await query(
      `MERGE qc.app_settings AS t USING (SELECT 'gsheets_last_sync' AS k) s ON t.setting_key=s.k
       WHEN MATCHED THEN UPDATE SET setting_value=@v, updated_at=SYSUTCDATETIME()
       WHEN NOT MATCHED THEN INSERT (setting_key, setting_value) VALUES (s.k, @v);`,
      { v: new Date().toISOString() })

    return ok({ msg: 'Sincronización bidireccional completada', bd_to_sheet: newRows.length, sheet_to_bd: nuevas, nuevas, skipped, errores, total: inspecciones.length })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('google-sheets/sync', e)
  }
}
