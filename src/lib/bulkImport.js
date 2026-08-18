// Carga masiva de inspecciones desde Excel.
// Contrato compartido entre la plantilla (servidor), el parseo (navegador) y la
// creación (servidor): una fila del Excel = una inspección.

// Columnas de cabecera de la plantilla, en orden. `key` es el campo del payload
// que espera createInspection; `req` marca las obligatorias.
export const HEADER_COLUMNS = [
  { key: 'producer', es: 'Productor', en: 'Producer', req: true, width: 26 },
  { key: 'lot', es: 'Lote', en: 'Lot', req: true, width: 18 },
  { key: 'variety', es: 'Variedad', en: 'Variety', width: 16 },
  { key: 'caliber', es: 'Calibre', en: 'Caliber', width: 12 },
  { key: 'packaging_code', es: 'Cod. Embalaje', en: 'Packaging code', width: 14 },
  { key: 'packaging_type', es: 'Tipo Embalaje', en: 'Packaging type', width: 15 },
  { key: 'packaging_date', es: 'Fecha Embalaje', en: 'Packaging date', width: 14, type: 'date' },
  { key: 'net_weight', es: 'Peso Neto (kg)', en: 'Net weight (kg)', width: 13, type: 'number' },
  { key: 'brix_avg', es: 'Brix Prom', en: 'Brix avg', width: 10, type: 'number' },
  { key: 'brix_min', es: 'Brix Min', en: 'Brix min', width: 10, type: 'number' },
  { key: 'brix_max', es: 'Brix Max', en: 'Brix max', width: 10, type: 'number' },
  { key: 'temp_water', es: 'T Agua', en: 'Water temp', width: 10, type: 'number' },
  { key: 'temp_ambient', es: 'T Ambiente', en: 'Ambient temp', width: 11, type: 'number' },
  { key: 'temp_pulp', es: 'T Pulpa', en: 'Pulp temp', width: 10, type: 'number' },
  { key: 'baxlo_min', es: 'Baxlo Min', en: 'Baxlo min', width: 10, type: 'number' },
  { key: 'baxlo_mode', es: 'Baxlo Moda', en: 'Baxlo mode', width: 11, type: 'number' },
  { key: 'baxlo_max', es: 'Baxlo Max', en: 'Baxlo max', width: 10, type: 'number' },
  { key: 'notes', es: 'Notas', en: 'Notes', width: 30 },
]

// Normaliza un encabezado para comparar sin tildes, mayúsculas ni espacios extra
export const normHeader = (s) =>
  String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '')

const num = (v) => {
  if (v === '' || v == null) return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const toISODate = (v) => {
  if (v == null || v === '') return null
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  // dd-mm-yyyy o dd/mm/yyyy
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  const d = new Date(s)
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

/**
 * Convierte las filas crudas del Excel (array de objetos con los encabezados como
 * claves) en payloads listos para createInspection.
 * `fields` = campos de la plantilla del commodity ({ key: 'quality.dust', label }).
 * Devuelve { rows, errors, unknownColumns } — `rows[i].__row` es la fila del Excel.
 */
export function parseBulkRows(rawRows, fields, commodityCode) {
  // índice: encabezado normalizado → destino
  const index = new Map()
  for (const c of HEADER_COLUMNS) {
    index.set(normHeader(c.es), { kind: 'header', col: c })
    index.set(normHeader(c.en), { kind: 'header', col: c })
    index.set(normHeader(c.key), { kind: 'header', col: c })
  }
  for (const f of fields) {
    // se acepta tanto la etiqueta ("Dust (%)") como la key ("quality.dust")
    index.set(normHeader(f.label), { kind: 'metric', key: f.key })
    index.set(normHeader(f.key), { kind: 'metric', key: f.key })
    const bare = f.key.includes('.') ? f.key.split('.').slice(1).join('.') : f.key
    if (!index.has(normHeader(bare))) index.set(normHeader(bare), { kind: 'metric', key: f.key })
  }

  const rows = []
  const errors = []
  const unknownColumns = new Set()

  rawRows.forEach((raw, i) => {
    const excelRow = i + 2 // fila 1 = encabezados
    const payload = { commodity_code: commodityCode, metrics: {}, photos: {} }
    let hasAnyValue = false

    for (const [rawKey, value] of Object.entries(raw)) {
      if (value === '' || value == null) continue
      const target = index.get(normHeader(rawKey))
      if (!target) { unknownColumns.add(String(rawKey).trim()); continue }
      hasAnyValue = true
      if (target.kind === 'header') {
        const { col } = target
        payload[col.key] = col.type === 'number' ? num(value)
          : col.type === 'date' ? toISODate(value)
          : String(value).trim()
      } else {
        payload.metrics[target.key] = String(value).trim()
      }
    }

    if (!hasAnyValue) return // fila vacía: se ignora en silencio
    const missing = HEADER_COLUMNS.filter((c) => c.req && !payload[c.key])
    if (missing.length) {
      errors.push({ row: excelRow, msg: `falta ${missing.map((c) => c.es).join(' y ')}` })
      return
    }
    payload.__row = excelRow
    rows.push(payload)
  })

  return { rows, errors, unknownColumns: [...unknownColumns] }
}
