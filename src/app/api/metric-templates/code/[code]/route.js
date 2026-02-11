import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'

function safeJsonArray(v) {
  if (!v) return []
  try {
    const parsed = typeof v === 'string' ? JSON.parse(v) : v
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function GET(req, context) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  // 🔧 CAMBIO: await params (Next.js 13+)
  const params = await context.params
  const code = String(params?.code || '').trim().toUpperCase()
  
  if (!code) {
    console.log('[metric-templates/code] No se recibió code:', params)
    return NextResponse.json({ msg: 'code requerido' }, { status: 400 })
  }

  console.log('[metric-templates/code] Buscando template para:', code)

  try {
    // busca la template "más reciente" para el commodity_code
    const tRes = await query(
      `SELECT TOP 1 id, name, version, commodity_code
       FROM metric_templates
       WHERE UPPER(commodity_code)=@code
       ORDER BY version DESC, id DESC`,
      { code }
    )

    const template = tRes.recordset?.[0]
    
    if (!template) {
      console.log('[metric-templates/code] No se encontró template para:', code)
      return NextResponse.json({ msg: `Commodity sin template: ${code}` }, { status: 404 })
    }

    console.log('[metric-templates/code] Template encontrada:', template.id, template.name)

    const fRes = await query(
      `SELECT [key], label, field_type, required, unit, min_value, max_value, options, order_index
       FROM metric_fields
       WHERE template_id=@template_id
       ORDER BY order_index ASC, [key] ASC`,
      { template_id: template.id }
    )

    const fields = (fRes.recordset || []).map(r => ({
      key: r.key,
      label: r.label,
      field_type: r.field_type,
      required: !!r.required,
      unit: r.unit ?? null,
      min_value: r.min_value ?? null,
      max_value: r.max_value ?? null,
      options: safeJsonArray(r.options),
      order_index: Number(r.order_index ?? 0)
    }))

    console.log('[metric-templates/code] Retornando', fields.length, 'fields')

    return NextResponse.json({
      template: { id: template.id, name: template.name, version: template.version },
      fields
    })
  } catch (e) {
    console.error('[metric-templates code GET]', e)
    return NextResponse.json({ msg: 'Error obteniendo template' }, { status: 500 })
  }
}