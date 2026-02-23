// ─── Status ───────────────────────────────────────────────────────────────────

export const STATUS_OPTIONS = [
  { value: 'pendiente',  label: 'Pendiente',  emoji: '🟡', color: '#92400e', bg: '#fffbeb', bd: '#fcd34d' },
  { value: 'completada', label: 'Completada', emoji: '🟢', color: '#166534', bg: '#f0fdf4', bd: '#86efac' },
  { value: 'cancelada',  label: 'Cancelada',  emoji: '🔴', color: '#991b1b', bg: '#fff1f2', bd: '#fca5a5' }
]

export function statusCfg(val) {
  return STATUS_OPTIONS.find(o => o.value === val) || STATUS_OPTIONS[0]
}

// ─── Grupos de métricas ───────────────────────────────────────────────────────

export const METRIC_GROUPS = {
  quality:   { label: '🔬 Calidad',    color: '#166534', bg: '#f0fdf4', bd: '#86efac', header: '#dcfce7' },
  condition: { label: '🩺 Condición',  color: '#1e40af', bg: '#eff6ff', bd: '#93c5fd', header: '#dbeafe' },
  pack:      { label: '📦 Embalaje',   color: '#6d28d9', bg: '#faf5ff', bd: '#c4b5fd', header: '#ede9fe' }
}

export const DEFAULT_GROUP = {
  label: '📋 Otros', color: '#374151', bg: '#f8fafc', bd: '#e2e8f0', header: '#f1f5f9'
}

export function getGroupCfg(groupKey) {
  return METRIC_GROUPS[groupKey] || DEFAULT_GROUP
}