'use client'

import { S, safeStr, formatDate } from '@/lib/admin'
import { Button } from '@/components/admin/shared'

// ─── HistorialInspecciones ────────────────────────────────────────────────────
// Props:
//   inspecciones → array filtrado
//   total        → número total (sin filtrar)
//   search       → string
//   onSearch     → fn(str)
//   soloPDF      → boolean
//   onSoloPDF    → fn(bool)
//   onRefresh    → fn
//   onVerDetalle → fn(insp)
//   onGenerarPDF → fn(insp)

export default function HistorialInspecciones({
  inspecciones, total,
  search, onSearch,
  soloPDF, onSoloPDF,
  onRefresh,
  onVerDetalle, onGenerarPDF
}) {
  const pdfOk = i => !!i.pdf_url

  return (
    <>
      {/* Barra superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: '#15803d', fontSize: 18, fontWeight: 900 }}>📊 Historial de Inspecciones</h2>
          <p style={{ margin: '3px 0 0', color: '#6b7280', fontSize: 13 }}>
            {inspecciones.length} de {total}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={{ padding: '9px 14px', borderRadius: 12, border: '1px solid #d1d5db', fontSize: 13, color: '#111827', outline: 'none', minWidth: 280 }}
            placeholder="Buscar lote, productor, variedad…"
            value={search}
            onChange={e => onSearch(e.target.value)}
          />
          <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 13, color: '#374151', cursor: 'pointer' }}>
            <input type="checkbox" checked={soloPDF} onChange={e => onSoloPDF(e.target.checked)} />
            Solo PDF pendiente
          </label>
          <Button variant="outline" small onClick={onRefresh}>↺ Refrescar</Button>
        </div>
      </div>

      {/* Tabla */}
      <div style={S.card}>
        <table style={S.tbl}>
          <thead>
            <tr>
              {['Fecha', 'Commodity', 'Lote / Productor', 'Variedad', 'PDF', 'Acciones'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inspecciones.map(insp => {
              const ok = pdfOk(insp)
              return (
                <tr key={insp.id}>
                  <td style={S.td}>{formatDate(insp.created_at)}</td>
                  <td style={S.td}>
                    <strong>{insp.commodity_code || '--'}</strong>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{insp.commodity_name || ''}</div>
                  </td>
                  <td style={S.td}>
                    <strong>{insp.lot || '--'}</strong>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{insp.producer || '--'}</div>
                  </td>
                  <td style={S.td}>{insp.variety || '--'}</td>
                  <td style={S.td}>
                    <span style={{
                      display: 'inline-block', padding: '4px 10px', borderRadius: 999,
                      fontSize: 11, fontWeight: 700,
                      background: ok ? '#f0fdf4' : '#fffbeb',
                      color: ok ? '#166534' : '#92400e',
                      border: `1px solid ${ok ? '#86efac' : '#fcd34d'}`
                    }}>
                      {ok ? '✅ Generado' : '⏳ Pendiente'}
                    </span>
                  </td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button variant="outline" small onClick={() => onVerDetalle(insp)}>Ver</Button>
                      {ok ? (
                        <Button variant="blue" small onClick={() => window.open(`/api/inspecciones/${insp.id}/pdf`, '_blank', 'noopener')}>
                          📄 PDF
                        </Button>
                      ) : (
                        <Button small onClick={() => onGenerarPDF(insp)}>⚙️ PDF</Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {inspecciones.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#9ca3af', padding: 36 }}>Sin resultados</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}