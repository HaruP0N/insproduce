import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'

export async function GET(req, context) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  try {
    const params = await context.params
    const id = Number(params?.id)

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ msg: 'ID inválido' }, { status: 400 })
    }

    const r = await query(
      `SELECT 
         i.*,
         c.code as commodity_code,
         c.name as commodity_name
       FROM inspections i
       LEFT JOIN commodities c ON c.id = i.commodity_id
       WHERE i.id = @id`,
      { id }
    )

    if (!r.recordset?.length) {
      return NextResponse.json({ msg: 'No encontrada' }, { status: 404 })
    }

    const insp = r.recordset[0]

    // 🔧 Normalizar metrics: siempre retornar { values: {...} }
    let metrics = insp.metrics
    try {
      if (typeof metrics === 'string') metrics = JSON.parse(metrics)
    } catch {
      metrics = {}
    }

    // Si metrics es un objeto plano SIN capa "values", envolverlo
    if (metrics && typeof metrics === 'object' && !metrics.values) {
      metrics = { values: metrics }
    } else if (!metrics || typeof metrics !== 'object') {
      metrics = { values: {} }
    }

    return NextResponse.json({ ...insp, metrics })
  } catch (e) {
    console.error('[GET /inspecciones/[id]]', e)
    return NextResponse.json({ msg: 'Error al obtener inspección' }, { status: 500 })
  }
}

export async function PUT(req, context) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  try {
    const params = await context.params
    const id = Number(params?.id)

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ msg: 'ID inválido' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))

    const {
      producer, lot, variety, caliber,
      packaging_code, packaging_type, packaging_date
    } = body

    await query(
      `UPDATE inspections 
       SET producer = @producer,
           lot = @lot,
           variety = @variety,
           caliber = @caliber,
           packaging_code = @packaging_code,
           packaging_type = @packaging_type,
           packaging_date = @packaging_date,
           pdf_url = NULL,
           pdf_hash = NULL,
           updated_at = GETDATE()
       WHERE id = @id`,
      {
        id,
        producer: producer || null,
        lot: lot || null,
        variety: variety || null,
        caliber: caliber || null,
        packaging_code: packaging_code || null,
        packaging_type: packaging_type || null,
        packaging_date: packaging_date || null
      }
    )

    return NextResponse.json({ ok: true, id })
  } catch (e) {
    console.error('[PUT /inspecciones/[id]]', e)
    return NextResponse.json({ msg: 'Error al actualizar inspección' }, { status: 500 })
  }
}