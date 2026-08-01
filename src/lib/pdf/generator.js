// Generador de PDF "estilo Power BI" (inglés). Gráficos vectoriales dibujados en jsPDF.
// Página 1: resumen ejecutivo visual. Páginas 2-3: detalle de datos. Última: fotos.
import { jsPDF } from 'jspdf'
import fetch from 'node-fetch'
import { isAllowedPhotoUrl } from '@/lib/security/photoUrls'

const PAGE_W = 216, PAGE_H = 279, M = 14, CW = PAGE_W - M * 2, FOOTER_Y = 270

const C = {
  brand: '#15803d', accent: '#16a34a',
  text: '#18181b', muted: '#6b7280', hint: '#9ca3af',
  line: '#e5e7eb', track: '#eef0ee', surface: '#ffffff', white: '#ffffff', panel: '#f6f8f6',
  quality: '#16a34a', condition: '#0ea5e9',
}
const BAND = { 1: '#16a34a', 2: '#65a30d', 3: '#f59e0b', 4: '#ea580c', 5: '#dc2626' }
const RES = {
  approved: { label: 'APPROVED', hex: '#16a34a' },
  conditional: { label: 'CONDITIONAL', hex: '#f59e0b' },
  rejected: { label: 'REJECTED', hex: '#dc2626' },
}

const rgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0]
}
const fmt = (v, d = 1, suffix = '') => (v == null || Number.isNaN(Number(v))) ? '—' : Number(v).toFixed(d) + suffix
const cap = (s) => String(s || '').replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export async function generateInspectionPDF(report) {
  // compat: si llega el objeto viejo {inspection, photos}, lo normalizamos
  const r = report?.results ? report : { inspection: report?.inspection || report, results: {}, defects: [], bandCounts: [0,0,0,0,0], sizeDist: [], colorDist: [], trend: [], photos: report?.photos || {} }
  const insp = r.inspection
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })

  const fill = (h) => doc.setFillColor(...rgb(h))
  const stroke = (h) => doc.setDrawColor(...rgb(h))
  const text = (h) => doc.setTextColor(...rgb(h))
  const font = (style = 'normal', size) => { doc.setFont('helvetica', style); if (size) doc.setFontSize(size) }

  const arc = (doc, cx, cy, rad, a0, a1, lw, hex, capStyle = 'butt') => {
    stroke(hex); doc.setLineWidth(lw); doc.setLineCap(capStyle)
    const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 4))
    let prev = null
    for (let i = 0; i <= steps; i++) {
      const a = (a0 + (a1 - a0) * i / steps) * Math.PI / 180
      const x = cx + rad * Math.cos(a), y = cy + rad * Math.sin(a)
      if (prev) doc.line(prev.x, prev.y, x, y)
      prev = { x, y }
    }
    doc.setLineCap('butt')
  }
  const panel = (x, y, w, h, title) => {
    fill(C.surface); stroke(C.line); doc.setLineWidth(0.3)
    doc.roundedRect(x, y, w, h, 2.2, 2.2, 'FD')
    if (title) { font('bold', 9); text(C.text); doc.text(title, x + 5, y + 7) }
  }
  const chip = (x, y, label, hex) => {
    const w = doc.getTextWidth(label) + 6
    fill(hex); doc.roundedRect(x, y - 3.4, w, 5, 1.2, 1.2, 'F')
    font('bold', 7.5); text(C.white); doc.text(label, x + 3, y)
    return w
  }
  const hbar = (x, y, w, value, max, hex, label, valueLabel) => {
    font('normal', 8); text(C.muted); doc.text(label, x, y)
    const bx = x + 42, bw = w - 42 - 14
    fill(C.track); doc.roundedRect(bx, y - 2.6, bw, 3.2, 1.6, 1.6, 'F')
    const frac = max > 0 ? Math.min(1, value / max) : 0
    if (frac > 0) { fill(hex); doc.roundedRect(bx, y - 2.6, Math.max(1.6, bw * frac), 3.2, 1.6, 1.6, 'F') }
    font('bold', 8); text(C.text); doc.text(valueLabel, x + w, y, { align: 'right' })
  }

  // ═══════════════ PÁGINA 1 — EXECUTIVE SUMMARY ═══════════════
  fill(C.brand); doc.rect(0, 0, PAGE_W, 30, 'F')
  fill('#1c8a47'); doc.roundedRect(M, 8, 14, 14, 3, 3, 'F')
  text('#ffffff'); font('bold', 9); doc.text('QC', M + 7, 16.5, { align: 'center' })
  font('bold', 16); doc.text('Inspection Quality Report', M + 19, 14)
  font('normal', 9); text('#d7f0df')
  doc.text(`${insp.commodity_name || insp.commodity_code || ''}  ·  Lot ${insp.lot || '—'}  ·  ${insp.standard_name || 'No standard'}`, M + 19, 21)

  const res = RES[r.results.resolution] || { label: '—', hex: '#6b7280' }
  font('normal', 8); text('#d7f0df')
  doc.text(`Report #${insp.id}  ·  ${new Date(insp.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}`, PAGE_W - M, 12, { align: 'right' })
  const pillW = doc.getTextWidth(res.label) + 14
  fill('#ffffff'); doc.roundedRect(PAGE_W - M - pillW, 16, pillW, 8, 2, 2, 'F')
  font('bold', 10); text(res.hex); doc.text(res.label, PAGE_W - M - pillW / 2, 21.4, { align: 'center' })

  // meta strip
  let y = 38
  const meta = [
    ['Producer', insp.producer], ['Variety', insp.variety], ['Inspector', insp.inspector_name],
    ['Commodity', insp.commodity_name], ['Standard', insp.standard_name],
  ]
  const cellW = CW / meta.length
  meta.forEach((mm, i) => {
    const x = M + i * cellW
    font('normal', 7.5); text(C.hint); doc.text(String(mm[0]).toUpperCase(), x, y)
    font('bold', 9); text(C.text)
    doc.text(doc.splitTextToSize(mm[1] || '—', cellW - 4), x, y + 5)
  })
  stroke(C.line); doc.setLineWidth(0.3); doc.line(M, y + 9, PAGE_W - M, y + 9)

  // score gauge panel + KPI grid
  y = 52
  const gaugeW = 60, gaugeH = 62
  panel(M, y, gaugeW, gaugeH)
  const cx = M + gaugeW / 2, cy = y + 26, gr = 18
  arc(doc, cx, cy, gr, 0, 360, 4.5, C.track)
  const score = r.results.score
  if (score != null) arc(doc, cx, cy, gr, -90, -90 + 360 * Math.max(0, Math.min(100, score)) / 100, 4.5, res.hex, 'round')
  font('bold', 19); text(C.text); doc.text(fmt(score, 1), cx, cy + 1, { align: 'center' })
  font('normal', 7); text(C.hint); doc.text('SCORE / 100', cx, cy + 6.5, { align: 'center' })
  font('normal', 7.5); text(C.hint); doc.text('Causal defect', cx, y + 50, { align: 'center' })
  font('bold', 8.5); text(C.text)
  doc.text(doc.splitTextToSize(r.results.causal || 'None', gaugeW - 8), cx, y + 55, { align: 'center' })

  const kx = M + gaugeW + 6, kw = CW - gaugeW - 6
  const kpis = [
    ['Total defects', fmt(r.results.total_defects_pct, 1, '%')],
    ['Quality', fmt(r.results.quality_total_pct, 1, '%')],
    ['Condition', fmt(r.results.condition_total_pct, 1, '%')],
    ['Brix avg', fmt(insp.brix_avg, 1, '°')],
    ['Firmness', insp.firmness_mode != null ? fmt(insp.firmness_mode, 0, ' Sh') : '—'],
    ['Pulp temp', fmt(insp.temp_pulp, 1, '°C')],
  ]
  const tileW = (kw - 2 * 5) / 3, tileH = (gaugeH - 5) / 2
  kpis.forEach((k, i) => {
    const tx = kx + (i % 3) * (tileW + 5), ty = y + Math.floor(i / 3) * (tileH + 5)
    fill(C.panel); doc.roundedRect(tx, ty, tileW, tileH, 2, 2, 'F')
    font('normal', 7.5); text(C.muted); doc.text(k[0], tx + 4, ty + 7)
    font('bold', 14); text(C.text); doc.text(k[1], tx + 4, ty + 18)
  })

  // donut (band distribution) + quality vs condition
  y += gaugeH + 6
  const half = (CW - 6) / 2
  panel(M, y, half, 46, 'Defects by band')
  const total = r.bandCounts.reduce((a, b) => a + b, 0)
  const dcx = M + 22, dcy = y + 27, dr = 13
  if (total > 0) {
    let a = -90
    r.bandCounts.forEach((cnt, i) => {
      if (!cnt) return
      const span = 360 * cnt / total
      arc(doc, dcx, dcy, dr, a, a + span, 5, BAND[i + 1]); a += span
    })
  } else { arc(doc, dcx, dcy, dr, 0, 360, 5, C.track) }
  font('bold', 12); text(C.text); doc.text(String(total), dcx, dcy + 1, { align: 'center' })
  font('normal', 6.5); text(C.hint); doc.text('defects', dcx, dcy + 5, { align: 'center' })
  const bandNames = ['Excellent', 'Good', 'Fair', 'Poor', 'Bad']
  let ly = y + 14
  bandNames.forEach((bn, i) => {
    const lx = M + 42
    fill(BAND[i + 1]); doc.roundedRect(lx, ly - 2.4, 2.8, 2.8, 0.6, 0.6, 'F')
    font('normal', 8); text(C.muted); doc.text(bn, lx + 5, ly)
    font('bold', 8); text(C.text); doc.text(String(r.bandCounts[i]), M + half - 5, ly, { align: 'right' })
    ly += 6.2
  })

  panel(M + half + 6, y, half, 46, 'Quality vs. condition')
  const qx = M + half + 11, qw = half - 10
  const q = Number(r.results.quality_total_pct || 0), cnd = Number(r.results.condition_total_pct || 0), tt = q + cnd
  const sby = y + 18
  fill(C.track); doc.roundedRect(qx, sby, qw, 6, 1.5, 1.5, 'F')
  if (tt > 0) {
    const qwid = qw * q / tt
    fill(C.quality); doc.roundedRect(qx, sby, Math.max(1, qwid), 6, 1.5, 1.5, 'F')
    fill(C.condition); doc.rect(qx + qwid, sby, qw - qwid, 6, 'F')
  }
  fill(C.quality); doc.roundedRect(qx, sby + 14, 2.8, 2.8, 0.6, 0.6, 'F')
  font('normal', 8); text(C.muted); doc.text(`Quality  ${fmt(q, 1, '%')}`, qx + 5, sby + 16.4)
  fill(C.condition); doc.roundedRect(qx, sby + 22, 2.8, 2.8, 0.6, 0.6, 'F')
  font('normal', 8); text(C.muted); doc.text(`Condition  ${fmt(cnd, 1, '%')}`, qx + 5, sby + 24.4)

  // top defects
  y += 52
  const topDefs = r.defects.filter(d => d.unit === '%' && d.value != null).sort((a, b) => b.value - a.value).slice(0, 6)
  const tdH = 16 + topDefs.length * 7 + 4
  panel(M, y, CW, Math.max(28, tdH), 'Top defects (% of sample)')
  const maxv = Math.max(0.01, ...topDefs.map(d => d.value))
  let dy = y + 16
  if (!topDefs.length) { font('normal', 8.5); text(C.hint); doc.text('No quantitative defects recorded.', M + 6, dy) }
  topDefs.forEach(d => {
    hbar(M + 6, dy, CW - 12, d.value, maxv, BAND[d.band] || C.accent, cap(d.label).slice(0, 22), fmt(d.value, d.value < 10 ? 2 : 1) + '%')
    dy += 7
  })

  // optional: score trend sparkline
  if (r.trend && r.trend.length > 1) {
    y += Math.max(28, tdH) + 6
    panel(M, y, CW, 26, `Score trend (last ${r.trend.length} ${insp.commodity_name || ''} inspections)`)
    const sx = M + 6, sw = CW - 12, syb = y + 21, sht = 8
    const mn = Math.min(...r.trend), mx = Math.max(...r.trend), rng = Math.max(1, mx - mn)
    stroke(C.accent); doc.setLineWidth(0.8); doc.setLineCap('round')
    let prev = null
    r.trend.forEach((v, i) => {
      const px = sx + sw * (r.trend.length === 1 ? 0.5 : i / (r.trend.length - 1))
      const py = syb - ((v - mn) / rng) * sht
      if (prev) doc.line(prev.x, prev.y, px, py)
      fill(C.accent); doc.circle(px, py, 0.8, 'F'); prev = { x: px, y: py }
    })
  }

  // ═══════════════ PÁGINA 2 — MEASUREMENT DETAIL ═══════════════
  doc.addPage()
  pageHeader(doc, 'Measurement detail', fill, text, font)
  let py = 40
  const drawDefectTable = (title, fam) => {
    const rows = r.defects.filter(d => d.family === fam)
    if (!rows.length) return
    font('bold', 11); text(C.text); doc.text(title, M, py); py += 5
    const cols = [M + 2, M + 96, M + 120, M + 150]
    fill(C.panel); doc.rect(M, py, CW, 8, 'F')
    font('bold', 7.5); text(C.muted)
    doc.text('DEFECT', cols[0], py + 5.4); doc.text('VALUE', cols[1], py + 5.4)
    doc.text('BAND', cols[2], py + 5.4); doc.text('TOLERANCE', cols[3], py + 5.4)
    py += 8
    rows.forEach((d, i) => {
      if (py > 250) { doc.addPage(); pageHeader(doc, 'Measurement detail (cont.)', fill, text, font); py = 40 }
      if (i % 2) { fill('#fbfcfb'); doc.rect(M, py, CW, 8, 'F') }
      font('normal', 8.5); text(C.text); doc.text(cap(d.label).slice(0, 46), cols[0], py + 5.4)
      const val = d.value != null ? fmt(d.value, d.value < 10 ? 2 : 1) + (d.unit === '%' ? '%' : '') : (d.option || d.text || '—')
      font('bold', 8.5); doc.text(String(val), cols[1], py + 5.4)
      if (d.band_label) chip(cols[2], py + 5.4, d.band_label, BAND[d.band])
      else { font('normal', 8); text(C.hint); doc.text('—', cols[2], py + 5.4) }
      font('normal', 8); text(C.muted)
      const trange = d.tol_min != null
        ? (d.tol_max == null
            ? `${fmt(d.tol_min, d.tol_min % 1 ? 2 : 0)}%+`
            : `${fmt(d.tol_min, d.tol_min % 1 ? 2 : 0)}-${fmt(d.tol_max, d.tol_max % 1 ? 2 : 0)}%`)
        : '—'
      doc.text(trange, cols[3], py + 5.4)
      py += 8
    })
    py += 7
  }
  drawDefectTable('Quality defects', 'quality')
  drawDefectTable('Condition defects', 'condition')

  if (py > 215) { doc.addPage(); pageHeader(doc, 'Measurement detail (cont.)', fill, text, font); py = 40 }
  font('bold', 11); text(C.text); doc.text('Header measurements', M, py); py += 6
  const hm = [
    ['Brix (min / avg / max)', `${fmt(insp.brix_min)} / ${fmt(insp.brix_avg)} / ${fmt(insp.brix_max)}`],
    ['Brix mode', fmt(insp.brix_mode)],
    ['Firmness (min / mode / max)', `${fmt(insp.firmness_min)} / ${fmt(insp.firmness_mode)} / ${fmt(insp.firmness_max)}`],
    ['Diameter (min / max) mm', `${fmt(insp.diameter_min)} / ${fmt(insp.diameter_max)}`],
    ['Pulp / ambient / water °C', `${fmt(insp.temp_pulp)} / ${fmt(insp.temp_ambient)} / ${fmt(insp.temp_water)}`],
    ['Net weight', fmt(insp.net_weight, 2)],
  ]
  hm.forEach((it, i) => {
    const x = M + (i % 2) * (CW / 2), ty = py + Math.floor(i / 2) * 11
    fill(C.panel); doc.roundedRect(x, ty, CW / 2 - 4, 9, 1.5, 1.5, 'F')
    font('normal', 7.5); text(C.muted); doc.text(it[0], x + 4, ty + 3.8)
    font('bold', 9); text(C.text); doc.text(String(it[1]), x + 4, ty + 7.6)
  })
  py += Math.ceil(hm.length / 2) * 11 + 6
  const autoLines = buildAutoNotes(r, insp)
  if (insp.notes || autoLines.length) {
    if (py > 220) { doc.addPage(); pageHeader(doc, 'Notes', fill, text, font); py = 40 }
    font('bold', 11); text(C.text); doc.text('Notes', M, py); py += 5
    if (insp.notes) {
      font('normal', 9); text(C.muted)
      const manual = doc.splitTextToSize(String(insp.notes), CW)
      doc.text(manual, M, py); py += manual.length * 4.2 + 3
    }
    if (autoLines.length) {
      font('bold', 8); text(C.hint); doc.text('AUTO SUMMARY', M, py); py += 4.5
      font('normal', 9); text(C.muted)
      for (const line of autoLines) {
        const wrapped = doc.splitTextToSize('· ' + line, CW)
        doc.text(wrapped, M, py); py += wrapped.length * 4.2 + 1
      }
    }
  }
  // ═══════════════ PÁGINA 3 — PHOTO EVIDENCE ═══════════════
  const photoEntries = Object.entries(r.photos || {}).filter(([, u]) => u?.length)
  if (photoEntries.length) {
    doc.addPage()
    pageHeader(doc, 'Photo evidence', fill, text, font)
    const cols = 3, gap = 4, imgW = (CW - (cols - 1) * gap) / cols, imgH = imgW * 0.78
    let px = M, ph = 42, col = 0
    for (const [key, urls] of photoEntries) {
      for (const url of urls) {
        if (ph + imgH + 8 > 262) { doc.addPage(); pageHeader(doc, 'Photo evidence (cont.)', fill, text, font); ph = 42; col = 0; px = M }
        const x = M + col * (imgW + gap)
        try {
          const data = await downloadImageAsBase64(url)
          if (data) doc.addImage(data, 'JPEG', x, ph, imgW, imgH, undefined, 'FAST')
          else placeholder(doc, x, ph, imgW, imgH, fill, stroke, text, font)
        } catch { placeholder(doc, x, ph, imgW, imgH, fill, stroke, text, font) }
        font('normal', 7); text(C.muted)
        // Caption con trazabilidad: defecto · lote · variedad (para disputas con el recibidor)
        const what = key.startsWith('header.') ? cap(key.replace('header.', '')) + ' (header)' : cap(key)
        const trace = [insp.lot, insp.variety].filter(Boolean).join(' · ')
        const label = trace ? `${what} · ${trace}` : what
        doc.text(label.slice(0, 40), x, ph + imgH + 4)
        col++
        if (col >= cols) { col = 0; ph += imgH + 9; px = M }
      }
    }
  }

  footer(doc, insp, fill, stroke, text, font)
  return Buffer.from(doc.output('arraybuffer'))
}

function pageHeader(doc, title, fill, text, font) {
  fill('#15803d'); doc.rect(0, 0, PAGE_W, 14, 'F')
  text('#ffffff'); font('bold', 12); doc.text(title, M, 9.5)
  font('normal', 8); text('#d7f0df'); doc.text('Insproduce QC', PAGE_W - M, 9.5, { align: 'right' })
}

function footer(doc, insp, fill, stroke, text, font) {
  const n = doc.internal.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    stroke('#e5e7eb'); doc.setLineWidth(0.3); doc.line(M, FOOTER_Y - 3, PAGE_W - M, FOOTER_Y - 3)
    font('normal', 8); text('#9ca3af')
    doc.text(`Inspector: ${insp.inspector_name || 'N/A'}  ·  Generated ${new Date().toLocaleDateString('en-US')}`, M, FOOTER_Y)
    doc.text(`Page ${i} of ${n}`, PAGE_W - M, FOOTER_Y, { align: 'right' })
  }
}

// Notas automáticas según la guía "Notas Repote.pdf" (QC Inspec):
// score 100% Excellent/Good → frase fija sin defectos; Fair/Poor/Bad → frase
// nombrando los defectos que causaron la nota. + temperatura de pulpa y Baxlo.
const BAND_WORDS = { 1: 'Excellent', 2: 'Good', 3: 'Fair', 4: 'Poor', 5: 'Bad' }
function buildAutoNotes(r, insp) {
  const lines = []
  const banded = (r.defects || []).filter(d => d.band != null)
  const worst = banded.length ? Math.max(...banded.map(d => d.band)) : null
  if (worst != null) {
    const word = BAND_WORDS[worst] || '—'
    if (worst <= 2) {
      lines.push(`${word} quality and condition.`)
    } else {
      const causals = banded.filter(d => d.band >= 3)
        .sort((a, b) => b.band - a.band)
        .map(d => (d.label || d.key).replace(/\s*\(.*\)$/, ''))
      lines.push(`${word} quality and condition with presence of ${causals.join(', ')}.`)
    }
  }
  if (insp.temp_pulp != null) lines.push(`Pulp temperature at inspection: ${insp.temp_pulp}°.`)
  if (insp.firmness_min != null || insp.firmness_max != null || insp.firmness_mode != null)
    lines.push(`Baxlo (min / mode / max): ${insp.firmness_min ?? '—'} / ${insp.firmness_mode ?? '—'} / ${insp.firmness_max ?? '—'}.`)
  return lines
}

function placeholder(doc, x, y, w, h, fill, stroke, text, font) {
  fill('#f6f8f6'); stroke('#e5e7eb'); doc.setLineWidth(0.3); doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD')
  font('normal', 7.5); text('#9ca3af'); doc.text('Image unavailable', x + w / 2, y + h / 2, { align: 'center' })
}

async function downloadImageAsBase64(url) {
  if (!isAllowedPhotoUrl(url)) return null
  try {
    const response = await fetch(url, { timeout: 15000 })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    return `data:${contentType};base64,${buffer.toString('base64')}`
  } catch { return null }
}
