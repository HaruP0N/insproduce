'use client'

import { useMemo } from 'react'
import useFormularioInspeccion from '@/hooks/useFormularioInspeccion'
import CabeceraForm  from './inspector/CabeceraForm'
import MetricasForm  from './inspector/MetricasForm'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN VISUAL
// ═══════════════════════════════════════════════════════════════════════════
const COMMODITY_THEMES = {
  BLUEBERRY:   { name: 'Arándano',  icon: '🫐', color: '#6366f1', lightBg: '#eef2ff', darkBg: '#e0e7ff' },
  RASPBERRY:   { name: 'Frambuesa', icon: '🍓', color: '#ec4899', lightBg: '#fdf2f8', darkBg: '#fce7f3' },
  STRAWBERRY:  { name: 'Frutilla',  icon: '🍓', color: '#ef4444', lightBg: '#fef2f2', darkBg: '#fee2e2' },
  BLACKBERRY:  { name: 'Mora',      icon: '🫐', color: '#7c3aed', lightBg: '#faf5ff', darkBg: '#f3e8ff' },
  RED_CURRANTS:{ name: 'Grosella',  icon: '🔴', color: '#dc2626', lightBg: '#fef2f2', darkBg: '#fee2e2' },
  REDCURRANT:  { name: 'Grosella',  icon: '🔴', color: '#dc2626', lightBg: '#fef2f2', darkBg: '#fee2e2' }
}
const DEFAULT_THEME = { name: 'Berry', icon: '🫐', color: '#6b7280', lightBg: '#f3f4f6', darkBg: '#e5e7eb' }

function groupFields(fields) {
  const groups = {}
  fields.forEach(f => {
    const dot = f.key.indexOf('.')
    const g = dot === -1 ? '_other' : f.key.substring(0, dot)
    if (!groups[g]) groups[g] = []
    groups[g].push(f)
  })
  return groups
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function FormularioInspeccion() {
  const {
    booting, user, loading,
    assignmentData, isFromAssignment, isPreasigned,
    commodities, commodityCode, canGoPrev, canGoNext,
    fields,
    header, values, photos, headerPhotos, setHeaderPhotos,
    handleHeader, handleField, handlePhotos,
    handleSubmit, handleGoBack, changeCommodity
  } = useFormularioInspeccion()

  const theme        = COMMODITY_THEMES[commodityCode] || DEFAULT_THEME
  const groupedFields = useMemo(() => groupFields(fields), [fields])

  // ── Guards ──
  if (booting)               return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>⏳ Cargando sesión...</div>
  if (!user)                 return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Redirigiendo...</div>
  if (user.role !== 'inspector') return <div style={{ padding: 40 }}>Acceso restringido (solo inspectores)</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f0', paddingBottom: 40 }}>

      {/* ── Header sticky ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: theme.color, color: '#fff', padding: '16px 20px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>

          <button onClick={handleGoBack} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            ← Volver
          </button>

          {/* Selector de commodity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isPreasigned && (
              <button onClick={() => changeCommodity(-1)} disabled={!canGoPrev}
                style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', width: 36, height: 36, borderRadius: 8, fontSize: 18, fontWeight: 900, cursor: canGoPrev ? 'pointer' : 'not-allowed', opacity: canGoPrev ? 1 : 0.4 }}>
                ‹
              </button>
            )}
            <div style={{ background: 'rgba(255,255,255,0.95)', color: theme.color, padding: '10px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, minWidth: 200, justifyContent: 'center' }}>
              <span style={{ fontSize: 28 }}>{theme.icon}</span>
              <span style={{ fontSize: 18, fontWeight: 900 }}>{theme.name}</span>
              {isPreasigned && <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>✓ Pre-asignado</span>}
            </div>
            {!isPreasigned && (
              <button onClick={() => changeCommodity(1)} disabled={!canGoNext}
                style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', width: 36, height: 36, borderRadius: 8, fontSize: 18, fontWeight: 900, cursor: canGoNext ? 'pointer' : 'not-allowed', opacity: canGoNext ? 1 : 0.4 }}>
                ›
              </button>
            )}
          </div>

          <div style={{ fontSize: 13, opacity: 0.9 }}>{user.email}</div>
        </div>
      </div>

      {/* ── Formulario ── */}
      <form onSubmit={handleSubmit} style={{ maxWidth: 1200, margin: '20px auto', padding: '0 20px' }}>

        {/* Banner de asignación pre-cargada */}
        {isFromAssignment && assignmentData && (
          <div style={{ background: theme.lightBg, border: `2px solid ${theme.color}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <span style={{ background: theme.color, color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 900 }}>
              ✅ ASIGNACIÓN PRE-CARGADA
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 12 }}>
              {[['Productor', assignmentData.producer], ['Lote', assignmentData.lot], ['Variedad', assignmentData.variety]]
                .filter(([, v]) => v)
                .map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: theme.color, marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{val}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Cabecera */}
        <CabeceraForm
          header={header}
          headerPhotos={headerPhotos}
          onHeader={handleHeader}
          onHeaderPhotos={(key, urls) => setHeaderPhotos(prev => ({ ...prev, [key]: urls }))}
          isFromAssignment={isFromAssignment}
          theme={theme}
          loading={loading}
        />

        {/* Métricas */}
        <MetricasForm
          groupedFields={groupedFields}
          values={values}
          photos={photos}
          onField={handleField}
          onPhotos={handlePhotos}
          loading={loading}
        />

        {/* Submit sticky */}
        <div style={{ position: 'sticky', bottom: 20, background: '#fff', padding: 16, borderRadius: 16, boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', border: '2px solid #e5e7eb' }}>
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: 16, background: loading ? '#9ca3af' : theme.color, color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            {loading ? '⏳ GUARDANDO...' : '✅ GUARDAR Y FINALIZAR'}
          </button>
        </div>
      </form>
    </div>
  )
}