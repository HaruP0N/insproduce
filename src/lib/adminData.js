// Fetchers del panel admin contra el backend qc + mapeo al shape del prototipo.
import { fechaCorta, mapResolution } from '@/lib/proto'

async function fetchJSON(path, opts) {
  const r = await fetch(path, { credentials: 'include', ...opts })
  if (!r.ok) {
    const e = new Error((await r.json().catch(() => ({})))?.msg || `HTTP ${r.status}`)
    e.status = r.status
    throw e
  }
  return r.json()
}

export function mapInspection(r) {
  return {
    id: r.id,
    fecha: fechaCorta(r.created_at),
    createdAt: r.created_at,
    lote: r.lot || '—',
    productor: r.producer || '—',
    commodity: r.commodity_name || r.commodity_code || '',
    variedad: r.variety || '—',
    score: Number(r.score) || 0,
    resolucion: mapResolution(r.resolution, r.score),
    inspector: r.inspector_name || '—',
    pdfStatus: r.pdf_status || null,
    pdfUrl: r.pdf_url || null,
  }
}

export async function getInspectionsList() {
  const rows = await fetchJSON('/api/inspecciones/historial')
  return rows.map(mapInspection)
}

export async function getDashboard() {
  return fetchJSON('/api/dashboard')
}

export async function getInspectionDetail(id) {
  return fetchJSON('/api/inspecciones/' + id)
}

export async function getMe() {
  const d = await fetchJSON('/api/auth/me')
  return d.user
}

export async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }) } catch {}
  window.location.href = '/login'
}
