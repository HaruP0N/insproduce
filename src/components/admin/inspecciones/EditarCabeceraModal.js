'use client'

import { Pencil, Leaf, Package, Thermometer, Ruler, X } from 'lucide-react'
import { S } from '@/lib/admin'
import { Button } from '@/components/admin/shared'
import ImageUploader from '@/components/ImageUploader'

export default function EditarCabeceraModal({ inspId, draft, onChange, onSave, onClose, saving }) {
  if (!draft) return null

  const set = (k, v) => onChange(p => ({ ...p, [k]: v }))
  const setPhoto = (k, urls) => onChange(p => ({
    ...p,
    header_photos: { ...(p.header_photos || {}), [k]: urls }
  }))

  const photos = draft.header_photos || {}

  const fieldStyle = { ...S.field }
  const numStyle   = { ...S.field, width: '100%' }

  return (
    <div style={S.modalOv} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth: 780 }}>

        {/* Header */}
        <div style={S.modalHead}>
          <h3 style={{ margin: 0, color: '#15803d', fontSize: 17, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pencil size={16} /> Editar cabecera — #{inspId}
          </h3>
          <Button variant="gray" small onClick={onClose}><X size={13} /></Button>
        </div>

        <div style={S.modalBody}>

          {/* ── Datos generales ── */}
          <SectionTitle Icon={Leaf} label="Datos generales" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
            {[['producer','Productor'],['lot','Lote'],['variety','Variedad'],['caliber','Calibre']].map(([k, lbl]) => (
              <div key={k}>
                <label style={S.label}>{lbl}</label>
                <input style={fieldStyle} value={draft[k] || ''} onChange={e => set(k, e.target.value)} />
              </div>
            ))}
          </div>

          {/* ── Embalaje ── */}
          <SectionTitle Icon={Package} label="Embalaje" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 8 }}>
            <div>
              <label style={S.label}>Código</label>
              <input style={fieldStyle} value={draft.packaging_code || ''} onChange={e => set('packaging_code', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Tipo</label>
              <input style={fieldStyle} value={draft.packaging_type || ''} onChange={e => set('packaging_type', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Fecha embalaje</label>
              <input type="date" style={fieldStyle} value={draft.packaging_date || ''} onChange={e => set('packaging_date', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Peso neto (kg)</label>
              <input type="number" step="0.01" style={fieldStyle} value={draft.net_weight ?? ''} onChange={e => set('net_weight', e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ ...S.label, marginBottom: 6 }}>Fotos embalaje / peso</label>
            <ImageUploader fieldKey="header.net_weight" images={photos.net_weight || []}
              onChange={urls => setPhoto('net_weight', urls)} maxImages={3} disabled={saving} />
          </div>

          {/* ── Brix ── */}
          <SectionTitle Icon={Thermometer} label="Brix" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 8 }}>
            {[['brix_avg','Promedio'],['brix_min','Mínimo'],['brix_max','Máximo'],['brix_moda','Moda']].map(([k, lbl]) => (
              <div key={k}>
                <label style={S.label}>{lbl}</label>
                <input type="number" step="0.01" style={numStyle} value={draft[k] ?? ''} onChange={e => set(k, e.target.value)} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ ...S.label, marginBottom: 6 }}>Fotos Brix</label>
            <ImageUploader fieldKey="header.brix" images={photos.brix || []}
              onChange={urls => setPhoto('brix', urls)} maxImages={3} disabled={saving} />
          </div>

          {/* ── Temperatura ── */}
          <SectionTitle Icon={Thermometer} label="Temperatura (°C)" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 8 }}>
            {[['temp_water','Agua'],['temp_ambient','Ambiente'],['temp_pulp','Pulpa']].map(([k, lbl]) => (
              <div key={k}>
                <label style={S.label}>{lbl}</label>
                <input type="number" step="0.1" style={numStyle} value={draft[k] ?? ''} onChange={e => set(k, e.target.value)} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ ...S.label, marginBottom: 6 }}>Fotos Temperatura</label>
            <ImageUploader fieldKey="header.temperatura" images={photos.temperatura || []}
              onChange={urls => setPhoto('temperatura', urls)} maxImages={3} disabled={saving} />
          </div>

          {/* ── Diámetro ── */}
          <SectionTitle Icon={Ruler} label="Diámetro (mm)" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 20 }}>
            {[['diameter_min','Mínimo'],['diameter_max','Máximo']].map(([k, lbl]) => (
              <div key={k}>
                <label style={S.label}>{lbl}</label>
                <input type="number" step="0.1" style={numStyle} value={draft[k] ?? ''} onChange={e => set(k, e.target.value)} />
              </div>
            ))}
          </div>

          {/* ── Notas ── */}
          <div>
            <label style={S.label}>Notas / Comentarios</label>
            <textarea rows={3} style={{ ...S.field, resize: 'vertical', fontFamily: 'inherit' }}
              value={draft.notes || ''} onChange={e => set('notes', e.target.value)} />
          </div>

        </div>

        {/* Footer */}
        <div style={S.modalFoot}>
          <Button variant="gray" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ Icon, label }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 900, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon size={12} /> {label}
    </p>
  )
}