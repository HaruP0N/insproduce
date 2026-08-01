import { Leaf, Package } from 'lucide-react'
import ImageUploader from '@/components/ImageUploader'

const CAMPOS_BASICOS = [
  ['producer', 'Productor',    true,  'text'],
  ['lot',      'Lote / Serie', true,  'text'],
  ['variety',  'Variedad',     false, 'text'],
  ['caliber',  'Calibre',      false, 'text'],
]

const CAMPOS_CON_FOTO = [
  ['packaging_code', 'Cod. Embalaje',  false, 'text'],
  ['packaging_type', 'Tipo Embalaje',  false, 'text'],
  ['packaging_date', 'Fecha Embalaje', false, 'date'],
  ['net_weight',     'Peso neto (kg)', false, 'number'],
]

const GRUPOS_NUMERICOS = [
  {
    key:   'brix',
    label: 'Brix',
    foto:  true,
    campos: [
      ['brix_avg',  'Promedio'],
      ['brix_min',  'Mínimo'],
      ['brix_max',  'Máximo'],
      ['brix_moda', 'Moda'],
    ]
  },
  {
    key:   'temperatura',
    label: 'Temperatura (°C)',
    foto:  true,
    campos: [
      ['temp_water',   'Agua'],
      ['temp_ambient', 'Ambiente'],
      ['temp_pulp',    'Pulpa'],
    ]
  },
  {
    key:   'diametro',
    label: 'Diámetro (mm)',
    foto:  false,
    campos: [
      ['diameter_min', 'Mínimo'],
      ['diameter_max', 'Máximo'],
    ]
  },
  {
    key:   'baxlo',
    label: 'Baxlo — firmeza Shore (protocolo: mín / moda / máx)',
    foto:  true,
    campos: [
      ['baxlo_min',  'Mínimo'],
      ['baxlo_mode', 'Moda'],
      ['baxlo_max',  'Máximo'],
    ]
  }
]

const inputStyle = (readonly, theme) => ({
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: readonly ? `2px solid ${theme.color}` : '1px solid #d1d5db',
  background: readonly ? theme.lightBg : '#fff',
  color: '#111827', fontSize: 14,
  fontWeight: readonly ? 700 : 400, boxSizing: 'border-box'
})

const numInputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid #d1d5db', background: '#fff',
  color: '#111827', fontSize: 14, boxSizing: 'border-box'
}

export default function CabeceraForm({ header, headerPhotos, onHeader, onHeaderPhotos, isFromAssignment, theme, loading }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 16px', color: '#111827', fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Leaf size={16} color={theme.color} />
        {isFromAssignment ? 'Completar Información' : 'Identificación del Lote'}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>

        {/* ── Campos básicos ── */}
        {CAMPOS_BASICOS.map(([k, label, req]) => {
          const readonly = isFromAssignment && ['producer', 'lot', 'variety'].includes(k)
          return (
            <div key={k}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 900, color: readonly ? theme.color : '#374151', marginBottom: 6, textTransform: 'uppercase' }}>
                {label} {readonly && '✓'}
              </label>
              <input type="text" name={k} value={header[k]} onChange={onHeader}
                style={inputStyle(readonly, theme)} required={!!req} readOnly={readonly} />
            </div>
          )
        })}

        {/* ── Campos con foto ── */}
        {CAMPOS_CON_FOTO.map(([k, label, req, type]) => (
          <div key={k} style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 900, color: '#374151', marginBottom: 6, textTransform: 'uppercase' }}>
              <Package size={11} color="#6b7280" /> {label}
            </label>
            <input type={type} name={k} value={header[k]} onChange={onHeader}
              style={inputStyle(false, theme)} required={!!req} step={type === 'number' ? '0.01' : undefined} />
            <div style={{ marginTop: 8 }}>
              <ImageUploader fieldKey={`header.${k}`} images={headerPhotos[k] || []}
                onChange={urls => onHeaderPhotos(k, urls)} maxImages={3} disabled={loading} />
            </div>
          </div>
        ))}

        {/* ── Grupos numéricos compactos ── */}
        {GRUPOS_NUMERICOS.map(({ key, label, foto, campos }) => (
          <div key={key} style={{ gridColumn: '1 / -1', background: '#f8fafc', borderRadius: 12, padding: 14, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#374151', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Package size={11} color="#6b7280" /> {label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${campos.length}, 1fr)`, gap: 10, marginBottom: foto ? 12 : 0 }}>
              {campos.map(([k, sublabel]) => (
                <div key={k}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase' }}>
                    {sublabel}
                  </label>
                  <input type="number" name={k} value={header[k] ?? ''} onChange={onHeader}
                    style={numInputStyle} step="0.01" />
                </div>
              ))}
            </div>
            {foto && (
              <ImageUploader
                fieldKey={`header.${key}`}
                images={headerPhotos[key] || []}
                onChange={urls => onHeaderPhotos(key, urls)}
                maxImages={3}
                disabled={loading}
              />
            )}
          </div>
        ))}

        {/* ── Notas ── */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 900, color: '#374151', marginBottom: 6, textTransform: 'uppercase' }}>
            Notas / Comentarios
          </label>
          <textarea name="notes" value={header.notes} onChange={onHeader} rows={3}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
        </div>

      </div>
    </div>
  )
}