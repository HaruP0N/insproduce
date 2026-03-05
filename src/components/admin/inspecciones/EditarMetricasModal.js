'use client'

import { useMemo } from 'react'
import { BarChart2, X } from 'lucide-react'
import { S, getGroupCfg, safeStr, humanize, stripPrefix, parseKey } from '@/lib/admin'
import { Button } from '@/components/admin/shared'

export default function EditarMetricasModal({ inspId, draft, onChange, onSave, onClose, saving }) {
  if (!draft) return null

  // ── Agrupar por los FIELDS del template (no por values) ──────────────────
  // Si hay fields del template, usarlos para renderizar todos los inputs.
  // Si no hay fields (template no encontrado), caer en los values existentes.
  const groups = useMemo(() => {
    const fields = draft.fields || []

    if (fields.length > 0) {
      // Agrupar fields por prefijo de su key (ej: "quality.color" → grupo "quality")
      const grouped = {}
      fields.forEach(field => {
        const { prefix } = parseKey(field.key)
        const g = prefix || '_other'
        if (!grouped[g]) grouped[g] = []
        grouped[g].push(field)
      })
      return { mode: 'fields', grouped }
    }

    // Fallback: agrupar por keys existentes en values
    const grouped = {}
    Object.entries(draft.values || {}).forEach(([k, v]) => {
      const { prefix } = parseKey(k)
      const g = prefix || '_other'
      if (!grouped[g]) grouped[g] = []
      grouped[g].push({ key: k, label: humanize(stripPrefix(k)), field_type: 'text', options: [], _value: v })
    })
    return { mode: 'values', grouped }
  }, [draft.fields, draft.values])

  const hasContent = Object.keys(groups.grouped).length > 0

  return (
    <div style={S.modalOv} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.modalHead}>
          <h3 style={{ margin: 0, color: '#15803d', fontSize: 17, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={16} /> Editar métricas — #{inspId}
          </h3>
          <Button variant="gray" small onClick={onClose}><X size={13} /></Button>
        </div>

        {/* Body */}
        <div style={S.modalBody}>
          {!hasContent && (
            <p style={{ color: '#9ca3af', fontSize: 14 }}>No hay métricas para editar.</p>
          )}

          {hasContent && Object.entries(groups.grouped).map(([grp, items]) => {
            const cfg = getGroupCfg(grp)
            return (
              <div key={grp} style={{ marginBottom: 22 }}>
                <p style={{ fontSize: 11, fontWeight: 900, color: cfg.color, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 10px' }}>
                  {cfg.label}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))', gap: 10 }}>
                  {items.map(item => {
                    const key       = item.key
                    const label     = item.label || humanize(stripPrefix(key))
                    const fieldType = item.field_type || 'text'
                    const options   = item.options   || []
                    const unit      = item.unit      || null
                    const currentVal = safeStr(draft.values?.[key] ?? '')

                    const handleChange = val =>
                      onChange(p => ({ ...p, values: { ...p.values, [key]: val } }))

                    return (
                      <div key={key}>
                        <label style={{ fontSize: 10, fontWeight: 800, color: cfg.color, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                          {label}{unit ? ` (${unit})` : ''}
                          {item.required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
                        </label>

                        {fieldType === 'select' ? (
                          <select
                            style={{ ...S.field, borderColor: cfg.bd, background: cfg.bg }}
                            value={currentVal}
                            onChange={e => handleChange(e.target.value)}
                          >
                            <option value="">-- Seleccionar --</option>
                            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>

                        ) : fieldType === 'boolean' ? (
                          <select
                            style={{ ...S.field, borderColor: cfg.bd, background: cfg.bg }}
                            value={currentVal}
                            onChange={e => handleChange(e.target.value)}
                          >
                            <option value="">-- Seleccionar --</option>
                            <option value="true">Sí</option>
                            <option value="false">No</option>
                          </select>

                        ) : (
                          <input
                            type={fieldType === 'number' ? 'number' : 'text'}
                            style={{ ...S.field, borderColor: cfg.bd, background: cfg.bg }}
                            value={currentVal}
                            min={item.min_value ?? undefined}
                            max={item.max_value ?? undefined}
                            onChange={e => handleChange(e.target.value)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
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