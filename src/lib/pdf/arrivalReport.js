// Reporte de contenedor estilo QC Inspec destino:
// banda título → tabla de cabecera → info adicional → resumen (clasificación de
// pallets + defectos principales) → notas tipificadas → archivos → tabla SAMPLES.
import { jsPDF } from 'jspdf'

const M = 12
const PAGE_W = 210
const PAGE_H = 297
const CW = PAGE_W - M * 2

const C = {
  teal: '#16A085', tealDark: '#117A65', line: '#D5DBDB', text: '#2C3E50',
  hint: '#7F8C8D', soft: '#F4F6F6',
  green: '#27AE60', amber: '#F1C40F', red: '#E74C3C', gray: '#95A5A6',
}
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]

const RES = {
  approved: { label: 'Aprobado', color: C.green },
  conditional: { label: 'Condicional', color: C.amber },
  rejected: { label: 'Rechazado', color: C.red },
}

// las DATE llegan como medianoche UTC: formatear en UTC para no retroceder un día
const fdate = (v) => {
  if (!v) return '—'
  const d = v instanceof Date ? v : new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  const iso = d.toISOString().slice(0, 10)
  return `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`
}
const S = (v) => (v == null || v === '' ? '—' : String(v))

export function generateArrivalPDF({ arrival, defects, measurements }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const fill = (h) => doc.setFillColor(...rgb(h))
  const text = (h) => doc.setTextColor(...rgb(h))
  const stroke = (h) => doc.setDrawColor(...rgb(h))
  const font = (style, size) => doc.setFont('helvetica', style).setFontSize(size)
  let y = 0

  const insp = arrival.inspections || []
  const inspectors = [...new Set(insp.map((i) => i.inspector_name).filter(Boolean))]

  // ── título ──
  font('bold', 17); text(C.text)
  doc.text('FRUITBRIX FIELD', PAGE_W / 2, 14, { align: 'center' })
  font('normal', 8.5); text(C.hint)
  doc.text('QC CONTAINER REPORT', PAGE_W / 2, 19, { align: 'center' })

  // banda: COMMODITY / DESTINO / CLIENTE
  fill(C.teal); doc.rect(M, 23, CW, 10, 'F')
  font('bold', 13); text('#ffffff')
  const band = [arrival.commodity_name || arrival.commodity_code, arrival.destination, arrival.client]
    .filter(Boolean).join('  /  ') || `Contenedor ${arrival.container}`
  doc.text(band.toUpperCase(), PAGE_W / 2, 29.7, { align: 'center' })
  y = 36

  // ── tabla de cabecera: 3 grupos × 5 filas (etiqueta teal + valor) ──
  const headerRows = (pairs, x, w) => {
    const lw = w * 0.42
    pairs.forEach(([label, value], i) => {
      const ry = y + i * 6.4
      fill(C.teal); doc.rect(x, ry, lw, 6.4, 'F')
      stroke(C.line); doc.rect(x + lw, ry, w - lw, 6.4, 'S')
      font('bold', 6.8); text('#ffffff')
      doc.text(label, x + 1.5, ry + 4.2)
      font('normal', 7.4); text(C.text)
      doc.text(doc.splitTextToSize(S(value), w - lw - 3)[0] || '—', x + lw + 1.5, ry + 4.2)
    })
  }
  const gw = (CW - 8) / 3
  headerRows([
    ['Commodity', arrival.commodity_name || arrival.commodity_code],
    ['Shipper', arrival.shipper], ['Warehouse', arrival.warehouse],
    ['Packaging', arrival.packaging], ['Cartons', arrival.cartons],
  ], M, gw)
  headerRows([
    ['Container', arrival.container], ['Vessel', arrival.vessel],
    ['Airline', arrival.airline], ['Carrier Type', arrival.carrier_type], ['Label', arrival.label],
  ], M + gw + 4, gw)
  headerRows([
    ['Arrival Date', fdate(arrival.arrival_date)], ['Warehouse Date', fdate(arrival.warehouse_date)],
    ['Inspec Date', fdate(arrival.inspection_date)], ['Inspect Week', arrival.week_no],
    ['Inspector', inspectors.join(', ') || '—'],
  ], M + (gw + 4) * 2, gw)
  y += 5 * 6.4 + 6

  // ── info adicional ──
  fill(C.tealDark); doc.rect(M, y, CW, 7, 'F')
  font('bold', 9); text('#ffffff')
  doc.text('ADDITIONAL INFO', PAGE_W / 2, y + 4.8, { align: 'center' })
  y += 9
  const gw2 = (CW - 4) / 2
  headerRows([
    ['Order', arrival.order_number], ['Grower', arrival.grower],
    ['Fumigation', arrival.fumigation ? 'Sí' : 'No'], ['Atmosphere', arrival.atmosphere],
    ['Packing Date', fdate(arrival.packing_date)],
  ], M, gw2)
  headerRows([
    ['% O2', arrival.o2_pct], ['% CO2', arrival.co2_pct],
    ['UPC', arrival.upc], ['Ship Date', fdate(arrival.ship_date)],
    ['Season', arrival.season || '—'],
  ], M + gw2 + 4, gw2)
  y += 5 * 6.4 + 7

  const sectionBand = (label, x, w) => {
    fill(C.teal); doc.rect(x, y, w, 7, 'F')
    font('bold', 9); text('#ffffff')
    doc.text(label, x + w / 2, y + 4.8, { align: 'center' })
  }

  // ── resumen: clasificación de pallets (izq) + defectos principales (der) ──
  const colW = (CW - 6) / 2
  sectionBand('INSPECTION SUMMARY', M, colW)
  sectionBand('MAIN DEFECTS (% PROM.)', M + colW + 6, colW)
  y += 11

  // clasificación: total, conteo por resolución, barra apilada
  const counts = { approved: 0, conditional: 0, rejected: 0, other: 0 }
  for (const i of insp) counts[RES[i.resolution] ? i.resolution : 'other']++
  const total = insp.length
  font('bold', 8.2); text(C.text)
  doc.text(`${total} pallet${total === 1 ? '' : 's'} inspeccionado${total === 1 ? '' : 's'}`, M, y)
  let ly = y + 5
  for (const key of ['approved', 'conditional', 'rejected']) {
    const n = counts[key]
    const pct = total ? Math.round((n / total) * 100) : 0
    fill(RES[key].color); doc.circle(M + 2, ly - 1.2, 1.6, 'F')
    font('bold', 8); text(C.text)
    doc.text(`${RES[key].label}: ${n}`, M + 5.5, ly)
    font('normal', 8); text(C.hint)
    doc.text(`(${pct}%)`, M + 33, ly)
    ly += 5.4
  }
  // barra apilada 0-100%
  if (total) {
    const bx = M, bw = colW, bh = 7, by = ly + 1
    let x = bx
    for (const key of ['approved', 'conditional', 'rejected']) {
      const w = (counts[key] / total) * bw
      if (w <= 0) continue
      fill(RES[key].color); doc.rect(x, by, w, bh, 'F')
      if (w > 12) {
        font('bold', 7.5); text('#ffffff')
        doc.text(`${Math.round((counts[key] / total) * 100)}%`, x + w / 2, by + 4.8, { align: 'center' })
      }
      x += w
    }
    stroke(C.line); doc.rect(bx, by, bw, bh, 'S')
  }

  // defectos: barras horizontales con etiqueta y %
  const dx = M + colW + 6
  const top = (defects || []).slice(0, 7)
  if (!top.length) {
    font('normal', 8); text(C.hint)
    doc.text('Sin defectos con incidencia registrada.', dx, y)
  } else {
    const maxV = Math.max(...top.map((d) => Number(d.avg_pct)), 0.1)
    const chartW = colW - 42
    top.forEach((d, i) => {
      const ry = y + i * 6 - 1.6
      font('normal', 6.8); text(C.text)
      doc.text(doc.splitTextToSize(d.label, 34)[0], dx + 34, ry + 3, { align: 'right' })
      const bwid = Math.max((Number(d.avg_pct) / maxV) * chartW, 0.8)
      fill(d.family === 'condition' ? C.tealDark : C.teal)
      doc.roundedRect(dx + 36, ry, bwid, 4, 0.7, 0.7, 'F')
      font('bold', 6.8); text(C.text)
      doc.text(`${Number(d.avg_pct).toFixed(2)}%`, dx + 37.5 + bwid, ry + 3)
    })
  }
  y += Math.max(34, top.length * 6 + 4)

  // ── notas tipificadas ──
  const notes = arrival.notes_typed || []
  if (notes.length) {
    sectionBand('NOTES', M, CW); y += 9
    for (const n of notes) {
      const lines = doc.splitTextToSize(S(n.note), CW - 40)
      const rh = Math.max(7, lines.length * 3.6 + 3)
      if (y + rh > PAGE_H - 18) { doc.addPage(); y = 14 }
      fill(C.soft); doc.rect(M, y, 36, rh, 'F')
      stroke(C.line); doc.rect(M, y, CW, rh, 'S'); doc.line(M + 36, y, M + 36, y + rh)
      font('bold', 7.4); text(C.text)
      doc.text(doc.splitTextToSize(n.note_type, 32), M + 2, y + 4.4)
      font('normal', 7.4)
      doc.text(lines, M + 39, y + 4.4)
      y += rh
    }
    y += 6
  }

  // ── archivos (lectores de temperatura, etc.) ──
  const files = arrival.files || []
  if (files.length) {
    if (y + 12 + files.length * 5.4 > PAGE_H - 18) { doc.addPage(); y = 14 }
    sectionBand('FILES', M, CW); y += 10
    for (const f of files) {
      font('normal', 7.6); text('#1F618D')
      doc.textWithLink(S(f.file_name), M + 2, y, { url: f.url })
      font('normal', 7.4); text(C.hint)
      doc.text(S(f.description || 'Sin descripción'), M + 92, y)
      y += 5.4
    }
    y += 4
  }

  // ── tabla SAMPLES (una fila por pallet) ──
  doc.addPage(); y = 14
  sectionBand('SAMPLES', M, CW); y += 10

  const cols = [
    ['#', 8, 'left'], ['Pallet', 22, 'left'], ['Lote', 22, 'left'], ['Productor', 28, 'left'],
    ['Variedad', 22, 'left'], ['Score', 12, 'right'], ['Res.', 9, 'left'],
    ['Defecto causal', 33, 'left'], ['Brix', 11, 'right'], ['Baxlo', 19, 'right'],
  ]
  const drawHead = () => {
    let x = M
    fill(C.teal); doc.rect(M, y - 3.8, CW, 5.6, 'F')
    font('bold', 6.9); text('#ffffff')
    cols.forEach(([label, w, align]) => {
      doc.text(label, align === 'right' ? x + w - 1.5 : x + 1.5, y, { align })
      x += w
    })
    y += 4.6
  }
  drawHead()
  insp.forEach((r, i) => {
    if (y > PAGE_H - 16) { doc.addPage(); y = 16; drawHead() }
    if (i % 2 === 1) { fill(C.soft); doc.rect(M, y - 3.4, CW, 4.9, 'F') }
    const res = RES[r.resolution]
    const baxlo = [r.firmness_min, r.firmness_mode, r.firmness_max].some((v) => v != null)
      ? `${S(r.firmness_min)}·${S(r.firmness_mode)}·${S(r.firmness_max)}` : '—'
    const vals = [
      String(i + 1), S(r.pallet_code), S(r.lot), S(r.producer), S(r.variety),
      r.score != null ? String(r.score) : '—', '', S(r.causal), S(r.brix_avg), baxlo,
    ]
    let x = M
    font('normal', 6.9)
    cols.forEach(([, w, align], ci) => {
      if (ci === 6) {
        fill(res ? res.color : C.gray)
        doc.circle(x + 3.5, y - 1.2, 1.5, 'F')
      } else {
        text(C.text)
        doc.text(doc.splitTextToSize(vals[ci], w - 3)[0] || '—', align === 'right' ? x + w - 1.5 : x + 1.5, y, { align })
      }
      x += w
    })
    stroke(C.line); doc.line(M, y + 1.3, PAGE_W - M, y + 1.3)
    y += 4.9
  })
  y += 7

  // ── matriz de defectos por pallet (columnas = defectos principales) ──
  const meas = measurements || []
  const topLabels = (defects || []).slice(0, 8).map((d) => d.label)
  if (topLabels.length && insp.length) {
    const byInsp = new Map()
    for (const m of meas) {
      if (!byInsp.has(m.inspection_id)) byInsp.set(m.inspection_id, {})
      byInsp.get(m.inspection_id)[m.label] = m.value_num
    }
    const palW = 26
    const cellW = (CW - palW) / topLabels.length
    if (y + 20 > PAGE_H - 16) { doc.addPage(); y = 16 }
    sectionBand('DEFECTS BY PALLET (%)', M, CW); y += 10
    const drawMatrixHead = () => {
      fill(C.teal); doc.rect(M, y - 3.8, CW, 8.4, 'F')
      font('bold', 6.2); text('#ffffff')
      doc.text('Pallet', M + 1.5, y + 1)
      topLabels.forEach((lab, i) => {
        const lines = doc.splitTextToSize(lab, cellW - 2).slice(0, 2)
        doc.text(lines, M + palW + i * cellW + cellW - 1.5, y - 0.8, { align: 'right' })
      })
      y += 7.2
    }
    drawMatrixHead()
    insp.forEach((r, i) => {
      if (y > PAGE_H - 16) { doc.addPage(); y = 16; drawMatrixHead() }
      if (i % 2 === 1) { fill(C.soft); doc.rect(M, y - 3.4, CW, 4.9, 'F') }
      font('normal', 6.9); text(C.text)
      doc.text(doc.splitTextToSize(S(r.pallet_code), palW - 3)[0], M + 1.5, y)
      const vals = byInsp.get(r.id) || {}
      topLabels.forEach((lab, ci) => {
        const v = vals[lab]
        text(v > 0 ? C.text : C.hint)
        doc.text(v != null ? String(v) : '—', M + palW + ci * cellW + cellW - 1.5, y, { align: 'right' })
      })
      stroke(C.line); doc.line(M, y + 1.3, PAGE_W - M, y + 1.3)
      y += 4.9
    })
  }

  // ── pie de página ──
  const date = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    font('normal', 7); text(C.hint)
    doc.text(`Fruitbrix Field — Contenedor ${arrival.container} — ${date}`, M, PAGE_H - 7)
    doc.text(`Página ${p} de ${pages}`, PAGE_W - M, PAGE_H - 7, { align: 'right' })
  }

  return Buffer.from(doc.output('arraybuffer'))
}
