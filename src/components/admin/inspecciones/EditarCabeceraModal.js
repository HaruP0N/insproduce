'use client'

import { Pencil, Leaf, Package, X } from 'lucide-react'
import { S } from '@/lib/admin'
import { Button } from '@/components/admin/shared'

export default function EditarCabeceraModal({ inspId, draft, onChange, onSave, onClose, saving }) {
  if (!draft) return null

  const GENERAL  = [['producer', 'Productor'], ['lot', 'Lote'], ['variety', 'Variedad'], ['caliber', 'Calibre']]
  const EMBALAJE = [['packaging_code', 'Código'], ['packaging_type', 'Tipo']]

  return (
    <div style={S.modalOv} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.modalHead}>
          <h3 style={{ margin: 0, color: '#15803d', fontSize: 17, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pencil size={16} /> Editar cabecera — #{inspId}
          </h3>
          <Button variant="gray" small onClick={onClose}><X size={13} /></Button>
        </div>

        <div style={S.modalBody}>
          <p style={{ fontSize: 11, fontWeight: 900, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Leaf size={12} /> Datos generales
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 20 }}>
            {GENERAL.map(([k, lbl]) => (
              <div key={k}>
                <label style={S.label}>{lbl}</label>
                <input style={S.field} value={draft[k] || ''} onChange={e => onChange(p => ({ ...p, [k]: e.target.value }))} />
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, fontWeight: 900, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Package size={12} /> Embalaje
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
            {EMBALAJE.map(([k, lbl]) => (
              <div key={k}>
                <label style={S.label}>{lbl}</label>
                <input style={S.field} value={draft[k] || ''} onChange={e => onChange(p => ({ ...p, [k]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={S.label}>Fecha embalaje</label>
              <input type="date" style={S.field} value={draft.packaging_date || ''} onChange={e => onChange(p => ({ ...p, packaging_date: e.target.value }))} />
            </div>
          </div>
        </div>

        <div style={S.modalFoot}>
          <Button variant="gray" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </div>
    </div>
  )
}