import { Microscope, Stethoscope, Package } from 'lucide-react'
import ImageUploader from '@/components/ImageUploader'

const METRIC_GROUPS = {
  quality:   { label: 'Calidad',    description: 'Métricas de calidad del producto', color: '#15803d', Icon: Microscope },
  condition: { label: 'Condición',  description: 'Estado físico y condición',         color: '#1e40af', Icon: Stethoscope },
  pack:      { label: 'Embalaje',   description: 'Características de empaque',         color: '#7c3aed', Icon: Package }
}
const DEFAULT_GROUP = { label: 'Otros', color: '#6b7280', Icon: Package }

function humanize(str) { return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }
function bareKey(key)  { const dot = key.indexOf('.'); return dot === -1 ? key : key.substring(dot + 1) }

export default function MetricasForm({ groupedFields, values, photos, onField, onPhotos, loading }) {
  return (
    <>
      {Object.entries(groupedFields).map(([grp, grpFields]) => {
        const cfg = METRIC_GROUPS[grp] || DEFAULT_GROUP
        const { Icon } = cfg
        return (
          <div key={grp} style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, border: `2px solid ${cfg.color}20`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `2px solid ${cfg.color}20` }}>
              <h3 style={{ margin: 0, color: cfg.color, fontSize: 18, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={18} /> {cfg.label}
              </h3>
              {cfg.description && <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>{cfg.description}</p>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 20 }}>
              {grpFields.map(f => (
                <div key={f.key} style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 900, color: cfg.color, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {humanize(bareKey(f.key))}{f.unit && ` (${f.unit})`}{f.required && ' *'}
                  </label>

                  {f.field_type === 'select' ? (
                    <select value={values[f.key] ?? ''} onChange={e => onField(f.key, e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, marginBottom: 12, background: '#fff' }}
                      required={!!f.required}>
                      <option value="">-- Seleccionar --</option>
                      {(f.options || []).map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                  ) : (
                    <input type={f.field_type === 'number' ? 'number' : 'text'}
                      value={values[f.key] ?? ''} onChange={e => onField(f.key, e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, marginBottom: 12, background: '#fff' }}
                      min={f.min_value ?? undefined} max={f.max_value ?? undefined}
                      step={f.field_type === 'number' ? '0.01' : undefined} required={!!f.required} />
                  )}

                  <ImageUploader fieldKey={f.key} images={photos[f.key] || []}
                    onChange={urls => onPhotos(f.key, urls)} maxImages={3} disabled={loading} />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}