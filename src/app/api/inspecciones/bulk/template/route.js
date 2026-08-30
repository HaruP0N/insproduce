// Descarga de la plantilla Excel para carga masiva, generada según el commodity:
// columnas de cabecera fijas + una columna por métrica de su plantilla activa.
import { requireAuth } from '@/lib/auth/requireAuth'
import { fail, serverError } from '@/lib/http'
import { getTemplateFieldsByCommodityCode } from '@/lib/repos/catalog'
import { HEADER_COLUMNS } from '@/lib/bulkImport'
import ExcelJS from 'exceljs'

export const runtime = 'nodejs'

const NAVY = 'FF1F3864'
const REQ = 'FF9C4E1C'
const METRIC = 'FF2E5E3A'

export async function GET(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const { searchParams } = new URL(req.url)
    const code = String(searchParams.get('commodity') || 'BLUEBERRY').toUpperCase()
    const lang = searchParams.get('lang') === 'en' ? 'en' : 'es'

    const { commodity, fields } = await getTemplateFieldsByCommodityCode(code)

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Fruitbrix Field'
    const ws = wb.addWorksheet(lang === 'en' ? 'Inspections' : 'Inspecciones', {
      views: [{ state: 'frozen', ySplit: 1 }],
    })

    const cols = [
      ...HEADER_COLUMNS.map((c) => ({ header: c[lang] + (c.req ? ' *' : ''), key: c.key, width: c.width })),
      ...fields.map((f) => ({ header: f.label, key: f.key, width: Math.min(22, Math.max(12, f.label.length + 2)) })),
    ]
    ws.columns = cols

    const head = ws.getRow(1)
    head.height = 22
    head.eachCell((cell, i) => {
      const isMetric = i > HEADER_COLUMNS.length
      const isReq = !isMetric && HEADER_COLUMNS[i - 1]?.req
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isMetric ? METRIC : isReq ? REQ : NAVY } }
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.alignment = { vertical: 'middle', wrapText: true }
    })

    // Fila de ejemplo (se borra antes de cargar; queda en gris/cursiva para que se note)
    const example = {
      producer: lang === 'en' ? 'EXAMPLE — delete this row' : 'EJEMPLO — borrar esta fila',
      lot: 'L-2026-001', pallet_number: 'P1', variety: 'Duke', packaging_type: '12x6 Oz',
      packaging_date: new Date().toISOString().slice(0, 10),
      net_weight: 277, sample_weight_g: 1070, ten_pieces_weight_g: 28, brix_avg: 12.5, temp_pulp: 1.5,
      baxlo_min: 62, baxlo_mode: 78, baxlo_max: 88,
    }
    for (const f of fields.slice(0, 3)) example[f.key] = 0
    const exRow = ws.addRow(example)
    exRow.eachCell({ includeEmpty: true }, (c) => {
      c.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF9AA1AC' } }
    })

    // Hoja de instrucciones
    const help = wb.addWorksheet(lang === 'en' ? 'Instructions' : 'Instrucciones')
    help.columns = [{ width: 100 }]
    const lines = lang === 'en' ? [
      'HOW TO USE THIS TEMPLATE',
      '',
      '1. Delete the grey example row.',
      '2. Add one row per inspection (one pallet/lot each).',
      '3. Columns marked with * are required: Producer and Lot.',
      '4. Orange = required · Dark blue = header data · Green = defect metrics (in %).',
      '5. Leave a cell empty if you have no data for it — it will simply not be recorded.',
      '6. Do not rename or reorder the columns; extra columns are ignored.',
      '7. Save and upload the file in Inspections > Bulk upload.',
      '',
      `Commodity: ${commodity.name} (${commodity.code}) — ${fields.length} metrics available.`,
      'The score and resolution (approved / conditional / rejected) are computed automatically.',
    ] : [
      'CÓMO USAR ESTA PLANTILLA',
      '',
      '1. Borra la fila gris de ejemplo.',
      '2. Agrega una fila por inspección (un pallet/lote cada una).',
      '3. Las columnas con * son obligatorias: Productor y Lote.',
      '4. Naranjo = obligatorio · Azul = datos de cabecera · Verde = métricas de defectos (en %).',
      '5. Deja la celda vacía si no tienes ese dato — simplemente no se registra.',
      '6. No cambies el nombre ni el orden de las columnas; las columnas extra se ignoran.',
      '7. Guarda y sube el archivo en Inspecciones > Carga masiva.',
      '',
      `Commodity: ${commodity.name} (${commodity.code}) — ${fields.length} métricas disponibles.`,
      'El score y la resolución (aprobado / condicional / rechazado) se calculan automáticamente.',
    ]
    lines.forEach((text, i) => {
      const row = help.addRow([text])
      row.getCell(1).font = { name: 'Calibri', size: i === 0 ? 13 : 11, bold: i === 0 }
      row.getCell(1).alignment = { wrapText: true }
    })

    const buf = await wb.xlsx.writeBuffer()
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="plantilla-inspecciones-${code.toLowerCase()}.xlsx"`,
      },
    })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('bulk/template', e)
  }
}
