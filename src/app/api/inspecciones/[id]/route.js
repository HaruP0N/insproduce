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
        i.net_weight,
        i.brix_avg, i.brix_min, i.brix_max, i.brix_moda,
        i.temp_water, i.temp_ambient, i.temp_pulp,
        i.diameter_min, i.diameter_max,
        i.notes, i.metrics,
        c.code  AS commodity_code,
        c.name  AS commodity_name,
        p.pdf_url
       FROM inspections i
       LEFT JOIN commodities     c ON c.id = i.commodity_id
       LEFT JOIN inspection_pdfs p ON p.inspection_id = i.id
       WHERE i.id = @id`,
      { id: parseInt(id) }
    )

    if (!result.recordset?.length)
      return NextResponse.json({ msg: 'Inspección no encontrada' }, { status: 404 })

    const row = result.recordset[0]

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
      packaging_code, packaging_type, packaging_date,
      net_weight,
      brix_avg, brix_min, brix_max, brix_moda,
      temp_water, temp_ambient, temp_pulp,
      diameter_min, diameter_max,
      notes
    } = body

    await query(
      `UPDATE inspections SET
        producer       = @producer,
        lot            = @lot,
        variety        = @variety,
        caliber        = @caliber,
        packaging_code = @packaging_code,
        packaging_type = @packaging_type,
        packaging_date = @packaging_date,
        net_weight     = @net_weight,
        brix_avg       = @brix_avg,
        brix_min       = @brix_min,
        brix_max       = @brix_max,
        brix_moda      = @brix_moda,
        temp_water     = @temp_water,
        temp_ambient   = @temp_ambient,
        temp_pulp      = @temp_pulp,
        diameter_min   = @diameter_min,
        diameter_max   = @diameter_max,
        notes          = @notes
       WHERE id = @id`,
      {
        id:             parseInt(id),
        producer:       producer       || null,
        lot:            lot            || null,
        variety:        variety        || null,
        caliber:        caliber        || null,
        packaging_code: packaging_code || null,
        packaging_type: packaging_type || null,
        packaging_date: packaging_date || null,
        net_weight:     net_weight     != null && net_weight !== '' ? Number(net_weight)    : null,
        brix_avg:       brix_avg       != null && brix_avg   !== '' ? Number(brix_avg)      : null,
        brix_min:       brix_min       != null && brix_min   !== '' ? Number(brix_min)      : null,
        brix_max:       brix_max       != null && brix_max   !== '' ? Number(brix_max)      : null,
        brix_moda:      brix_moda      != null && brix_moda  !== '' ? Number(brix_moda)     : null,
        temp_water:     temp_water     != null && temp_water !== '' ? Number(temp_water)    : null,
        temp_ambient:   temp_ambient   != null && temp_ambient !== '' ? Number(temp_ambient) : null,
        temp_pulp:      temp_pulp      != null && temp_pulp  !== '' ? Number(temp_pulp)     : null,
        diameter_min:   diameter_min   != null && diameter_min !== '' ? Number(diameter_min) : null,
        diameter_max:   diameter_max   != null && diameter_max !== '' ? Number(diameter_max) : null,
        notes:          notes          || null
      }
    )

    return NextResponse.json({ ok: true, msg: 'Cabecera actualizada' })
  } catch (e) {
    console.error('❌ [PUT inspecciones/id]', e)
    return NextResponse.json({ msg: 'Error: ' + e.message }, { status: 500 })
  }
}