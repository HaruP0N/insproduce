import { NextResponse } from 'next/server'
import { query } from '../../../../../lib/db/mssql'
import { verifyTokenFromRequest } from '../../../../../lib/auth/verifyToken'

function safeJsonParse(s, fallback) {
  try {
    if (s === null || s === undefined) return fallback
    if (typeof s === 'object') return s
    return JSON.parse(String(s))
  } catch {
    return fallback
  }
}

export async function GET(req) {
  const v = verifyTokenFromRequest(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  try {
    // ✅ sacar code desde la URL: /api/commodities/{CODE}/template
    const pathname = req.nextUrl.pathname
    const parts = pathname.split('/').filter(Boolean)
    const code = String(parts[parts.indexOf('commodities') + 1] || '').trim().toUpperCase()

    if (!code) return NextResponse.json({ msg: 'code requerido' }, { status: 400 })
    if (code === 'CHERRY') return NextResponse.json({ msg: 'CHERRY deshabilitado' }, { status: 400 })

    const c = await query(
      `SELECT TOP 1 id, code, name, active
       FROM commodities
       WHERE code=@code AND active=1`,
      { code }
    )
    const commodity = c.recordset?.[0]
    if (!commodity) return NextResponse.json({ msg: 'Commodity no existe o está inactivo' }, { status: 404 })

    const t = await query(
      `SELECT TOP 1 id, name, version
       FROM metric_templates
       WHERE commodity_id=@commodity_id AND active=1
       ORDER BY version DESC, id DESC`,
      { commodity_id: commodity.id }
    )
    const template = t.recordset?.[0]
    if (!template) return NextResponse.json({ commodity, template: null, fields: [] })

    const f = await query(
      `SELECT [key], label, field_type, required, unit, min_value, max_value, options, order_index
       FROM metric_fields
       WHERE template_id=@template_id
       ORDER BY order_index ASC, id ASC`,
      { template_id: template.id }
    )

    const fields = (f.recordset || []).map(row => ({
      ...row,
      required: !!row.required,
      options: safeJsonParse(row.options, [])
    }))

    return NextResponse.json({ commodity, template, fields })
  } catch (e) {
    console.error('[commodities template]', e)
    return NextResponse.json({ msg: 'Error al cargar template' }, { status: 500 })
  }
}
