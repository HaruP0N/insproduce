// Parser del manifiesto de contenedor (Shipping Detail Report de Famous/FTF).
// Corre en el NAVEGADOR (previsualización antes de tocar la BD).
// Una fila por pallet+grower: un pallet puede repetirse — combineflag '*' marca
// pallets compartidos entre growers o fechas de cosecha distintas.

const REQUIRED_COLS = ['pallet', 'growerblockid', 'icqnt', 'galotid']

// serial Excel → 'YYYY-MM-DD'
const serialToDate = (n) => {
  if (n == null || n === '' || !Number.isFinite(Number(n))) return null
  return new Date(Date.UTC(1899, 11, 30) + Number(n) * 86400000).toISOString().slice(0, 10)
}

// "BBRY 12/Pint Large #1 Family Tree Blue Bell 6 Product of Paracas1"
//  → { packaging: '12/Pint Large #1', variety: 'Blue Bell 6', origin: 'Paracas1' }
export function parseProductDescr(descr) {
  const s = String(descr || '').trim()
  const out = { packaging: null, variety: null, origin: null }
  if (!s) return out
  const mPack = s.match(/^BBRY\s+(.*?)\s+Family Tree/i)
  if (mPack) out.packaging = mPack[1].trim() || null
  const mVar = s.match(/Family Tree\s+(.*?)\s+Product of/i)
  if (mVar) out.variety = mVar[1].trim() || null
  const mOri = s.match(/Product of\s+(.*)$/i)
  if (mOri) out.origin = mOri[1].trim() || null
  return out
}

/**
 * Parsea el workbook (XLSX ya leído con sheet_to_json {defval:null}).
 * Devuelve { info, rows, errors }.
 */
export function parseManifestRows(jsonRows) {
  if (!Array.isArray(jsonRows) || !jsonRows.length)
    return { info: null, rows: [], errors: ['Archivo vacío'] }

  const first = jsonRows.find((r) => r && typeof r === 'object') || {}
  const missing = REQUIRED_COLS.filter((c) => !(c in first))
  if (missing.length)
    return { info: null, rows: [], errors: [`No parece un Shipping Detail Report: faltan columnas ${missing.join(', ')}`] }

  // info general (misma en todas las filas)
  const anyRow = jsonRows.find((r) => r.sono) || first

  // filas de comentario (recordtype '7'): shipment code, container y lectores de temperatura
  const comments = jsonRows
    .map((r) => (r.cmnt == null ? '' : String(r.cmnt).trim()))
    .filter(Boolean)
  const cVal = (re) => {
    for (const c of comments) { const m = c.match(re); if (m) return m[1].trim() }
    return null
  }
  const tempRecorders = comments
    .map((c) => c.match(/TEMP RECORDER\s*#?\d*:\s*(\S+)/i))
    .filter(Boolean).map((m) => m[1])

  // filas resumen por producto (recordtype '2'): cajas pedidas vs embarcadas por línea
  const lines = jsonRows
    .filter((r) => String(r.recordtype) === '2' && (Number(r.lineordicqnt) || Number(r.lineicqnt)))
    .map((r) => ({
      product: String(r.productdescr || '').trim() || null,
      ordered: Number(r.lineordicqnt) || 0,
      shipped: Number(r.lineicqnt) || 0,
    }))

  const info = {
    order_number: anyRow.sono ? String(anyRow.sono) : null,
    // el comentario "CONTAINER #:" es lo más confiable; si no, custporef/carrier
    container: cVal(/CONTAINER\s*#?:\s*(\S+)/i) || (anyRow.custporef ? String(anyRow.custporef) : (anyRow.carrier ? String(anyRow.carrier) : null)),
    shipment_code: cVal(/SHIPMENT CODE:\s*(\S+)/i),
    temp_recorders: tempRecorders,
    client: anyRow.lastconame || null,
    receiver: anyRow.descr || null,
    origin_org: anyRow.warehouse || null,
    ship_date: serialToDate(anyRow.shipdatetime),
    lines,
    total_shipped: lines.reduce((a, l) => a + l.shipped, 0) || null,
  }

  const rows = []
  for (const r of jsonRows) {
    const pallet = String(r.pallet ?? '').trim()
    // detalle = recordtype '4'; si la columna no viniera, se filtra como antes
    if (r.recordtype != null && String(r.recordtype) !== '4') continue
    if (!pallet || pallet === '0' || !r.growerblockid) continue
    const prod = parseProductDescr(r.productdescr)
    rows.push({
      pallet_code: pallet.slice(0, 50),
      grower_code: String(r.growerblockid).trim().slice(0, 40),
      combined: r.combineflag === '*',
      cases: Number.isFinite(Number(r.icqnt)) ? Number(r.icqnt) : null,
      lot_code: r.galotid ? String(r.galotid).trim().slice(0, 80) : null,
      recv_date: serialToDate(r.recvdate),
      variety: prod.variety,
      packaging: prod.packaging,
      origin: prod.origin,
    })
  }
  if (!rows.length) return { info, rows, errors: ['No se encontraron filas de pallets en el archivo'] }
  const warnings = []
  const detailTotal = rows.reduce((a, r) => a + (r.cases || 0), 0)
  if (info.total_shipped && detailTotal !== info.total_shipped)
    warnings.push(`Cajas del detalle (${detailTotal}) ≠ resumen del embarque (${info.total_shipped})`)
  for (const l of lines) {
    if (l.ordered && l.shipped && l.ordered !== l.shipped)
      warnings.push(`Pedido ≠ embarcado en "${l.product}": ${l.ordered} vs ${l.shipped}`)
  }
  return { info, rows, errors: [], warnings }
}

/** Agrupa las filas por pallet para la vista con dropdown. */
export function groupManifest(rows) {
  const map = new Map()
  for (const r of rows || []) {
    if (!map.has(r.pallet_code)) map.set(r.pallet_code, [])
    map.get(r.pallet_code).push(r)
  }
  return [...map.entries()].map(([pallet, parts]) => {
    const growers = [...new Set(parts.map((p) => p.grower_code).filter(Boolean))]
    const varieties = [...new Set(parts.map((p) => p.variety).filter(Boolean))]
    const dates = [...new Set(parts.map((p) => p.recv_date).filter(Boolean))]
    return {
      pallet,
      parts,
      cases: parts.reduce((a, p) => a + (p.cases || 0), 0),
      growers, varieties, dates,
      lot: parts[0]?.lot_code || null,
      mixed: growers.length > 1 || varieties.length > 1 || dates.length > 1 || parts.some((p) => p.combined),
    }
  })
}
