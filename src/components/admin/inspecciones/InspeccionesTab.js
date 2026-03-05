'use client'

import { useState, useMemo } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { safeStr } from '@/lib/admin'
import GestionInspecciones   from '../GestionInspecciones'
import StatsCards             from './StatsCards'
import AsignacionesEnCurso    from './AsignacionesEnCurso'
import HistorialInspecciones  from './HistorialInspecciones'
import DetalleModal           from './DetalleModal'
import EditarCabeceraModal    from './EditarCabeceraModal'
import EditarMetricasModal    from './EditarMetricasModal'
import { useInspecciones, useInspeccionDetalle } from './useInspecciones'

export default function InspeccionesTab() {
  const { inspecciones, asignaciones, loading, error, refetch } = useInspecciones()
  const { detail, loading: detailLoading, open: detailOpen, openDetalle, closeDetalle } = useInspeccionDetalle()

  const [search, setSearch]   = useState('')
  const [soloPDF, setSoloPDF] = useState(false)

  const [editHeaderOpen, setEditHeaderOpen] = useState(false)
  const [headerDraft, setHeaderDraft]       = useState(null)
  const [savingHeader, setSavingHeader]     = useState(false)

  const [editMetricsOpen, setEditMetricsOpen] = useState(false)
  const [metricsDraft, setMetricsDraft]       = useState(null)
  const [savingMetrics, setSavingMetrics]     = useState(false)

  const stats = useMemo(() => ({
    total:       inspecciones.length,
    pdfPend:     inspecciones.filter(i => !i.pdf_url).length,
    asigActivas: asignaciones.filter(a => a.status !== 'completada' && a.status !== 'cancelada').length
  }), [inspecciones, asignaciones])

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

  // ── Handlers cabecera ──
  const openEditHeader = () => {
    if (!detail) return
    setHeaderDraft({
      producer:       detail.producer       || '',
      lot:            detail.lot            || '',
      variety:        detail.variety        || '',
      caliber:        detail.caliber        || '',
      packaging_code: detail.packaging_code || '',
      packaging_type: detail.packaging_type || '',
      packaging_date: detail.packaging_date ? String(detail.packaging_date).slice(0, 10) : '',
      net_weight:     detail.net_weight     ?? '',
      brix_avg:       detail.brix_avg       ?? '',
      brix_min:       detail.brix_min       ?? '',
      brix_max:       detail.brix_max       ?? '',
      brix_moda:      detail.brix_moda      ?? '',
      temp_water:     detail.temp_water     ?? '',
      temp_ambient:   detail.temp_ambient   ?? '',
      temp_pulp:      detail.temp_pulp      ?? '',
      diameter_min:   detail.diameter_min   ?? '',
      diameter_max:   detail.diameter_max   ?? '',
      notes:          detail.notes          || ''
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
      alert('Cabecera actualizada')
    } catch (err) { alert(err?.message) }
    finally { setSavingHeader(false) }
  }

  // ── Handlers métricas ──
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
      } catch (err) { console.error('Error loading template fields:', err) }
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
      alert('Métricas actualizadas')
    } catch (err) { alert(err?.message) }
    finally { setSavingMetrics(false) }
  }

  const handleGenerarPDF = async (insp) => {
    try {
      const r    = await fetch(`/api/inspecciones/${insp.id}/generar-pdf`, { method: 'POST', credentials: 'include' })
      const data = await r.json().catch(() => null)
      if (!r.ok) throw new Error(data?.msg || 'Error')
      await refetch()
      alert('PDF generado')
    } catch (err) { alert(err?.message) }
  }

  if (loading) return (
    <div style={{ padding: 52, textAlign: 'center', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Loader2 size={16} /> Cargando…
    </div>
  )
  if (error) return (
    <div style={{ padding: 24, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 7 }}>
      <AlertCircle size={16} /> {error}
    </div>
  )

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: 18 }}>

      <GestionInspecciones onSyncSuccess={refetch} />

      <StatsCards total={stats.total} pdfPend={stats.pdfPend} asigActivas={stats.asigActivas} />

      <AsignacionesEnCurso asignaciones={asignaciones} onChanged={refetch} />

      <HistorialInspecciones
        inspecciones={filtered} total={inspecciones.length}
        search={search}   onSearch={setSearch}
        soloPDF={soloPDF} onSoloPDF={setSoloPDF}
        onRefresh={refetch}
        onVerDetalle={openDetalle}
        onGenerarPDF={handleGenerarPDF}
      />

      {detailOpen && (
        <DetalleModal
          detail={detail} loading={detailLoading}
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