import { NextResponse } from 'next/server'
import { query } from '../../../../../lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'


export async function PUT(req, { params }) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  if (v.payload?.role !== 'admin') {
    return NextResponse.json({ msg: 'Solo admin' }, { status: 403 })
  }

  try {
    const templateId = Number(params?.id)
    if (!templateId) return NextResponse.json({ msg: 'templateId inválido' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const fields = Array.isArray(body.fields) ? body.fields : []
    if (!Array.isArray(fields)) return NextResponse.json({ msg: 'fields debe ser array' }, { status: 400 })

    await query(`DELETE FROM metric_fields WHERE template_id=@template_id`, { template_id: templateId })

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

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[metric-templates PUT]', e)
    return NextResponse.json({ msg: 'Error actualizando fields' }, { status: 500 })
  }
}
