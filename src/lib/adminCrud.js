// Capa de datos CRUD del admin (modelo qc). Cada función es delgada sobre la API.
async function req(path, opts = {}) {
  const r = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const e = new Error(data?.msg || `HTTP ${r.status}`)
    e.status = r.status
    throw e
  }
  return data
}

/* ── Usuarios ── */
export const listUsers = () => req('/api/users')
export const createUser = (body) => req('/api/users', { method: 'POST', body: JSON.stringify(body) })
export const updateUser = (id, body) => req(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(body) })
export const setUserActive = (id, active) => req(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) })
export const deleteUser = (id) => req(`/api/users/${id}`, { method: 'DELETE' })
export const listInspectores = () => req('/api/users/inspectores')

/* ── Asignaciones ── */
export const listPendientes = async () => (await req('/api/assignments/pendientes')).asignaciones || []
export const createAssignment = (body) => req('/api/inspecciones/asignar', { method: 'POST', body: JSON.stringify(body) })
export const setAssignmentStatus = (id, status) => req(`/api/assignments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
export const deleteAssignment = (id) => req(`/api/assignments/${id}`, { method: 'DELETE' })

/* ── Inspecciones (edición admin) ── */
export const getInspeccion = (id) => req(`/api/inspecciones/${id}`)
export const updateInspeccion = (id, body) => req(`/api/inspecciones/${id}`, { method: 'PUT', body: JSON.stringify(body) })
export const updateInspeccionMetrics = (id, values) => req(`/api/inspecciones/${id}/metrics`, { method: 'PUT', body: JSON.stringify({ values }) })

/* ── Commodities ── */
export const listCommodities = () => req('/api/commodities')
export const listCommoditiesAdmin = () => req('/api/commodities?all=1')
export const createCommodity = (body) => req('/api/commodities', { method: 'POST', body: JSON.stringify(body) })
export const updateCommodity = (code, body) => req(`/api/commodities/${encodeURIComponent(code)}`, { method: 'PUT', body: JSON.stringify(body) })

/* ── Lotes ── */
export const listLots = () => req('/api/lots')
export const updateLot = (id, body) => req(`/api/lots/${id}`, { method: 'PUT', body: JSON.stringify(body) })

/* ── Tolerancias / estándares ── */
export const listStandards = () => req('/api/standards')
export const createStandard = (body) => req('/api/standards', { method: 'POST', body: JSON.stringify(body) })
export const getStandard = (id) => req(`/api/standards/${id}`)
export const saveDefectTolerances = (id, defect_id, bands) => req(`/api/standards/${id}/tolerances`, { method: 'PUT', body: JSON.stringify({ defect_id, bands }) })

/* ── Integraciones (Google Sheets) ── */
export const gsConfig = () => req('/api/google-sheets/config')
export const gsTest = () => req('/api/google-sheets/test')
export const gsLastSync = () => req('/api/google-sheets/last-sync')
export const gsSync = () => req('/api/google-sheets/sync', { method: 'POST' })

/* ── Plantillas ── */
export const listTemplates = () => req('/api/metric-templates')
export const getTemplate = (id) => req(`/api/metric-templates/${id}`)
export const createTemplate = (body) => req('/api/metric-templates', { method: 'POST', body: JSON.stringify(body) })
export const updateTemplateFields = (id, fields) => req(`/api/metric-templates/${id}`, { method: 'PUT', body: JSON.stringify({ fields }) })
