'use client'

import { useMemo } from 'react'
import { S, getGroupCfg, groupMetrics } from '@/lib/admin'
import { safeStr, humanize, stripPrefix } from '@/lib/admin'
import { Button } from '@/components/admin/shared'

// ─── EditarMetricasModal ──────────────────────────────────────────────────────
// Props:
//   inspId    → id de la inspección
//   draft     → { template_id, values: {}, fields: [] }
//   onChange  → fn(updater)
//   onSave    → async fn
//   onClose   → fn
//   saving    → boolean

export default function EditarMetricasModal({ inspId, draft, onChange, onSave, onClose, saving }) {
  if (!draft) return null

  const metricsGroups = useMemo(() => groupMetrics(draft?.values), [draft?.values])

  return (
    <div style={S.modalOv} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.modalHead}>
          <h3 style={{ margin: 0, color: '#15803d', fontSize: 17, fontWeight: 900 }}>
            📊 Editar métricas — #{inspId}
          </h3>
          <Button variant="gray" small onClick={onClose}>✕</Button>
        </div>

        {/* Body */}
        <div style={S.modalBody}>
          {Object.entries(metricsGroups).map(([grp, entries]) => {
            const cfg = getGroupCfg(grp)
            return (
              <div key={grp} style={{ marginBottom: 22 }}>
                <p style={{ fontSize: 11, fontWeight: 900, color: cfg.color, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 10px' }}>
                  {cfg.label}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))', gap: 10 }}>
                  {entries.map(([k]) => {
                    const field    = (draft.fields || []).find(f => f.key === k)
                    const isSelect = field?.field_type === 'select'
                    const options  = field?.options || []

                    return (
                      <div key={k}>
                        <label style={{ fontSize: 10, fontWeight: 800, color: cfg.color, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                          {humanize(stripPrefix(k))}
                        </label>

                        {isSelect ? (
                          <select
                            style={{ ...S.field, borderColor: cfg.bd, background: cfg.bg }}
                            value={safeStr(draft.values[k])}
                            onChange={e => onChange(p => ({ ...p, values: { ...p.values, [k]: e.target.value } }))}
                          >
                            <option value="">-- Seleccionar --</option>
                            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input
                            style={{ ...S.field, borderColor: cfg.bd, background: cfg.bg }}
                            value={safeStr(draft.values[k])}
                            onChange={e => onChange(p => ({ ...p, values: { ...p.values, [k]: e.target.value } }))}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {Object.keys(metricsGroups).length === 0 && (
            <p style={{ color: '#9ca3af', fontSize: 14 }}>No hay métricas para editar.</p>
          )}
        </div>

        {/* Footer */}
        <div style={S.modalFoot}>
          <Button variant="gray" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar métricas'}</Button>
        </div>
      </div>
    </div>
  )
}