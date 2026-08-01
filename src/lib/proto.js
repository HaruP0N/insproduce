// Constantes/helpers del design system del prototipo + mapeo al backend qc.
export const RES = {
  aprobado:    { key: 'aprobado',    label: 'Aprobado',    color: 'green', icon: 'checkCircle' },
  condicional: { key: 'condicional', label: 'Condicional', color: 'amber', icon: 'warnCircle' },
  rechazado:   { key: 'rechazado',   label: 'Rechazado',   color: 'red',   icon: 'xCircle' },
}
export const RES_VAR = { aprobado: '--green', condicional: '--amber', rechazado: '--red' }

export const fmt1 = (n) => (Math.round((Number(n) || 0) * 10) / 10).toFixed(1)

export function resolveFromScore(score) {
  if (score >= 90) return 'aprobado'
  if (score >= 75) return 'condicional'
  return 'rechazado'
}

// backend qc usa approved/conditional/rejected → etiquetas del prototipo
export function mapResolution(en, score) {
  const m = { approved: 'aprobado', conditional: 'condicional', rejected: 'rechazado' }
  return m[en] || (score != null ? resolveFromScore(Number(score)) : 'condicional')
}

export function fechaCorta(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0')
}
