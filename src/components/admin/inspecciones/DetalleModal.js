'use client'

import { useMemo } from 'react'
import { formatDate, groupMetrics } from '@/lib/admin'
import { Button } from '@/components/admin/shared'
import MetricGroup from './MetricGroup'

// ─── DetalleModal ─────────────────────────────────────────────────────────────
// Props:
//   detail        → objeto inspección completa (null mientras carga)
//   loading       → boolean
//   onClose       → fn
//   onEditHeader  → fn
//   onEditMetrics → fn
//   onGenerarPDF  → fn(detail)
//   onOpenPDF     → fn

export default function DetalleModal({
  detail, loading, onClose,
  onEditHeader, onEditMetrics,
  onGenerarPDF, onOpenPDF
}) {
  if (!detail && !loading) return null

  const metricGroups = useMemo(() => groupMetrics(detail?.metrics?.values), [detail?.metrics])

  const headerSections = [
    {
      title: '🌿 Datos generales',
      fields: [
        ['Productor', detail?.producer],
        ['Lote',      detail?.lot],
        ['Variedad',  detail?.variety],
        ['Calibre',   detail?.caliber]
      ]
    },
    {
      title: '📦 Embalaje',
      fields: [
        ['Código',    detail?.packaging_code],
        ['Tipo',      detail?.packaging_type],
        ['Fecha',     formatDate(detail?.packaging_date)],
        ['Peso neto', detail?.net_weight ? `${detail.net_weight} kg` : null]
      ]
    },
    {
      title: '🌡️ Temperatura & Brix',
      fields: [
        ['Brix promedio', detail?.brix_avg    != null ? `${detail.brix_avg}°`    : null],
        ['Temp. agua',    detail?.temp_water   != null ? `${detail.temp_water}°C` : null],
        ['Temp. ambiente',detail?.temp_ambient != null ? `${detail.temp_ambient}°C` : null],
        ['Temp. pulpa',   detail?.temp_pulp    != null ? `${detail.temp_pulp}°C`  : null]
      ]
    }
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, zIndex: 9999
      }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width: '100%', maxWidth: 1020, maxHeight: '92vh',
        background: '#fff', borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column'
      }}>

        {/* ── Header del modal ── */}
        <div style={{
          background: 'linear-gradient(135deg,#15803d,#16a34a)',
          color: '#fff', padding: '16px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: 10, opacity: 0.75, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 }}>
              Inspección #{detail?.id}
            </div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              {detail?.commodity_code} — {detail?.lot || '…'}
            </h3>
            {detail?.commodity_name && (
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{detail.commodity_name}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {detail?.pdf_url ? (
              <Button
                onClick={onOpenPDF}
                style={{ background: 'rgba(255,255,255,.2)', borderColor: 'rgba(255,255,255,.4)', color: '#fff' }}
              >
                📄 Ver PDF
              </Button>
            ) : (
              <Button
                onClick={() => onGenerarPDF(detail)}
                style={{ background: 'rgba(255,255,255,.2)', borderColor: 'rgba(255,255,255,.4)', color: '#fff' }}
              >
                ⚙️ Generar PDF
              </Button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff',
                borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700
              }}
            >
              ✕ Cerrar
            </button>
          </div>
        </div>

        {/* ── Cuerpo ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 22 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 52, color: '#9ca3af' }}>⏳ Cargando detalles…</div>
          )}

          {!loading && detail && (
            <>
              {/* Cabecera */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, color: '#15803d', fontSize: 14, fontWeight: 900 }}>📋 Información general</h4>
                <Button variant="outline" small onClick={onEditHeader}>✏️ Editar</Button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, marginBottom: 20 }}>
                {headerSections.map(sec => (
                  <div key={sec.title} style={{ background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{
                      background: '#f1f5f9', padding: '8px 14px',
                      fontSize: 11, fontWeight: 900, color: '#475569',
                      textTransform: 'uppercase', letterSpacing: 0.5
                    }}>
                      {sec.title}
                    </div>
                    <div style={{ padding: '10px 14px' }}>
                      {sec.fields.filter(([, v]) => v).length === 0 ? (
                        <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Sin datos</div>
                      ) : (
                        sec.fields.filter(([, v]) => v).map(([label, val]) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{val}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Notas */}
              {detail?.notes && (
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12, padding: '10px 16px', marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: '#92400e', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>
                    💬 Comentarios
                  </div>
                  <div style={{ fontSize: 14, color: '#78350f', lineHeight: 1.5 }}>{detail.notes}</div>
                </div>
              )}

              {/* Métricas */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, color: '#15803d', fontSize: 14, fontWeight: 900 }}>📊 Métricas</h4>
                <Button variant="outline" small onClick={onEditMetrics}>✏️ Editar</Button>
              </div>

              {Object.keys(metricGroups).length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', background: '#f8fafc', borderRadius: 14, fontSize: 14 }}>
                  Sin métricas registradas
                </div>
              ) : (
                Object.entries(metricGroups).map(([grp, entries]) => (
                  <MetricGroup key={grp} groupKey={grp} entries={entries} />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}