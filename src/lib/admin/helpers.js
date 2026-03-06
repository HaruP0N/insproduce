// ─── Helpers generales ────────────────────────────────────────────────────────

export function safeStr(v) {
  if (v === null || v === undefined) return ''
  return String(v)
}

export function formatDate(val) {
  if (!val) return '--'
  // mssql puede devolver objeto Date o string ISO
  let year, month, day
  if (val instanceof Date) {
    year  = val.getUTCFullYear()
    month = val.getUTCMonth() + 1
    day   = val.getUTCDate()
  } else {
    const iso = String(val).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '--'
    ;[year, month, day] = iso.split('-').map(Number)
  }
  if (!year || !month || !day) return '--'
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
}

export function parseKey(key) {
  if (!key) return { prefix: '', bare: key }
  const dot = key.indexOf('.')
  if (dot === -1) return { prefix: '', bare: key }
  return { prefix: key.substring(0, dot), bare: key.substring(dot + 1) }
}

export function stripPrefix(key) {
  return parseKey(key).bare
}

export function humanize(str) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function groupMetrics(values) {
  const groups = {}
  Object.entries(values || {}).forEach(([k, v]) => {
    const { prefix } = parseKey(k)
    const g = prefix || '_other'
    if (!groups[g]) groups[g] = []
    groups[g].push([k, v])
  })
  return groups
}