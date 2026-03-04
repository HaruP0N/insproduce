// src/app/api/inspecciones/[id]/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { query } from '@/lib/db/mssql'

function safeJson(v) {
  if (!v) return {}
  try { return typeof v === 'string' ? JSON.parse(v) : v }
  catch { return {} }
}

// GET — Detalle completo de una inspección
export async function GET(req, context) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok || !v.user) return NextResponse.json({ msg: 'No autenticado' }, { status: 401 })

  try {
    const { id } = await context.params

    const result = await query(
      `SELECT
        i.id, i.created_at, i.updated_at,
        i.producer, i.lot, i.variety, i.caliber,
        i.packaging_code, i.packaging_type, i.packaging_date,
        i.net_weight, i.brix_avg,
        i.temp_water, i.temp_ambient, i.temp_pulp,
        i.notes, i.metrics,
        c.code  AS commodity_code,
        c.name  AS commodity_name,
        p.pdf_url
       FROM inspections i
       LEFT JOIN commodities       c ON c.id = i.commodity_id
       LEFT JOIN inspection_pdfs   p ON p.inspection_id = i.id
       WHERE i.id = @id`,
      { id: parseInt(id) }
    )

    if (!result.recordset?.length)
      return NextResponse.json({ msg: 'Inspección no encontrada' }, { status: 404 })

    const row = result.recordset[0]

    // metrics siempre como objeto { template_id, values }
    const metricsRaw = safeJson(row.metrics)
    const metrics = {
      template_id: metricsRaw.template_id ?? null,
      values:      metricsRaw.values      ?? {}
    }

    return NextResponse.json({ ...row, metrics })
  } catch (e) {
    console.error('❌ [GET inspecciones/id]', e)
    return NextResponse.json({ msg: 'Error: ' + e.message }, { status: 500 })
  }
}

// PUT — Actualizar cabecera de una inspección
export async function PUT(req, context) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok || !v.user) return NextResponse.json({ msg: 'No autenticado' }, { status: 401 })
  if (v.user.role !== 'admin') return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })

  try {
    const { id } = await context.params
    const body = await req.json().catch(() => ({}))

    const {
      producer, lot, variety, caliber,
      packaging_code, packaging_type, packaging_date
    } = body

    await query(
      `UPDATE inspections SET
        producer       = @producer,
        lot            = @lot,
        variety        = @variety,
        caliber        = @caliber,
        packaging_code = @packaging_code,
        packaging_type = @packaging_type,
        packaging_date = @packaging_date
       WHERE id = @id`,
      {
        id: parseInt(id),
        producer:       producer       || null,
        lot:            lot            || null,
        variety:        variety        || null,
        caliber:        caliber        || null,
        packaging_code: packaging_code || null,
        packaging_type: packaging_type || null,
        packaging_date: packaging_date || null
      }
    )

    return NextResponse.json({ ok: true, msg: 'Cabecera actualizada' })
  } catch (e) {
    console.error('❌ [PUT inspecciones/id]', e)
    return NextResponse.json({ msg: 'Error: ' + e.message }, { status: 500 })
  }
}