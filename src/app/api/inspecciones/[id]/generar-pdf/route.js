import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { generateInspectionPdfBuffer } from '@/lib/pdf/generateInspectionPdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeJsonParse(s, fallback) {
  try {
    if (!s) return fallback
    if (typeof s === 'object') return s
    return JSON.parse(String(s))
  } catch {
    return fallback
  }
}

function sectionTitleFromKey(key) {
  const prefix = String(key || '').split('.')[0]
  const map = {
    general: 'Aspectos Generales',
    quality: 'Calidad',
    condition: 'Condición',
    pack: 'Packaging',
    defects: 'Defectos',
    comments: 'Comentarios'
  }
  return map[prefix] || 'Parámetros'
}

export async function POST(req, { params }) {
  const v = await verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  const inspectionId = Number(params?.id)
  if (!inspectionId) return NextResponse.json({ msg: 'ID inválido' }, { status: 400 })

  const role = v.payload?.role
  const myId = Number(v.payload?.id)

  try {
    const r = await query(
      `SELECT TOP 1
         i.*,
         c.code AS commodity_code,
         c.name AS commodity_name
       FROM dbo.inspections i
       JOIN dbo.commodities c ON c.id=i.commodity_id
       WHERE i.id=@id`,
      { id: inspectionId }
    )
    const insp = r.recordset?.[0]
    if (!insp) return NextResponse.json({ msg: 'Inspección no encontrada' }, { status: 404 })

    // permisos
    if (role === 'inspector') {
      // regla típica: debe estar asignada a él (o creada por él)
      const assigned = Number(insp.assigned_to_user_id) === myId
      const created = Number(insp.created_by_user_id) === myId
      if (!assigned && !created) return NextResponse.json({ msg: 'No autorizado' }, { status: 403 })
    } else if (role !== 'admin') {
      return NextResponse.json({ msg: 'No autorizado' }, { status: 403 })
    }

    const metricsObj = safeJsonParse(insp.metrics, {})
    const values = metricsObj?.values || metricsObj || {}

    // template activo por commodity
    const tpl = await query(
      `SELECT TOP 1 mt.id
       FROM dbo.metric_templates mt
       WHERE mt.commodity_id=@commodity_id AND mt.active=1
       ORDER BY mt.version DESC, mt.id DESC`,
      { commodity_id: insp.commodity_id }
    )
    const template = tpl.recordset?.[0]

    let metrics_fields = []
    if (template?.id) {
      const f = await query(
        `SELECT [key], label, unit, order_index
         FROM dbo.metric_fields
         WHERE template_id=@template_id
         ORDER BY order_index ASC, id ASC`,
        { template_id: template.id }
      )

      metrics_fields = (f.recordset || []).map((row) => ({
        sectionTitle: sectionTitleFromKey(row.key),
        label: row.label,
        unit: row.unit || null,
        value: values?.[row.key] ?? null
      }))
    }

    const pdfBuffer = await generateInspectionPdfBuffer({
      commodity_code: insp.commodity_code,
      commodity_name: insp.commodity_name,
      producer: insp.producer,
      lot: insp.lot,
      variety: insp.variety,
      caliber: insp.caliber,
      packaging_code: insp.packaging_code,
      packaging_type: insp.packaging_type,
      packaging_date: insp.packaging_date,
      created_at: insp.created_at,
      metrics_fields
    })

    const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

    // DEV: guarda en public/pdfs
    const outDir = path.join(process.cwd(), 'public', 'pdfs')
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
    const filename = `inspection-${inspectionId}.pdf`
    fs.writeFileSync(path.join(outDir, filename), pdfBuffer)

    const pdf_url = `/pdfs/${filename}`

    // upsert inspection_pdfs
    await query(
      `MERGE dbo.inspection_pdfs AS t
       USING (SELECT @inspection_id AS inspection_id) AS s
       ON t.inspection_id = s.inspection_id
       WHEN MATCHED THEN
         UPDATE SET status='OK', pdf_url=@pdf_url, pdf_hash=@pdf_hash, updated_at=SYSUTCDATETIME()
       WHEN NOT MATCHED THEN
         INSERT (inspection_id, status, pdf_url, pdf_hash, created_at, updated_at)
         VALUES (@inspection_id, 'OK', @pdf_url, @pdf_hash, SYSUTCDATETIME(), SYSUTCDATETIME());`,
      { inspection_id: inspectionId, pdf_url, pdf_hash: hash }
    )

    return NextResponse.json({ ok: true, pdf_url })
  } catch (e) {
    console.error('[generar-pdf]', e)
    return NextResponse.json({ msg: 'Error generando PDF' }, { status: 500 })
  }
}
