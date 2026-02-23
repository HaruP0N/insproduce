// ─── Helpers generales ────────────────────────────────────────────────────────

export function safeStr(v) {
  if (v === null || v === undefined) return ''
  return String(v)
}

export function formatDate(dateStr) {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '--'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
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