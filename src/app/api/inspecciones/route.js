// src/app/api/inspecciones/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromRequest } from '@/lib/auth/verifyToken'

export async function POST(req) {
  const v = verifyTokenFromRequest(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  try {
    const body = await req.json().catch(() => ({}))
    const { 
      commodity_code, producer, lot, variety, caliber,
      packaging_code, packaging_type, packaging_date,
      net_weight, brix_avg, temp_water, temp_ambient, temp_pulp,
      notes, metrics, photos, assignment_id 
    } = body

    if (!commodity_code) {
      return NextResponse.json({ msg: 'commodity_code requerido' }, { status: 400 })
    }

    // Buscar commodity
    const cRes = await query(
      `SELECT id FROM commodities WHERE UPPER(code) = @code AND active = 1`,
      { code: commodity_code.toUpperCase() }
    )

    if (!cRes.recordset?.length) {
      return NextResponse.json({ msg: `Commodity ${commodity_code} no encontrado` }, { status: 404 })
    }

    const commodityId = cRes.recordset[0].id

    // Crear metrics JSON
    const metricsObj = {
      template_id: null,
      template_version: null,
      values: metrics || {}
    }
    const metricsJson = JSON.stringify(metricsObj)

    // Insertar inspección
    const iRes = await query(
      `INSERT INTO inspections 
        (commodity_id, created_by_user_id, producer, lot, variety, caliber,
         packaging_code, packaging_type, packaging_date, net_weight, brix_avg,
         temp_water, temp_ambient, temp_pulp, notes, metrics)
       OUTPUT inserted.id
       VALUES 
        (@commodity_id, @user_id, @producer, @lot, @variety, @caliber,
         @packaging_code, @packaging_type, @packaging_date, @net_weight, @brix_avg,
         @temp_water, @temp_ambient, @temp_pulp, @notes, @metrics)`,
      {
        commodity_id: commodityId,
        user_id: v.user.id,
        producer: producer || null,
        lot: lot || null,
        variety: variety || null,
        caliber: caliber || null,
        packaging_code: packaging_code || null,
        packaging_type: packaging_type || null,
        packaging_date: packaging_date || null,
        net_weight: net_weight,
        brix_avg: brix_avg,
        temp_water: temp_water,
        temp_ambient: temp_ambient,
        temp_pulp: temp_pulp,
        notes: notes || null,
        metrics: metricsJson
      }
    )

    const inspectionId = iRes.recordset[0].id

    // Guardar fotos por métrica
    if (photos && typeof photos === 'object') {
      for (const [metricKey, urls] of Object.entries(photos)) {
        if (Array.isArray(urls) && urls.length > 0) {
          for (const url of urls) {
            await query(
              `INSERT INTO inspection_photos (inspection_id, metric_key, url, label)
               VALUES (@inspection_id, @metric_key, @url, @label)`,
              {
                inspection_id: inspectionId,
                metric_key: metricKey,
                url: url,
                label: metricKey // Puedes mejorar esto después
              }
            )
          }
        }
      }
    }

    // Si viene de assignment, actualizar status a completada
    if (assignment_id) {
      await query(
        `UPDATE assignments SET status = 'completada' WHERE id = @id`,
        { id: parseInt(assignment_id) }
      )
    }

    // Crear entrada en inspection_pdfs
    await query(
      `INSERT INTO inspection_pdfs (inspection_id, status) VALUES (@id, 'PENDING')`,
      { id: inspectionId }
    )

    return NextResponse.json({ ok: true, id: inspectionId })
  } catch (e) {
    console.error('[POST /inspecciones]', e)
    return NextResponse.json({ msg: 'Error: ' + e.message }, { status: 500 })
  }
}

// GET para historial (mantener tu código actual)
export async function GET(req) {
  const v = verifyTokenFromRequest(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  try {
    const result = await query(
      `SELECT 
        i.id, i.created_at, i.updated_at, i.producer, i.lot, i.variety,
        c.code AS commodity_code, c.name AS commodity_name,
        p.pdf_url, p.status AS pdf_status
       FROM inspections i
       JOIN commodities c ON c.id = i.commodity_id
       LEFT JOIN inspection_pdfs p ON p.inspection_id = i.id
       WHERE i.created_by_user_id = @userId
       ORDER BY i.created_at DESC`,
      { userId: v.user.id }
    )

    return NextResponse.json(result.recordset || [])
  } catch (e) {
    console.error('[GET /inspecciones/historial]', e)
    return NextResponse.json({ msg: 'Error: ' + e.message }, { status: 500 })
  }
}