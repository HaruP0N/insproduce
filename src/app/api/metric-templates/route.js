import { NextResponse } from 'next/server'
import { query } from '../../../lib/db/mssql'
import { verifyTokenFromRequest } from '../../../lib/auth/verifyToken'

export async function POST(req) {
  const v = verifyTokenFromRequest(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  if (v.payload?.role !== 'admin') {
    return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const commodityCode = String(body.commodityCode || '').trim().toUpperCase()
  const name = String(body.name || '').trim()
  const fields = Array.isArray(body.fields) ? body.fields : null

  if (!commodityCode) return NextResponse.json({ msg: 'commodityCode requerido' }, { status: 400 })
  if (!name) return NextResponse.json({ msg: 'name requerido' }, { status: 400 })
  if (!Array.isArray(fields)) return NextResponse.json({ msg: 'fields debe ser array' }, { status: 400 })

  try {
    const c = await query(
      `SELECT TOP 1 id, code, name, active
       FROM commodities
       WHERE code=@code AND active=1`,
      { code: commodityCode }
    )
    const commodity = c.recordset?.[0]
    if (!commodity) return NextResponse.json({ msg: 'Commodity no encontrada o inactiva' }, { status: 404 })

    // version siguiente
    const vq = await query(
      `SELECT ISNULL(MAX(version),0) AS maxv
       FROM metric_templates
       WHERE commodity_id=@commodity_id`,
      { commodity_id: commodity.id }
    )
    const nextVersion = Number(vq.recordset?.[0]?.maxv || 0) + 1

    // desactiva templates anteriores
    await query(
      `UPDATE metric_templates SET active=0 WHERE commodity_id=@commodity_id`,
      { commodity_id: commodity.id }
    )

    // crea template activo
    const t = await query(
      `INSERT INTO metric_templates (commodity_id, version, name, active, created_at)
       OUTPUT INSERTED.id
       VALUES (@commodity_id, @version, @name, 1, GETDATE())`,
      { commodity_id: commodity.id, version: nextVersion, name }
    )
    const templateId = t.recordset?.[0]?.id
    if (!templateId) return NextResponse.json({ msg: 'No se pudo crear template' }, { status: 500 })

    // inserta fields
    for (const it of fields) {
      const key = String(it.key || it['key'] || '').trim()
      const label = String(it.label || '').trim()
      const field_type = String(it.field_type || '').trim()
      const required = !!it.required
      const unit = it.unit !== undefined && it.unit !== null ? String(it.unit) : null
      const min_value = it.min_value !== undefined && it.min_value !== null ? Number(it.min_value) : null
      const max_value = it.max_value !== undefined && it.max_value !== null ? Number(it.max_value) : null
      const options = JSON.stringify(Array.isArray(it.options) ? it.options : [])
      const order_index = it.order_index !== undefined ? Number(it.order_index) : 0

      if (!key || !label || !field_type) continue

      await query(
        `INSERT INTO metric_fields
          (template_id, [key], label, field_type, required, unit, min_value, max_value, options, order_index)
         VALUES
          (@template_id, @key, @label, @field_type, @required, @unit, @min_value, @max_value, @options, @order_index)`,
        {
          template_id: templateId,
          key,
          label,
          field_type,
          required,
          unit,
          min_value,
          max_value,
          options,
          order_index
        }
      )
    }

    return NextResponse.json({ ok: true, templateId, version: nextVersion })
  } catch (e) {
    console.error('[metric-templates POST]', e)
    return NextResponse.json({ msg: 'Error creando template' }, { status: 500 })
  }
}
