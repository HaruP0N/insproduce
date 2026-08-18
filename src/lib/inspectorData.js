// Capa de datos del inspector de campo: fetchers contra el backend qc + mapeo
// al shape del prototipo. Reutiliza la lógica de creación que ya existía en el hook.
import { fechaCorta, mapResolution } from '@/lib/proto'
export { getMe, logout } from '@/lib/adminData'

async function fetchJSON(path, opts) {
  const r = await fetch(path, { credentials: 'include', ...opts })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const e = new Error(data?.msg || `HTTP ${r.status}`)
    e.status = r.status
    throw e
  }
  return data
}

// commodity_code (qc, inglés) → presentación (ícono propio + color + nombre localizado)
const COMMODITY_ALIASES = { FRUTILLA: 'STRAWBERRY', ARANDANO: 'BLUEBERRY', RED_CURRANTS: 'REDCURRANT' }
const COMMODITY_VISUALS = {
  BLUEBERRY:  { key: 'arandano',  icon: 'blueberry',  es: 'Arándano' },
  STRAWBERRY: { key: 'frutilla',  icon: 'strawberry', es: 'Frutilla' },
  RASPBERRY:  { key: 'frambuesa', icon: 'raspberry',  es: 'Frambuesa' },
  BLACKBERRY: { key: 'mora',      icon: 'blackberry', es: 'Mora' },
  REDCURRANT: { key: 'grosella',  icon: 'currant',    es: 'Grosella' },
  CHERRY:     { key: 'cereza',    icon: 'currant',    es: 'Cereza' },
}

// t es opcional: con él, el nombre sale traducido (commodity.<CODE> en el diccionario)
export function commodityVisual(code, t) {
  let c = String(code || '').toUpperCase()
  c = COMMODITY_ALIASES[c] || c
  const v = COMMODITY_VISUALS[c]
  if (!v) return { key: 'arandano', icon: 'blueberry', label: code || '—' }
  const translated = t ? t('commodity.' + c) : null
  const label = translated && translated !== 'commodity.' + c ? translated : v.es
  return { key: v.key, icon: v.icon, label }
}

// ── Asignadas (cola de trabajo del inspector) ──
export async function getAssigned() {
  const d = await fetchJSON('/api/inspecciones/asignadas')
  return (d.inspecciones || []).map(a => ({
    id: a.id,
    lote: a.lot || '—',
    productor: a.producer || 'Sin productor',
    variedad: a.variety || '—',
    commodity_code: a.commodity_code || null,
    asignada: fechaCorta(a.created_at),
    notasAdmin: a.notes_admin || null,
  }))
}

// ── Completadas (creadas por el inspector) ──
export function mapCompleted(r) {
  return {
    id: r.id,
    fecha: fechaCorta(r.created_at),
    createdAt: r.created_at,
    lote: r.lot || '—',
    productor: r.producer || '—',
    commodity_code: r.commodity_code,
    commodityName: r.commodity_name || r.commodity_code || '',
    variedad: r.variety || '—',
    score: Number(r.score) || 0,
    resolucion: mapResolution(r.resolution, r.score),
    pdfUrl: r.pdf_url || null,
  }
}
export async function getCompleted() {
  const d = await fetchJSON('/api/inspecciones/completadas')
  return (d.inspecciones || []).map(mapCompleted)
}

export async function getDetail(id) {
  return fetchJSON('/api/inspecciones/' + id)
}

export async function getCommodities() {
  const d = await fetchJSON('/api/commodities')
  return Array.isArray(d) ? d : []
}

export async function getTemplate(code) {
  const d = await fetchJSON('/api/metric-templates/code/' + encodeURIComponent(code))
  return { template: d.template || null, fields: Array.isArray(d.fields) ? d.fields : [] }
}

// Crea la inspección con el MISMO payload que usaba el hook (metrics keyed "family.code").
export async function saveInspection(payload) {
  return fetchJSON('/api/inspecciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
