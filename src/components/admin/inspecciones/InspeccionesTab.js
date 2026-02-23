'use client'

import { useState, useMemo } from 'react'
import { safeStr } from '@/lib/admin'
import GestionInspecciones from '../GestionInspecciones'
import StatsCards           from './StatsCards'
import AsignacionesEnCurso  from './AsignacionesEnCurso'
import HistorialInspecciones from './HistorialInspecciones'
import DetalleModal         from './DetalleModal'
import EditarCabeceraModal  from './EditarCabeceraModal'
import EditarMetricasModal  from './EditarMetricasModal'
import { useInspecciones, useInspeccionDetalle } from './useInspecciones'

// ─── InspeccionesTab ──────────────────────────────────────────────────────────

export default function InspeccionesTab() {
  // ── Datos ──
  const { inspecciones, asignaciones, loading, error, refetch } = useInspecciones()
  const { detail, loading: detailLoading, open: detailOpen, openDetalle, closeDetalle } = useInspeccionDetalle()

  // ── Filtros ──
  const [search, setSearch]         = useState('')
  const [soloPDF, setSoloPDF]       = useState(false)

  // ── Estado: editar cabecera ──
  const [editHeaderOpen, setEditHeaderOpen] = useState(false)
  const [headerDraft, setHeaderDraft]       = useState(null)
  const [savingHeader, setSavingHeader]     = useState(false)

  // ── Estado: editar métricas ──
  const [editMetricsOpen, setEditMetricsOpen] = useState(false)
  const [metricsDraft, setMetricsDraft]       = useState(null)
  const [savingMetrics, setSavingMetrics]     = useState(false)

  // ── Stats ──
  const stats = useMemo(() => ({
    total:       inspecciones.length,
    pdfPend:     inspecciones.filter(i => !i.pdf_url).length,
    asigActivas: asignaciones.filter(a => a.status !== 'completada' && a.status !== 'cancelada').length
  }), [inspecciones, asignaciones])

  // ── Filtrado historial ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return inspecciones.filter(i => {
      const txt = !q
        || safeStr(i.lot).toLowerCase().includes(q)
        || safeStr(i.producer).toLowerCase().includes(q)
        || safeStr(i.variety).toLowerCase().includes(q)
        || safeStr(i.commodity_code).toLowerCase().includes(q)
      return txt && (!soloPDF || !i.pdf_url)
    })
  }, [inspecciones, search, soloPDF])

  // ── Handlers: cabecera ──
  const openEditHeader = () => {
    if (!detail) return
    setHeaderDraft({
      producer:       detail.producer       || '',
      lot:            detail.lot            || '',
      variety:        detail.variety        || '',
      caliber:        detail.caliber        || '',
      packaging_code: detail.packaging_code || '',
      packaging_type: detail.packaging_type || '',
      packaging_date: detail.packaging_date ? String(detail.packaging_date).slice(0, 10) : ''
    })
    setEditHeaderOpen(true)
  }

  const saveHeader = async () => {
    if (!detail?.id) return
    setSavingHeader(true)
    try {
      const res  = await fetch(`/api/inspecciones/${detail.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(headerDraft)
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.msg || 'Error')
      await refetch()
      await openDetalle({ id: detail.id })
      setEditHeaderOpen(false)
      alert('✅ Cabecera actualizada')
    } catch (err) {
      alert(err?.message)
    } finally {
      setSavingHeader(false)
    }
  }

  // ── Handlers: métricas ──
  const openEditMetrics = async () => {
    if (!detail) return
    let m = detail.metrics
    try { if (typeof m === 'string') m = JSON.parse(m) } catch { m = { values: {} } }

    let templateFields = []
    if (detail.commodity_code) {
      try {
        const res  = await fetch(`/api/metric-templates/code/${detail.commodity_code}`, { credentials: 'include' })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.fields) templateFields = data.fields
      } catch (err) {
        console.error('Error loading template fields:', err)
      }
    }
    setMetricsDraft({ template_id: m?.template_id ?? null, values: { ...(m?.values || {}) }, fields: templateFields })
    setEditMetricsOpen(true)
  }

  const saveMetrics = async () => {
    if (!detail?.id) return
    setSavingMetrics(true)
    try {
      const res  = await fetch(`/api/inspecciones/${detail.id}/metrics`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metricsDraft)
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.msg || 'Error')
      await refetch()
      await openDetalle({ id: detail.id })
      setEditMetricsOpen(false)
      alert('✅ Métricas actualizadas')
    } catch (err) {
      alert(err?.message)
    } finally {
      setSavingMetrics(false)
    }
  }

  // ── Handler: generar PDF ──
  const handleGenerarPDF = async (insp) => {
    try {
      const r    = await fetch(`/api/inspecciones/${insp.id}/generar-pdf`, { method: 'POST', credentials: 'include' })
      const data = await r.json().catch(() => null)
      if (!r.ok) throw new Error(data?.msg || 'Error')
      await refetch()
      alert('✅ PDF generado')
    } catch (err) {
      alert(err?.message)
    }
  }

  // ── Render ──
  if (loading) return <div style={{ padding: 52, textAlign: 'center', color: '#9ca3af' }}>⏳ Cargando…</div>
  if (error)   return <div style={{ padding: 24, color: '#dc2626' }}>⚠️ {error}</div>

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: 18 }}>

      {/* 1. Google Sheets — primero porque el cliente lo usa para asignar */}
      <GestionInspecciones onSyncSuccess={refetch} />

      {/* 2. Stats */}
      <StatsCards
        total={stats.total}
        pdfPend={stats.pdfPend}
        asigActivas={stats.asigActivas}
      />

      {/* 3. Asignaciones activas */}
      <AsignacionesEnCurso
        asignaciones={asignaciones}
        onChanged={refetch}
      />

      {/* 4. Historial */}
      <HistorialInspecciones
        inspecciones={filtered}
        total={inspecciones.length}
        search={search}         onSearch={setSearch}
        soloPDF={soloPDF}       onSoloPDF={setSoloPDF}
        onRefresh={refetch}
        onVerDetalle={openDetalle}
        onGenerarPDF={handleGenerarPDF}
      />

      {/* ── Modales ── */}
      {detailOpen && (
        <DetalleModal
          detail={detail}
          loading={detailLoading}
          onClose={closeDetalle}
          onEditHeader={openEditHeader}
          onEditMetrics={openEditMetrics}
          onGenerarPDF={handleGenerarPDF}
          onOpenPDF={() => detail && window.open(`/api/inspecciones/${detail.id}/pdf`, '_blank', 'noopener')}
        />
      )}

      {editHeaderOpen && (
        <EditarCabeceraModal
          inspId={detail?.id}
          draft={headerDraft}
          onChange={setHeaderDraft}
          onSave={saveHeader}
          onClose={() => setEditHeaderOpen(false)}
          saving={savingHeader}
        />
      )}

      {editMetricsOpen && (
        <EditarMetricasModal
          inspId={detail?.id}
          draft={metricsDraft}
          onChange={setMetricsDraft}
          onSave={saveMetrics}
          onClose={() => setEditMetricsOpen(false)}
          saving={savingMetrics}
        />
      )}
    </div>
  )
}