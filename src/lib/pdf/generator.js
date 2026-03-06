// src/lib/pdf/generator.js
import { jsPDF } from 'jspdf'
import fetch from 'node-fetch'

export async function generateInspectionPDF(inspection, photos = {}) {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })

    const margin      = 20
    const pageWidth   = 216
    const pageHeight  = 279
    const contentWidth = pageWidth - margin * 2
    const footerY     = 272
    const safeBottom  = footerY - 8   // zona segura antes del footer

    let yPos = 20

    // ── helpers de página ──────────────────────────────────
    const checkPage = (needed = 20) => {
      if (yPos + needed > safeBottom) {
        doc.addPage()
        yPos = 20
      }
    }

    // ═══════════════════════════════════════════════════════
    // HEADER
    // ═══════════════════════════════════════════════════════
    doc.setFontSize(24)
    doc.setTextColor(22, 163, 74)
    doc.text('INSPRODUCE', margin, yPos)

    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text(`Fecha: ${new Date(inspection.created_at).toLocaleDateString('es-CL')}`, pageWidth - margin, yPos, { align: 'right' })

    yPos += 10
    doc.setFontSize(18)
    doc.setTextColor(17, 24, 39)
    doc.text('REPORTE DE INSPECCIÓN', margin, yPos)

    yPos += 7
    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text(`ID: #${inspection.id}`, margin, yPos)

    yPos += 5
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.5)
    doc.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 10

    // ═══════════════════════════════════════════════════════
    // INFORMACIÓN GENERAL
    // ═══════════════════════════════════════════════════════
    checkPage(30)
    yPos = drawSectionHeader(doc, 'INFORMACIÓN GENERAL', yPos, margin, pageWidth, '#16a34a')
    yPos += 5

    const generalInfo = [
      ['Productor', inspection.producer],
      ['Lote',      inspection.lot],
      ['Commodity', `${inspection.commodity_code || ''} ${inspection.commodity_name ? '(' + inspection.commodity_name + ')' : ''}`],
      ['Variedad',  inspection.variety]
    ].filter(([, v]) => v)

    yPos = drawKeyValueGrid(doc, generalInfo, yPos, margin, contentWidth, 2)
    yPos += 8

    // ═══════════════════════════════════════════════════════
    // EMBALAJE Y TEMPERATURA
    // ═══════════════════════════════════════════════════════
    checkPage(30)
    yPos = drawSectionHeader(doc, 'EMBALAJE Y TEMPERATURA', yPos, margin, pageWidth, '#16a34a')
    yPos += 5

    const packagingInfo = [
      ['Código embalaje', inspection.packaging_code],
      ['Tipo embalaje',   inspection.packaging_type],
      ['Fecha embalaje',  inspection.packaging_date ? formatDate(inspection.packaging_date) : null],
      ['Peso neto',       inspection.net_weight    ? `${inspection.net_weight} kg`    : null],
      ['Brix promedio',   inspection.brix_avg      ? `${inspection.brix_avg}°`        : null],
      ['Brix mín / máx',  (inspection.brix_min != null || inspection.brix_max != null) ? `${inspection.brix_min ?? '--'} / ${inspection.brix_max ?? '--'}` : null],
      ['Brix moda',       inspection.brix_moda     ? `${inspection.brix_moda}°`       : null],
      ['Temp. agua',      inspection.temp_water    ? `${inspection.temp_water}°C`     : null],
      ['Temp. ambiente',  inspection.temp_ambient  ? `${inspection.temp_ambient}°C`   : null],
      ['Temp. pulpa',     inspection.temp_pulp     ? `${inspection.temp_pulp}°C`      : null],
      ['Diámetro mín',    inspection.diameter_min  ? `${inspection.diameter_min} mm`  : null],
      ['Diámetro máx',    inspection.diameter_max  ? `${inspection.diameter_max} mm`  : null],
    ].filter(([, v]) => v)

    yPos = drawKeyValueGrid(doc, packagingInfo, yPos, margin, contentWidth, 2)
    yPos += 8

    // ═══════════════════════════════════════════════════════
    // MÉTRICAS
    // ═══════════════════════════════════════════════════════
    let metrics = inspection.metrics
    try { if (typeof metrics === 'string') metrics = JSON.parse(metrics) } catch { metrics = { values: {} } }
    const metricsValues = metrics?.values || {}

    const groupedMetrics = {}
    Object.entries(metricsValues).forEach(([key, value]) => {
      const prefix = key.split('.')[0] || 'other'
      if (!groupedMetrics[prefix]) groupedMetrics[prefix] = []
      groupedMetrics[prefix].push([key, value])
    })

    const groupConfigs = {
      quality:   { label: 'MÉTRICAS DE CALIDAD', color: '#16a34a' },
      condition: { label: 'CONDICIÓN',            color: '#2563eb' },
      pack:      { label: 'EMBALAJE',             color: '#7c3aed' }
    }

    for (const [groupKey, entries] of Object.entries(groupedMetrics)) {
      if (!entries.length) continue
      const config = groupConfigs[groupKey] || { label: 'OTROS', color: '#6b7280' }

      // Estimar altura necesaria: header (10) + filas (ceil(n/2) * 10) + margen (16)
      const needed = 10 + Math.ceil(entries.length / 2) * 10 + 16
      checkPage(needed)

      yPos = drawSectionHeader(doc, config.label, yPos, margin, pageWidth, config.color)
      yPos += 5

      const metricItems = entries.map(([key, value]) => {
        const label = key.split('.').pop().replace(/_/g, ' ')
        return [capitalize(label), value || '--']
      })

      yPos = drawKeyValueGrid(doc, metricItems, yPos, margin, contentWidth, 2)
      yPos += 8
    }

    // ═══════════════════════════════════════════════════════
    // OBSERVACIONES
    // ═══════════════════════════════════════════════════════
    if (inspection.notes) {
      const splitText = doc.splitTextToSize(inspection.notes, contentWidth)
      checkPage(20 + splitText.length * 5)

      yPos = drawSectionHeader(doc, 'OBSERVACIONES', yPos, margin, pageWidth, '#16a34a')
      yPos += 5

      doc.setFontSize(10)
      doc.setTextColor(55, 65, 81)
      doc.text(splitText, margin, yPos)
      yPos += splitText.length * 5 + 8
    }

    // ═══════════════════════════════════════════════════════
    // FOTOS — nueva página propia, 3 columnas con título debajo
    // ═══════════════════════════════════════════════════════
    const headerPhotoEntries  = Object.entries(photos).filter(([k, urls]) =>  k.startsWith('header.') && urls?.length > 0)
    const metricPhotoEntries  = Object.entries(photos).filter(([k, urls]) => !k.startsWith('header.') && urls?.length > 0)
    const allPhotoEntries     = [...headerPhotoEntries, ...metricPhotoEntries]

    if (allPhotoEntries.length > 0) {
      doc.addPage()
      yPos = 20

      const cols    = 3
      const imgW    = (contentWidth - (cols - 1) * 4) / cols
      const imgH    = imgW * 0.75
      const labelH  = 8
      const cellH   = imgH + labelH + 4
      const colGap  = 4

      const renderPhotoGroup = async (entries, sectionTitle, color) => {
        if (!entries.length) return
        if (yPos + 20 > safeBottom) { doc.addPage(); yPos = 20 }
        yPos = drawSectionHeader(doc, sectionTitle, yPos, margin, pageWidth, color)
        yPos += 6

        let col = 0
        let rowStartY = yPos

        for (const [metricKey, urls] of entries) {
          for (const url of urls) {
            if (rowStartY + cellH > safeBottom) {
              doc.addPage()
              rowStartY = 20
              col = 0
            }

            const xPos = margin + col * (imgW + colGap)
            const yImg = rowStartY

            try {
              const imageData = await downloadImageAsBase64(url)
              if (imageData) {
                doc.addImage(imageData, 'JPEG', xPos, yImg, imgW, imgH, undefined, 'FAST')
              } else {
                drawPlaceholder(doc, xPos, yImg, imgW, imgH)
              }
            } catch {
              drawPlaceholder(doc, xPos, yImg, imgW, imgH)
            }

            // Label traducido
            const labelMap = {
              'header.brix':         'Brix',
              'header.temperatura':  'Temperatura',
              'header.packaging_code': 'Código Embalaje',
              'header.packaging_type': 'Tipo Embalaje',
              'header.packaging_date': 'Fecha Embalaje',
              'header.net_weight':     'Peso Neto',
            }
            const rawLabel = labelMap[metricKey] || metricKey
              .replace('header.', '')
              .replace(/^(quality|condition|pack)\./, '')
              .replace(/\./g, ' - ')
              .replace(/_/g, ' ')
            const label = capitalize(rawLabel)

            doc.setFontSize(7.5)
            doc.setTextColor(75, 85, 99)
            doc.setFont(undefined, 'bold')
            const maxChars = Math.floor(imgW / 1.8)
            const shortLabel = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label
            doc.text(shortLabel, xPos + imgW / 2, yImg + imgH + 5, { align: 'center' })
            doc.setFont(undefined, 'normal')

            col++
            if (col >= cols) {
              col = 0
              rowStartY += cellH + 4
            }
          }
        }

        yPos = col > 0 ? rowStartY + cellH + 8 : rowStartY + 8
      }

      await renderPhotoGroup(headerPhotoEntries, 'EVIDENCIA DE MEDICIÓN', '#16a34a')
      await renderPhotoGroup(metricPhotoEntries, 'EVIDENCIA DE DEFECTOS', '#2563eb')
    }

    // ═══════════════════════════════════════════════════════
    // FOOTER en todas las páginas
    // ═══════════════════════════════════════════════════════
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(9)
      doc.setTextColor(156, 163, 175)
      doc.text(
        `Inspector: ${inspection.inspector_name || 'N/A'} • Fecha de reporte: ${new Date().toLocaleDateString('es-CL')} • Página ${i} de ${pageCount}`,
        pageWidth / 2, footerY, { align: 'center' }
      )
    }

    return Buffer.from(doc.output('arraybuffer'))

  } catch (error) {
    console.error('[generateInspectionPDF] Error:', error)
    throw error
  }
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function drawSectionHeader(doc, title, yPos, margin, pageWidth, color) {
  const rgb = hexToRgb(color)
  doc.setFontSize(13)
  doc.setTextColor(rgb.r, rgb.g, rgb.b)
  doc.setFont(undefined, 'bold')
  doc.text(title, margin, yPos)
  doc.setFont(undefined, 'normal')
  yPos += 2
  doc.setDrawColor(rgb.r, rgb.g, rgb.b)
  doc.setLineWidth(0.7)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  return yPos + 5
}

function drawKeyValueGrid(doc, items, startY, margin, contentWidth, columns = 2) {
  const columnWidth = contentWidth / columns
  const rowHeight   = 10
  let yPos = startY

  for (let i = 0; i < items.length; i += columns) {
    for (let j = 0; j < columns && (i + j) < items.length; j++) {
      const [key, value] = items[i + j]
      const xPos = margin + j * columnWidth

      doc.setFontSize(9)
      doc.setTextColor(107, 114, 128)
      doc.setFont(undefined, 'bold')
      doc.text(key + ':', xPos, yPos)

      doc.setFontSize(10)
      doc.setTextColor(17, 24, 39)
      doc.setFont(undefined, 'normal')
      const valueText = doc.splitTextToSize(String(value || '--'), columnWidth - 5)
      doc.text(valueText, xPos, yPos + 4)
    }
    yPos += rowHeight
  }
  return yPos
}

function drawPlaceholder(doc, x, y, w, h) {
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.3)
  doc.rect(x, y, w, h)
  doc.setFontSize(8)
  doc.setTextColor(156, 163, 175)
  doc.text('Imagen no disponible', x + w / 2, y + h / 2, { align: 'center' })
}

function formatDate(val) {
  // mssql puede devolver un objeto Date o un string ISO
  let iso
  if (val instanceof Date) {
    // Usar componentes UTC para evitar offset de zona horaria
    const y = val.getUTCFullYear()
    const m = String(val.getUTCMonth() + 1).padStart(2, '0')
    const d = String(val.getUTCDate()).padStart(2, '0')
    iso = `${y}-${m}-${d}`
  } else {
    iso = String(val).slice(0, 10)
  }
  const [year, month, day] = iso.split('-')
  return `${day}-${month}-${year}`
}

function capitalize(str) {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : { r: 0, g: 0, b: 0 }
}

async function downloadImageAsBase64(url) {
  try {
    const response = await fetch(url, { timeout: 15000 })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer      = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    return `data:${contentType};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}