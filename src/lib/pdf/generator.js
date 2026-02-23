// src/lib/pdf/generator.js
import { jsPDF } from 'jspdf'
import fetch from 'node-fetch'

/**
 * Genera un PDF profesional de inspección usando jsPDF
 * @param {Object} inspection - Datos de la inspección
 * @param {Object} photos - Objeto con URLs de fotos { "quality.dust": ["url1"], ... }
 * @returns {Promise<Buffer>} - Buffer del PDF generado
 */
export async function generateInspectionPDF(inspection, photos = {}) {
  try {
    // Crear documento PDF (Letter size: 216mm x 279mm)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    })

    let yPos = 20
    const margin = 20
    const pageWidth = 216
    const contentWidth = pageWidth - (margin * 2)

    // ═══════════════════════════════════════════════════════
    // HEADER DEL DOCUMENTO
    // ═══════════════════════════════════════════════════════
    
    doc.setFontSize(24)
    doc.setTextColor(22, 163, 74) // #16a34a
    doc.text('INSPRODUCE', margin, yPos)
    
    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128) // #6b7280
    doc.text(`Fecha: ${new Date(inspection.created_at).toLocaleDateString('es-CL')}`, pageWidth - margin, yPos, { align: 'right' })
    
    yPos += 10
    doc.setFontSize(18)
    doc.setTextColor(17, 24, 39) // #111827
    doc.text('REPORTE DE INSPECCIÓN', margin, yPos)
    
    yPos += 7
    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text(`ID: #${inspection.id}`, margin, yPos)

    // Línea separadora
    yPos += 5
    doc.setDrawColor(229, 231, 235) // #e5e7eb
    doc.setLineWidth(0.5)
    doc.line(margin, yPos, pageWidth - margin, yPos)
    
    yPos += 10

    // ═══════════════════════════════════════════════════════
    // SECCIÓN: INFORMACIÓN GENERAL
    // ═══════════════════════════════════════════════════════
    
    yPos = drawSectionHeader(doc, '📋 INFORMACIÓN GENERAL', yPos, margin, pageWidth, '#16a34a')
    yPos += 5

    const generalInfo = [
      ['Productor', inspection.producer],
      ['Lote', inspection.lot],
      ['Commodity', `${inspection.commodity_code || ''} ${inspection.commodity_name ? '(' + inspection.commodity_name + ')' : ''}`],
      ['Variedad', inspection.variety]
    ].filter(([, val]) => val)

    yPos = drawKeyValueGrid(doc, generalInfo, yPos, margin, contentWidth, 2)
    yPos += 8

    // ═══════════════════════════════════════════════════════
    // SECCIÓN: EMBALAJE Y TEMPERATURA
    // ═══════════════════════════════════════════════════════
    
    if (yPos > 240) {
      doc.addPage()
      yPos = 20
    }

    yPos = drawSectionHeader(doc, '📦 EMBALAJE Y TEMPERATURA', yPos, margin, pageWidth, '#16a34a')
    yPos += 5

    const packagingInfo = [
      ['Código embalaje', inspection.packaging_code],
      ['Tipo embalaje', inspection.packaging_type],
      ['Fecha embalaje', inspection.packaging_date ? new Date(inspection.packaging_date).toLocaleDateString('es-CL') : null],
      ['Peso neto', inspection.net_weight ? `${inspection.net_weight} kg` : null],
      ['Brix promedio', inspection.brix_avg ? `${inspection.brix_avg}°` : null],
      ['Temp. agua', inspection.temp_water ? `${inspection.temp_water}°C` : null],
      ['Temp. ambiente', inspection.temp_ambient ? `${inspection.temp_ambient}°C` : null],
      ['Temp. pulpa', inspection.temp_pulp ? `${inspection.temp_pulp}°C` : null]
    ].filter(([, val]) => val)

    yPos = drawKeyValueGrid(doc, packagingInfo, yPos, margin, contentWidth, 2)
    yPos += 8

    // ═══════════════════════════════════════════════════════
    // SECCIÓN: MÉTRICAS
    // ═══════════════════════════════════════════════════════
    
    let metrics = inspection.metrics
    try {
      if (typeof metrics === 'string') metrics = JSON.parse(metrics)
    } catch {
      metrics = { values: {} }
    }

    const metricsValues = metrics?.values || {}
    
    // Agrupar métricas por prefijo
    const groupedMetrics = {}
    Object.entries(metricsValues).forEach(([key, value]) => {
      const prefix = key.split('.')[0] || 'other'
      if (!groupedMetrics[prefix]) groupedMetrics[prefix] = []
      groupedMetrics[prefix].push([key, value])
    })

    const groupConfigs = {
      quality: { label: '🔬 MÉTRICAS DE CALIDAD', color: '#16a34a' },
      condition: { label: '🩺 CONDICIÓN', color: '#2563eb' },
      pack: { label: '📦 EMBALAJE', color: '#7c3aed' }
    }

    for (const [groupKey, entries] of Object.entries(groupedMetrics)) {
      if (entries.length === 0) continue

      const config = groupConfigs[groupKey] || { label: '📋 OTROS', color: '#6b7280' }
      
      // Nueva página si no hay espacio
      if (yPos > 240) {
        doc.addPage()
        yPos = 20
      }

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
    // SECCIÓN: FOTOS
    // ═══════════════════════════════════════════════════════
    
    if (Object.keys(photos).length > 0) {
      // Nueva página para fotos
      doc.addPage()
      yPos = 20

      yPos = drawSectionHeader(doc, '📸 FOTOS DE INSPECCIÓN', yPos, margin, pageWidth, '#16a34a')
      yPos += 8

      for (const [metricKey, urls] of Object.entries(photos)) {
        if (!urls || urls.length === 0) continue

        // Título de la métrica
        const metricLabel = metricKey.replace('header.', '').replace(/\./g, ' - ').replace(/_/g, ' ')
        doc.setFontSize(11)
        doc.setTextColor(55, 65, 81) // #374151
        doc.setFont(undefined, 'bold')
        doc.text(capitalize(metricLabel), margin, yPos)
        doc.setFont(undefined, 'normal')
        yPos += 6

        // Dibujar grilla de imágenes (3 columnas)
        const imagesPerRow = 3
        const imageWidth = 50 // mm
        const imageHeight = 50 // mm
        const gap = 5 // mm

        for (let i = 0; i < urls.length; i += imagesPerRow) {
          const rowImages = urls.slice(i, i + imagesPerRow)
          
          // Verificar espacio disponible
          if (yPos + imageHeight > 260) {
            doc.addPage()
            yPos = 20
          }

          // Descargar y agregar imágenes
          for (let j = 0; j < rowImages.length; j++) {
            const xPos = margin + j * (imageWidth + gap)
            
            try {
              const imageData = await downloadImageAsBase64(rowImages[j])
              if (imageData) {
                doc.addImage(imageData, 'JPEG', xPos, yPos, imageWidth, imageHeight, undefined, 'FAST')
              }
            } catch (err) {
              console.error(`Error loading image ${rowImages[j]}:`, err)
              // Dibujar placeholder
              doc.setDrawColor(229, 231, 235)
              doc.setLineWidth(0.3)
              doc.rect(xPos, yPos, imageWidth, imageHeight)
              doc.setFontSize(8)
              doc.setTextColor(156, 163, 175)
              doc.text('Imagen no', xPos + imageWidth/2, yPos + imageHeight/2 - 2, { align: 'center' })
              doc.text('disponible', xPos + imageWidth/2, yPos + imageHeight/2 + 2, { align: 'center' })
            }
          }

          yPos += imageHeight + gap
        }

        yPos += 5 // Espacio entre grupos de fotos
      }
    }

    // ═══════════════════════════════════════════════════════
    // SECCIÓN: OBSERVACIONES
    // ═══════════════════════════════════════════════════════
    
    if (inspection.notes) {
      // Nueva página si es necesario
      if (yPos > 240) {
        doc.addPage()
        yPos = 20
      }

      yPos = drawSectionHeader(doc, '📝 OBSERVACIONES', yPos, margin, pageWidth, '#16a34a')
      yPos += 5

      doc.setFontSize(10)
      doc.setTextColor(55, 65, 81)
      const splitText = doc.splitTextToSize(inspection.notes, contentWidth)
      doc.text(splitText, margin, yPos)
      yPos += splitText.length * 5
    }

    // ═══════════════════════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════════════════════
    
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(9)
      doc.setTextColor(156, 163, 175) // #9ca3af
      const footerText = `Inspector: ${inspection.inspector_name || 'N/A'} • Fecha de reporte: ${new Date().toLocaleDateString('es-CL')} • Página ${i} de ${pageCount}`
      doc.text(footerText, pageWidth / 2, 272, { align: 'center' })
    }

    // Convertir a buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    return pdfBuffer

  } catch (error) {
    console.error('[generateInspectionPDF] Error:', error)
    throw error
  }
}

// ═══════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
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
  const rowHeight = 10
  let yPos = startY

  for (let i = 0; i < items.length; i += columns) {
    for (let j = 0; j < columns && (i + j) < items.length; j++) {
      const [key, value] = items[i + j]
      const xPos = margin + j * columnWidth

      // Key (label)
      doc.setFontSize(9)
      doc.setTextColor(107, 114, 128) // #6b7280
      doc.setFont(undefined, 'bold')
      doc.text(key + ':', xPos, yPos)

      // Value
      doc.setFontSize(10)
      doc.setTextColor(17, 24, 39) // #111827
      doc.setFont(undefined, 'normal')
      const valueText = doc.splitTextToSize(String(value || '--'), columnWidth - 5)
      doc.text(valueText, xPos, yPos + 4)
    }

    yPos += rowHeight
  }

  return yPos
}

function capitalize(str) {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 }
}

async function downloadImageAsBase64(url) {
  try {
    const response = await fetch(url, { timeout: 15000 })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    
    // Detectar tipo de imagen
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    return `data:${contentType};base64,${base64}`
    
  } catch (error) {
    console.error('Error downloading image:', error)
    return null
  }
}