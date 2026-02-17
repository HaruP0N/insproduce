// src/app/api/inspecciones/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromRequest } from '@/lib/auth/verifyToken'
import { query } from '@/lib/db/mssql'

function allowAdminOrInspector(role) {
  return ['admin', 'inspector'].includes(role)
}

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str) } catch { return fallback }
}

export async function POST(req) {
  const v = verifyTokenFromRequest(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  if (!allowAdminOrInspector(v.user?.role)) {
    return NextResponse.json({ msg: 'Permiso denegado' }, { status: 403 })
  }

  try {
    const body = await req.json().catch(() => ({}))

    // commodity (puede venir commodity_id o commodity_code)
    let commodity_id = body.commodity_id ? Number(body.commodity_id) : null

    if (!commodity_id && body.commodity_code) {
      const code = String(body.commodity_code).trim().toUpperCase()
      const c = await query(`SELECT TOP 1 id FROM commodities WHERE code=@code`, { code })
      commodity_id = c.recordset?.[0]?.id || null
    }

    if (!commodity_id) {
      return NextResponse.json({ msg: 'commodity_id o commodity_code es obligatorio' }, { status: 400 })
    }

    const created_by_user_id = v.user?.id ? Number(v.user.id) : null

    const producer = body.producer ? String(body.producer) : null
    const lot = body.lot ? String(body.lot) : null
    const variety = body.variety ? String(body.variety) : null
    const caliber = body.caliber ? String(body.caliber) : null

    const packaging_code = body.packaging_code ? String(body.packaging_code) : null
    const packaging_type = body.packaging_type ? String(body.packaging_type) : null
    const packaging_date = body.packaging_date ? String(body.packaging_date) : null

    const net_weight = body.net_weight !== undefined && body.net_weight !== null ? Number(body.net_weight) : null
    const brix_avg = body.brix_avg !== undefined && body.brix_avg !== null ? Number(body.brix_avg) : null

    const temp_water = body.temp_water !== undefined && body.temp_water !== null ? Number(body.temp_water) : null
    const temp_ambient = body.temp_ambient !== undefined && body.temp_ambient !== null ? Number(body.temp_ambient) : null
    const temp_pulp = body.temp_pulp !== undefined && body.temp_pulp !== null ? Number(body.temp_pulp) : null

    const notes = body.notes !== undefined ? String(body.notes) : null

    // metrics JSON
    const metricsObj =
      typeof body.metrics === 'string' ? safeJsonParse(body.metrics, {}) : (body.metrics || {})
    const metrics = JSON.stringify(metricsObj || {})

    // Capturar assignment_id si viene
    const assignment_id = body.assignment_id ? Number(body.assignment_id) : null

    const ins = await query(
      `INSERT INTO inspections (
        commodity_id, created_by_user_id,
        producer, lot, variety, caliber,
        packaging_code, packaging_type, packaging_date,
        net_weight, brix_avg,
        temp_water, temp_ambient, temp_pulp,
        notes, metrics
      )
      OUTPUT INSERTED.id
      VALUES (
        @commodity_id, @created_by_user_id,
        @producer, @lot, @variety, @caliber,
        @packaging_code, @packaging_type, @packaging_date,
        @net_weight, @brix_avg,
        @temp_water, @temp_ambient, @temp_pulp,
        @notes, @metrics
      )`,
      {
        commodity_id,
        created_by_user_id,
        producer, lot, variety, caliber,
        packaging_code, packaging_type, packaging_date,
        net_weight, brix_avg,
        temp_water, temp_ambient, temp_pulp,
        notes,
        metrics
      }
    )

    const inspectionId = ins.recordset?.[0]?.id

    // Si viene de una asignación, marcarla como completada
    if (assignment_id) {
      console.log(`✅ Marcando asignación ${assignment_id} como completada`)

      await query(
        `UPDATE assignments 
         SET status = 'completada',
             notes_admin = CONCAT(
               ISNULL(notes_admin, ''), 
               ' [Completada - Inspección ID: ', 
               @inspection_id, 
               ']'
             )
         WHERE id = @assignment_id`,
        {
          assignment_id,
          inspection_id: inspectionId
        }
      )
    }

    // crear registro pdf status (PENDING)
    await query(
      `IF NOT EXISTS (SELECT 1 FROM inspection_pdfs WHERE inspection_id=@inspection_id)
       INSERT INTO inspection_pdfs (inspection_id, status) VALUES (@inspection_id, 'PENDING')`,
      { inspection_id: inspectionId }
    )

    console.log(`✅ Inspección ${inspectionId} creada exitosamente`)

    return NextResponse.json({ ok: true, id: inspectionId })
  } catch (e) {
    console.error('[POST /inspecciones]', e)
    return NextResponse.json({ msg: 'Error creando inspección' }, { status: 500 })
  }
}