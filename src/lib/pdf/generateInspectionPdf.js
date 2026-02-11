import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

function safeText(v) {
  if (v === undefined || v === null) return '-'
  const s = String(v).trim()
  return s.length ? s : '-'
}

function formatDateDDMMYY(dateLike) {
  if (!dateLike) return '-'
  const d = new Date(dateLike)
  if (Number.isNaN(d.getTime())) return '-'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}/${mm}/${yy}`
}

function drawSectionTitle(doc, title) {
  doc
    .moveDown(1)
    .fontSize(14)
    .fillColor('#2E7D32')
    .font('Helvetica-Bold')
    .text(title)

  doc
    .moveDown(0.3)
    .strokeColor('#2E7D32')
    .lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke()

  doc.moveDown(0.6)
}

function drawKeyValue(doc, key, value) {
  doc.fontSize(11).fillColor('#111').font('Helvetica-Bold').text(`${key}: `, { continued: true })
  doc.font('Helvetica').text(`${value}`)
}

/**
 * @param {object} data
 *  data = {
 *   commodity_code, commodity_name,
 *   producer, lot, variety, caliber, packaging_code, packaging_type, packaging_date,
 *   created_at,
 *   metrics_fields: [{ sectionTitle, label, value, unit }]
 *  }
 * @returns {Promise<Buffer>}
 */
export async function generateInspectionPdfBuffer(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40 })
      const chunks = []

      doc.on('data', (c) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // ===== Header con logo (si existe)
      const logoPath = path.join(process.cwd(), 'public', 'logo-insproduce.png')
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, doc.page.margins.left, 32, { fit: [160, 60] })
        } catch {}
      }

      doc
        .fontSize(18)
        .fillColor('#2E7D32')
        .font('Helvetica-Bold')
        .text('INSPRODUCE INSPECTION REPORT', { align: 'right' })

      doc
        .moveDown(0.2)
        .fontSize(10)
        .fillColor('#555')
        .font('Helvetica')
        .text(`${safeText(data.commodity_code)} • ${safeText(data.commodity_name)}`, { align: 'right' })

      doc.moveDown(1)

      // ===== Identificación
      drawSectionTitle(doc, 'Identificación del Lote')
      drawKeyValue(doc, 'Productor', safeText(data.producer))
      drawKeyValue(doc, 'Lote', safeText(data.lot))
      drawKeyValue(doc, 'Variedad', safeText(data.variety))
      drawKeyValue(doc, 'Calibre', safeText(data.caliber))
      drawKeyValue(doc, 'Código Embalaje', safeText(data.packaging_code))
      drawKeyValue(doc, 'Tipo Embalaje', safeText(data.packaging_type))
      drawKeyValue(doc, 'Fecha Embalaje', formatDateDDMMYY(data.packaging_date))
      drawKeyValue(doc, 'Fecha Inspección', formatDateDDMMYY(data.created_at))

      // ===== Métricas (ya resueltas con labels/units)
      const fields = Array.isArray(data.metrics_fields) ? data.metrics_fields : []
      if (fields.length) {
        const bySection = {}
        for (const f of fields) {
          const section = f.sectionTitle || 'Parámetros'
          if (!bySection[section]) bySection[section] = []
          bySection[section].push(f)
        }

        for (const sectionName of Object.keys(bySection)) {
          drawSectionTitle(doc, sectionName)
          for (const f of bySection[sectionName]) {
            const unit = f.unit ? ` ${f.unit}` : ''
            const v = safeText(f.value)
            doc.fontSize(11).fillColor('#111').font('Helvetica-Bold').text(`${f.label}: `, { continued: true })
            doc.font('Helvetica').text(`${v}${v !== '-' ? unit : ''}`)
          }
        }
      }

      doc.end()
    } catch (e) {
      reject(e)
    }
  })
}
