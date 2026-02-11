import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
// 🔧 CAMBIAR ESTO:
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'

function safeJsonParse(s, fallback) {
  try {
    if (s === null || s === undefined) return fallback
    if (typeof s === 'object') return s
    return JSON.parse(String(s))
  } catch {
    return fallback
  }
}

function getIdFromPath(req) {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean)
  // /api/inspecciones/{id}
  return Number(parts[parts.indexOf('inspecciones') + 1])
}

export async function GET(req) {
  // 🔧 CAMBIAR ESTO:
  const v = verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })
  if (v.payload?.role !== 'admin') return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })

  try {
    const id = getIdFromPath(req)
    if (!id) return NextResponse.json({ msg: 'ID inválido' }, { status: 400 })

    const r = await query(
      `SELECT TOP 1
        i.*,
        c.code AS commodity_code, c.name AS commodity_name,
        u.email AS created_by_email
       FROM inspections i
       JOIN commodities c ON c.id = i.commodity_id
       LEFT JOIN users u ON u.id = i.created_by_user_id
       WHERE i.id=@id`,
      { id }
    )

    const inspection = r.recordset?.[0]
    if (!inspection) return NextResponse.json({ msg: 'Inspección no encontrada' }, { status: 404 })

    inspection.metrics = safeJsonParse(inspection.metrics, {})

    const ph = await query(
      `SELECT id, inspection_id, url, label, created_at
       FROM inspection_photos
       WHERE inspection_id=@inspection_id
       ORDER BY id ASC`,
      { inspection_id: id }
    )

    const pdf = await query(
      `SELECT inspection_id, status, pdf_url, pdf_hash, updated_at, error_message
       FROM inspection_pdfs
       WHERE inspection_id=@inspection_id`,
      { inspection_id: id }
    )

    return NextResponse.json({
      inspection,
      photos: ph.recordset || [],
      pdf: (pdf.recordset && pdf.recordset[0]) ? pdf.recordset[0] : null
    })
  } catch (e) {
    console.error('[GET /inspecciones/:id]', e)
    return NextResponse.json({ msg: 'Error obteniendo detalle' }, { status: 500 })
  }
}

export async function PUT(req) {
  // 🔧 CAMBIAR ESTO:
  const v = verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })
  if (v.payload?.role !== 'admin') return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })

  try {
    const id = getIdFromPath(req)
    if (!id) return NextResponse.json({ msg: 'ID inválido' }, { status: 400 })

    const body = await req.json().catch(() => ({}))

    const producer = body.producer !== undefined ? String(body.producer) : null
    const lot = body.lot !== undefined ? String(body.lot) : null
    const variety = body.variety !== undefined ? String(body.variety) : null
    const caliber = body.caliber !== undefined ? String(body.caliber) : null

    const packaging_code = body.packaging_code !== undefined ? String(body.packaging_code) : null
    const packaging_type = body.packaging_type !== undefined ? String(body.packaging_type) : null
    const packaging_date = body.packaging_date !== undefined ? String(body.packaging_date) : null

    const net_weight = body.net_weight !== undefined && body.net_weight !== null ? Number(body.net_weight) : null
    const brix_avg = body.brix_avg !== undefined && body.brix_avg !== null ? Number(body.brix_avg) : null

    const temp_water = body.temp_water !== undefined && body.temp_water !== null ? Number(body.temp_water) : null
    const temp_ambient = body.temp_ambient !== undefined && body.temp_ambient !== null ? Number(body.temp_ambient) : null
    const temp_pulp = body.temp_pulp !== undefined && body.temp_pulp !== null ? Number(body.temp_pulp) : null

    const notes = body.notes !== undefined ? String(body.notes) : null

    let metricsJson = null
    if (body.metrics !== undefined) {
      metricsJson = typeof body.metrics === 'string' 
        ? body.metrics 
        : JSON.stringify(body.metrics)
    }

    let sql = `UPDATE inspections
       SET updated_at = GETDATE(),
           producer=@producer,
           lot=@lot,
           variety=@variety,
           caliber=@caliber,
           packaging_code=@packaging_code,
           packaging_type=@packaging_type,
           packaging_date=@packaging_date,
           net_weight=@net_weight,
           brix_avg=@brix_avg,
           temp_water=@temp_water,
           temp_ambient=@temp_ambient,
           temp_pulp=@temp_pulp,
           notes=@notes`

    const params = {
      id,
      producer, lot, variety, caliber,
      packaging_code, packaging_type, packaging_date,
      net_weight, brix_avg,
      temp_water, temp_ambient, temp_pulp,
      notes
    }

    if (metricsJson !== null) {
      sql += `, metrics=@metrics`
      params.metrics = metricsJson
    }

    sql += ` WHERE id=@id`

    await query(sql, params)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[PUT /inspecciones/:id]', e)
    return NextResponse.json({ msg: 'Error actualizando inspección' }, { status: 500 })
  }
}