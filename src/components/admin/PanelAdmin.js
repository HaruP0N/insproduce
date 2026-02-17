'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import GestionInspecciones from './GestionInspecciones'

// ─── helpers ────────────────────────────────────────────────────────────────
function safeStr(v) {
  if (v === null || v === undefined) return ''
  return String(v)
}

function formatDate(dateStr) {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '--'
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

function parseKey(key) {
  if (!key) return { prefix: '', bare: key }
  const dot = key.indexOf('.')
  if (dot === -1) return { prefix: '', bare: key }
  return { prefix: key.substring(0, dot), bare: key.substring(dot + 1) }
}

function stripPrefix(key) { return parseKey(key).bare }

function humanize(str) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─── status ──────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'pendiente',  label: 'Pendiente',  emoji: '🟡', color: '#92400e', bg: '#fffbeb', bd: '#fcd34d' },
  { value: 'completada', label: 'Completada', emoji: '🟢', color: '#166534', bg: '#f0fdf4', bd: '#86efac' },
  { value: 'cancelada',  label: 'Cancelada',  emoji: '🔴', color: '#991b1b', bg: '#fff1f2', bd: '#fca5a5' },
]

function statusCfg(val) {
  return STATUS_OPTIONS.find(o => o.value === val) || STATUS_OPTIONS[0]
}

function StatusDropdown({ assignmentId, currentStatus, onChanged }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const cfg = statusCfg(currentStatus)

  const handleSelect = async (newStatus) => {
    if (newStatus === currentStatus) { setOpen(false); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.msg || 'Error al actualizar')
      onChanged()
    } catch (err) { alert('❌ ' + err.message) }
    finally { setSaving(false); setOpen(false) }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)} disabled={saving}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
          cursor: 'pointer', border: `1px solid ${cfg.bd}`,
          background: cfg.bg, color: cfg.color
        }}
      >
        {saving ? '…' : `${cfg.emoji} ${cfg.label}`}
        <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '110%', left: 0, zIndex: 999,
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
            boxShadow: '0 8px 28px rgba(0,0,0,0.12)', padding: 6, minWidth: 170
          }}>
            {STATUS_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => handleSelect(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', textAlign: 'left', padding: '9px 12px',
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: opt.value === currentStatus ? opt.bg : 'transparent',
                  color: opt.value === currentStatus ? opt.color : '#374151',
                  fontWeight: opt.value === currentStatus ? 700 : 500, fontSize: 13
                }}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Btn ──────────────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = 'primary', disabled = false, small = false, style: extra = {} }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: small ? '6px 12px' : '9px 16px',
    borderRadius: 10, fontSize: small ? 12 : 13, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
    border: '1px solid transparent',
  }
  const variants = {
    primary: { background: '#16a34a', color: '#fff', borderColor: '#15803d' },
    outline: { background: '#fff', color: '#16a34a', borderColor: '#86efac' },
    blue:    { background: '#2563eb', color: '#fff', borderColor: '#1d4ed8' },
    gray:    { background: '#6b7280', color: '#fff', borderColor: '#4b5563' },
    danger:  { background: '#dc2626', color: '#fff', borderColor: '#b91c1c' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...extra }}>
      {children}
    </button>
  )
}

// ─── Configuración de grupos de métricas ─────────────────────────────────────
const METRIC_GROUPS = {
  quality:   { label: '🔬 Calidad',   color: '#166534', bg: '#f0fdf4', bd: '#86efac', header: '#dcfce7' },
  condition: { label: '🩺 Condición', color: '#1e40af', bg: '#eff6ff', bd: '#93c5fd', header: '#dbeafe' },
  pack:      { label: '📦 Embalaje',  color: '#6d28d9', bg: '#faf5ff', bd: '#c4b5fd', header: '#ede9fe' },
}
const DEFAULT_GROUP = { label: '📋 Otros', color: '#374151', bg: '#f8fafc', bd: '#e2e8f0', header: '#f1f5f9' }

function groupMetrics(values) {
  const groups = {}
  Object.entries(values || {}).forEach(([k, v]) => {
    const { prefix } = parseKey(k)
    const g = prefix || '_other'
    if (!groups[g]) groups[g] = []
    groups[g].push([k, v])
  })
  return groups
}

// ─── Bloque visual de un grupo de métricas ───────────────────────────────────
function MetricGroup({ groupKey, entries }) {
  const cfg = METRIC_GROUPS[groupKey] || DEFAULT_GROUP
  return (
    <div style={{ borderRadius: 14, border: `1px solid ${cfg.bd}`, overflow: 'hidden', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ background: cfg.header, padding: '9px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 900, color: cfg.color, fontSize: 13 }}>{cfg.label}</span>
        <span style={{ fontSize: 11, color: cfg.color, opacity: 0.65 }}>{entries.length} campos</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: cfg.bd }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ background: cfg.bg, padding: '11px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: cfg.color, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>
              {humanize(stripPrefix(k))}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
              {safeStr(v) || <span style={{ color: '#9ca3af' }}>--</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Modal de detalle ─────────────────────────────────────────────────────────
function DetalleModal({ detail, loading, onClose, onEditHeader, onEditMetrics, onGenerarPDF, onOpenPDF }) {
  if (!detail && !loading) return null

  const metricGroups = useMemo(() => groupMetrics(detail?.metrics?.values), [detail?.metrics])

  const headerSections = [
    {
      title: '🌿 Datos generales',
      fields: [
        ['Productor', detail?.producer],
        ['Lote',      detail?.lot],
        ['Variedad',  detail?.variety],
        ['Calibre',   detail?.caliber],
      ]
    },
    {
      title: '📦 Embalaje',
      fields: [
        ['Código',      detail?.packaging_code],
        ['Tipo',        detail?.packaging_type],
        ['Fecha',       formatDate(detail?.packaging_date)],
        ['Peso neto',   detail?.net_weight ? `${detail.net_weight} kg` : null],
      ]
    },
    {
      title: '🌡️ Temperatura & Brix',
      fields: [
        ['Brix promedio',  detail?.brix_avg    != null ? `${detail.brix_avg}°` : null],
        ['Temp. agua',     detail?.temp_water   != null ? `${detail.temp_water}°C` : null],
        ['Temp. ambiente', detail?.temp_ambient != null ? `${detail.temp_ambient}°C` : null],
        ['Temp. pulpa',    detail?.temp_pulp    != null ? `${detail.temp_pulp}°C` : null],
      ]
    },
  ]

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 9999 }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '100%', maxWidth: 1020, maxHeight: '92vh', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>

        {/* header del modal */}
        <div style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)', color: '#fff', padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 10, opacity: .75, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 }}>Inspección #{detail?.id}</div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>{detail?.commodity_code} — {detail?.lot || '…'}</h3>
            {detail?.commodity_name && <div style={{ fontSize: 13, opacity: .8, marginTop: 2 }}>{detail.commodity_name}</div>}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {detail?.pdf_url
              ? <Btn onClick={onOpenPDF} style={{ background: 'rgba(255,255,255,.2)', borderColor: 'rgba(255,255,255,.4)', color: '#fff' }}>📄 Ver PDF</Btn>
              : <Btn onClick={() => onGenerarPDF(detail)} style={{ background: 'rgba(255,255,255,.2)', borderColor: 'rgba(255,255,255,.4)', color: '#fff' }}>⚙️ Generar PDF</Btn>
            }
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>✕ Cerrar</button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 22 }}>
          {loading && <div style={{ textAlign: 'center', padding: 52, color: '#9ca3af' }}>⏳ Cargando detalles…</div>}

          {!loading && detail && (<>

            {/* ── CABECERA ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0, color: '#15803d', fontSize: 14, fontWeight: 900 }}>📋 Información general</h4>
              <Btn variant="outline" small onClick={onEditHeader}>✏️ Editar</Btn>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, marginBottom: 20 }}>
              {headerSections.map(sec => (
                <div key={sec.title} style={{ background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ background: '#f1f5f9', padding: '8px 14px', fontSize: 11, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: .5 }}>{sec.title}</div>
                  <div style={{ padding: '10px 14px' }}>
                    {sec.fields.filter(([, v]) => v).length === 0
                      ? <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Sin datos</div>
                      : sec.fields.filter(([, v]) => v).map(([label, val]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{val}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              ))}
            </div>

            {/* comentarios */}
            {detail?.notes && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12, padding: '10px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#92400e', letterSpacing: .5, textTransform: 'uppercase', marginBottom: 4 }}>💬 Comentarios</div>
                <div style={{ fontSize: 14, color: '#78350f', lineHeight: 1.5 }}>{detail.notes}</div>
              </div>
            )}

            {/* ── MÉTRICAS AGRUPADAS ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0, color: '#15803d', fontSize: 14, fontWeight: 900 }}>📊 Métricas</h4>
              <Btn variant="outline" small onClick={onEditMetrics}>✏️ Editar</Btn>
            </div>

            {Object.keys(metricGroups).length === 0
              ? <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', background: '#f8fafc', borderRadius: 14, fontSize: 14 }}>Sin métricas registradas</div>
              : Object.entries(metricGroups).map(([grp, entries]) => (
                  <MetricGroup key={grp} groupKey={grp} entries={entries} />
                ))
            }

          </>)}
        </div>
      </div>
    </div>
  )
}

// ─── Tab inspecciones ────────────────────────────────────────────────────────
function InspeccionesTab() {
  const [inspecciones, setInspecciones] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [search, setSearch] = useState('')
  const [soloPendientePDF, setSoloPendientePDF] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState(null)

  const [editHeaderOpen, setEditHeaderOpen] = useState(false)
  const [headerDraft, setHeaderDraft] = useState(null)
  const [savingHeader, setSavingHeader] = useState(false)

  const [editMetricsOpen, setEditMetricsOpen] = useState(false)
  const [metricsDraft, setMetricsDraft] = useState(null)
  const [savingMetrics, setSavingMetrics] = useState(false)

  const fetchDatos = async () => {
    setLoading(true); setErrorMsg('')
    try {
      const [rInsp, rAsig] = await Promise.all([
        fetch('/api/inspecciones/historial', { credentials: 'include' }),
        fetch('/api/assignments/pendientes',  { credentials: 'include' })
      ])
      const dInsp = await rInsp.json().catch(() => null)
      const dAsig = await rAsig.json().catch(() => null)
      if (!rInsp.ok) throw new Error(dInsp?.msg || 'Error al cargar')
      setInspecciones(Array.isArray(dInsp) ? dInsp : [])
      setAsignaciones(dAsig?.asignaciones || [])
    } catch (err) { setErrorMsg(err?.message || 'Error') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchDatos() }, [])

  const pdfOk = (i) => !!i.pdf_url

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return inspecciones.filter(i => {
      const txt = !q ||
        safeStr(i.lot).toLowerCase().includes(q) ||
        safeStr(i.producer).toLowerCase().includes(q) ||
        safeStr(i.variety).toLowerCase().includes(q) ||
        safeStr(i.commodity_code).toLowerCase().includes(q)
      return txt && (!soloPendientePDF || !pdfOk(i))
    })
  }, [inspecciones, search, soloPendientePDF])

  const stats = useMemo(() => ({
    total: inspecciones.length,
    pdfPend: inspecciones.filter(i => !pdfOk(i)).length,
    asigActivas: asignaciones.filter(a => a.status !== 'completada' && a.status !== 'cancelada').length,
  }), [inspecciones, asignaciones])

  const openDetalle = async (insp) => {
    setDetailOpen(true); setDetailLoading(true); setDetail(null)
    try {
      const res = await fetch(`/api/inspecciones/${insp.id}`, { credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.msg || 'Error')
      setDetail(data)
    } catch (err) { alert(err?.message); setDetailOpen(false) }
    finally { setDetailLoading(false) }
  }

  const openEditHeader = () => {
    if (!detail) return
    setHeaderDraft({
      producer: detail.producer || '', lot: detail.lot || '',
      variety: detail.variety || '', caliber: detail.caliber || '',
      packaging_code: detail.packaging_code || '', packaging_type: detail.packaging_type || '',
      packaging_date: detail.packaging_date ? String(detail.packaging_date).slice(0,10) : ''
    })
    setEditHeaderOpen(true)
  }

  const saveHeader = async () => {
    if (!detail?.id) return; setSavingHeader(true)
    try {
      const res = await fetch(`/api/inspecciones/${detail.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(headerDraft)
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.msg || 'Error')
      await fetchDatos(); await openDetalle({ id: detail.id })
      setEditHeaderOpen(false); alert('✅ Cabecera actualizada')
    } catch (err) { alert(err?.message) }
    finally { setSavingHeader(false) }
  }

  const openEditMetrics = async () => {
    if (!detail) return
    let m = detail.metrics
    try { if (typeof m === 'string') m = JSON.parse(m) } catch { m = { values: {} } }
    
    // Cargar fields de la template para saber cuáles son selects
    let templateFields = []
    if (detail.commodity_code) {
      try {
        const res = await fetch(`/api/metric-templates/code/${detail.commodity_code}`, { credentials: 'include' })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.fields) {
          templateFields = data.fields
        }
      } catch (err) {
        console.error('Error loading template fields:', err)
      }
    }
    
    setMetricsDraft({ 
      template_id: m?.template_id ?? null, 
      values: { ...(m?.values || {}) },
      fields: templateFields  // ← NUEVO: guardar fields
    })
    setEditMetricsOpen(true)
  }

  const saveMetrics = async () => {
    if (!detail?.id) return; setSavingMetrics(true)
    try {
      const res = await fetch(`/api/inspecciones/${detail.id}/metrics`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metricsDraft)
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.msg || 'Error')
      await fetchDatos(); await openDetalle({ id: detail.id })
      setEditMetricsOpen(false); alert('✅ Métricas actualizadas')
    } catch (err) { alert(err?.message) }
    finally { setSavingMetrics(false) }
  }

  const metricsEditGroups = useMemo(() => groupMetrics(metricsDraft?.values), [metricsDraft])

  const S = {
    wrap: { maxWidth: 1240, margin: '0 auto', padding: 18 },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12, marginBottom: 20 },
    statCard: { background: '#fff', borderRadius: 16, padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' },
    card: { background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: 24 },
    cardHead: { padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 900, color: '#15803d', fontSize: 14, background: '#f8fafc' },
    tbl: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: { padding: '10px 14px', textAlign: 'left', color: '#15803d', fontSize: 11, textTransform: 'uppercase', letterSpacing: .6, borderBottom: '2px solid #e5e7eb', background: '#f8fafc' },
    td: { padding: '11px 14px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', color: '#374151' },
    modalOv: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 9999 },
    modal: { width: '100%', maxWidth: 820, maxHeight: '88vh', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column' },
    modalHead: { padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' },
    modalBody: { padding: 20, overflowY: 'auto', flex: 1 },
    modalFoot: { padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 },
    field: { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 13, color: '#111827', background: '#fff', boxSizing: 'border-box' },
  }

  if (loading) return <div style={{ padding: 52, textAlign: 'center', color: '#9ca3af' }}>⏳ Cargando…</div>
  if (errorMsg) return <div style={{ padding: 24, color: '#dc2626' }}>⚠️ {errorMsg}</div>

  return (
    <div style={S.wrap}>
      <GestionInspecciones onSyncSuccess={fetchDatos} />

      {/* stats */}
      <div style={S.statsRow}>
        {[['Total inspecciones', stats.total], ['PDF pendientes', stats.pdfPend], ['Asignaciones activas', stats.asigActivas]].map(([lbl, val]) => (
          <div key={lbl} style={S.statCard}>
            <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 6 }}>{lbl}</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#111827' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* asignaciones activas */}
      {stats.asigActivas > 0 && (
        <div style={S.card}>
          <div style={S.cardHead}>📋 Asignaciones en curso</div>
          <table style={S.tbl}>
            <thead>
              <tr>{['Fecha','Lote','Productor','Variedad','Inspector','Estado'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {asignaciones.filter(a => a.status !== 'completada' && a.status !== 'cancelada').map(a => (
                <tr key={a.id}>
                  <td style={S.td}>{new Date(a.created_at).toLocaleDateString('es-CL')}</td>
                  <td style={S.td}><strong>{a.lot}</strong></td>
                  <td style={S.td}>{a.producer}</td>
                  <td style={S.td}>{a.variety || '--'}</td>
                  <td style={S.td}>{a.inspector_name || a.inspector_email || '--'}</td>
                  <td style={S.td}>
                    <StatusDropdown assignmentId={a.id} currentStatus={a.status || 'pendiente'} onChanged={fetchDatos} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* historial */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: '#15803d', fontSize: 18, fontWeight: 900 }}>📊 Historial de Inspecciones</h2>
          <p style={{ margin: '3px 0 0', color: '#6b7280', fontSize: 13 }}>{filtered.length} de {inspecciones.length}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={{ padding: '9px 14px', borderRadius: 12, border: '1px solid #d1d5db', fontSize: 13, color: '#111827', outline: 'none', minWidth: 280 }}
            placeholder="Buscar lote, productor, variedad…" value={search} onChange={e => setSearch(e.target.value)}
          />
          <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 13, color: '#374151', cursor: 'pointer' }}>
            <input type="checkbox" checked={soloPendientePDF} onChange={e => setSoloPendientePDF(e.target.checked)} />
            Solo PDF pendiente
          </label>
          <Btn variant="outline" small onClick={fetchDatos}>↺ Refrescar</Btn>
        </div>
      </div>

      <div style={S.card}>
        <table style={S.tbl}>
          <thead>
            <tr>{['Fecha','Commodity','Lote / Productor','Variedad','PDF','Acciones'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map(insp => {
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
                      display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: ok ? '#f0fdf4' : '#fffbeb',
                      color:      ok ? '#166534' : '#92400e',
                      border: `1px solid ${ok ? '#86efac' : '#fcd34d'}`
                    }}>
                      {ok ? '✅ Generado' : '⏳ Pendiente'}
                    </span>
                  </td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn variant="outline" small onClick={() => openDetalle(insp)}>Ver</Btn>
                      {ok
                        ? <Btn variant="blue" small onClick={() => window.open(`/api/inspecciones/${insp.id}/pdf`, '_blank', 'noopener')}>📄 PDF</Btn>
                        : <Btn small onClick={async () => {
                            try {
                              const r = await fetch(`/api/inspecciones/${insp.id}/generar-pdf`, { method:'POST', credentials:'include' })
                              if (!r.ok) throw new Error((await r.json().catch(()=>({}))).msg || 'Error')
                              fetchDatos()
                            } catch(err) { alert(err.message) }
                          }}>⚙️ PDF</Btn>
                      }
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#9ca3af', padding: 36 }}>Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* modal detalle */}
      {detailOpen && (
        <DetalleModal
          detail={detail} loading={detailLoading}
          onClose={() => { setDetailOpen(false); setDetail(null) }}
          onEditHeader={openEditHeader}
          onEditMetrics={openEditMetrics}
          onGenerarPDF={async (d) => {
            try {
              const r = await fetch(`/api/inspecciones/${d.id}/generar-pdf`, { method:'POST', credentials:'include' })
              const data = await r.json().catch(() => null)
              if (!r.ok) throw new Error(data?.msg || 'Error')
              await fetchDatos(); alert('✅ PDF generado')
            } catch(err) { alert(err?.message) }
          }}
          onOpenPDF={() => detail && window.open(`/api/inspecciones/${detail.id}/pdf`, '_blank', 'noopener')}
        />
      )}

      {/* modal editar cabecera */}
      {editHeaderOpen && headerDraft && (
        <div style={S.modalOv} onMouseDown={e => e.target===e.currentTarget && setEditHeaderOpen(false)}>
          <div style={S.modal}>
            <div style={S.modalHead}>
              <h3 style={{ margin:0, color:'#15803d', fontSize:17, fontWeight:900 }}>✏️ Editar cabecera — #{detail?.id}</h3>
              <Btn variant="gray" small onClick={() => setEditHeaderOpen(false)}>✕</Btn>
            </div>
            <div style={S.modalBody}>
              <p style={{ fontSize:11, fontWeight:900, color:'#6b7280', textTransform:'uppercase', letterSpacing:.5, margin:'0 0 10px' }}>🌿 Datos generales</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12, marginBottom:20 }}>
                {[['producer','Productor'],['lot','Lote'],['variety','Variedad'],['caliber','Calibre']].map(([k,lbl]) => (
                  <div key={k}>
                    <label style={{ fontSize:11, fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>{lbl}</label>
                    <input style={S.field} value={headerDraft[k]||''} onChange={e=>setHeaderDraft(p=>({...p,[k]:e.target.value}))} />
                  </div>
                ))}
              </div>
              <p style={{ fontSize:11, fontWeight:900, color:'#6b7280', textTransform:'uppercase', letterSpacing:.5, margin:'0 0 10px' }}>📦 Embalaje</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
                {[['packaging_code','Código'],['packaging_type','Tipo']].map(([k,lbl]) => (
                  <div key={k}>
                    <label style={{ fontSize:11, fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>{lbl}</label>
                    <input style={S.field} value={headerDraft[k]||''} onChange={e=>setHeaderDraft(p=>({...p,[k]:e.target.value}))} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>Fecha embalaje</label>
                  <input type="date" style={S.field} value={headerDraft.packaging_date||''} onChange={e=>setHeaderDraft(p=>({...p,packaging_date:e.target.value}))} />
                </div>
              </div>
            </div>
            <div style={S.modalFoot}>
              <Btn variant="gray" onClick={() => setEditHeaderOpen(false)} disabled={savingHeader}>Cancelar</Btn>
              <Btn onClick={saveHeader} disabled={savingHeader}>{savingHeader ? 'Guardando…' : 'Guardar'}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* modal editar métricas */}
      {editMetricsOpen && metricsDraft && (
        <div style={S.modalOv} onMouseDown={e => e.target===e.currentTarget && setEditMetricsOpen(false)}>
          <div style={S.modal}>
            <div style={S.modalHead}>
              <h3 style={{ margin:0, color:'#15803d', fontSize:17, fontWeight:900 }}>📊 Editar métricas — #{detail?.id}</h3>
              <Btn variant="gray" small onClick={() => setEditMetricsOpen(false)}>✕</Btn>
            </div>
            <div style={S.modalBody}>
              {Object.entries(metricsEditGroups).map(([grp, entries]) => {
                const cfg = METRIC_GROUPS[grp] || DEFAULT_GROUP
                return (
                  <div key={grp} style={{ marginBottom: 22 }}>
                    <p style={{ fontSize:11, fontWeight:900, color:cfg.color, textTransform:'uppercase', letterSpacing:.5, margin:'0 0 10px' }}>{cfg.label}</p>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))', gap:10 }}>
                      {entries.map(([k]) => {
                        // Buscar el field en la template para ver si es select
                        const field = (metricsDraft.fields || []).find(f => f.key === k)
                        const isSelect = field?.field_type === 'select'
                        const options = field?.options || []
                        
                        return (
                          <div key={k}>
                            <label style={{ fontSize:10, fontWeight:800, color:cfg.color, display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:.4 }}>
                              {humanize(stripPrefix(k))}
                            </label>
                            
                            {isSelect ? (
                              <select
                                style={{ ...S.field, borderColor:cfg.bd, background:cfg.bg }}
                                value={safeStr(metricsDraft.values[k])}
                                onChange={e => setMetricsDraft(p => ({ ...p, values: { ...p.values, [k]: e.target.value } }))}
                              >
                                <option value="">-- Seleccionar --</option>
                                {options.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                style={{ ...S.field, borderColor:cfg.bd, background:cfg.bg }}
                                value={safeStr(metricsDraft.values[k])}
                                onChange={e => setMetricsDraft(p => ({ ...p, values: { ...p.values, [k]: e.target.value } }))}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {Object.keys(metricsEditGroups).length === 0 && <p style={{ color:'#9ca3af', fontSize:14 }}>No hay métricas para editar.</p>}
            </div>
            <div style={S.modalFoot}>
              <Btn variant="gray" onClick={() => setEditMetricsOpen(false)} disabled={savingMetrics}>Cancelar</Btn>
              <Btn onClick={saveMetrics} disabled={savingMetrics}>{savingMetrics ? 'Guardando…' : 'Guardar métricas'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab trabajadores ────────────────────────────────────────────────────────
function TrabajadoresTab() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [newUser, setNewUser] = useState({ name:'', email:'', password:'', role:'inspector' })
  const [editForm, setEditForm] = useState({ name:'', email:'', role:'', password:'' })
  const [saving, setSaving] = useState(false)

  const fetchUsers = async () => {
    setLoading(true); setErrorMsg('')
    try {
      const res = await fetch('/api/users', { credentials:'include' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErrorMsg(res.status===401||res.status===403 ? 'Sin permisos de admin.' : d?.msg||`Error ${res.status}`)
        setUsuarios([]); return
      }
      const data = await res.json()
      setUsuarios(Array.isArray(data) ? data.map(u=>({...u,active:Boolean(u.active)})) : [])
    } catch(err) { setErrorMsg('Error: ' + err.message); setUsuarios([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const res = await fetch('/api/users', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify(newUser) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.msg||'Error')
      alert('✅ Usuario creado'); setCreateOpen(false); setNewUser({name:'',email:'',password:'',role:'inspector'}); fetchUsers()
    } catch(err) { alert(err.message) } finally { setSaving(false) }
  }

  const handleEdit = async (e) => {
    e.preventDefault(); if (!editUser?.id) return; setSaving(true)
    try {
      const res = await fetch(`/api/users/${editUser.id}`, { method:'PUT', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify(editForm) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.msg||'Error')
      alert('✅ Actualizado'); setEditOpen(false); fetchUsers()
    } catch(err) { alert(err.message) } finally { setSaving(false) }
  }

  const toggleActive = async (u) => {
    if (!confirm(`¿${u.active?'Desactivar':'Activar'} a ${u.email}?`)) return
    try {
      const res = await fetch(`/api/users/${u.id}`, { method:'PATCH', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({active:!u.active}) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.msg)
      fetchUsers()
    } catch(err) { alert(err.message) }
  }

  const S = {
    wrap: { padding:18, maxWidth:1240, margin:'0 auto' },
    card: { background:'#fff', borderRadius:16, border:'1px solid #e5e7eb', boxShadow:'0 4px 20px rgba(0,0,0,0.06)', padding:20 },
    th: { padding:'10px 14px', textAlign:'left', borderBottom:'2px solid #e5e7eb', color:'#15803d', fontSize:11, textTransform:'uppercase', background:'#f8fafc' },
    td: { padding:'12px 14px', borderBottom:'1px solid #f1f5f9', color:'#374151' },
    modalOv: { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 },
    modal: { background:'#fff', borderRadius:16, maxWidth:500, width:'100%', boxShadow:'0 16px 48px rgba(0,0,0,0.25)' },
    modalHead: { padding:'14px 18px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center' },
    modalBody: { padding:18 },
    modalFoot: { padding:'12px 18px', borderTop:'1px solid #e5e7eb', display:'flex', justifyContent:'flex-end', gap:10 },
    label: { display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 },
    input: { width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid #d1d5db', fontSize:13, color:'#111827', background:'#fff', boxSizing:'border-box' },
    select: { width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid #d1d5db', fontSize:13, color:'#111827', background:'#fff', boxSizing:'border-box' },
  }

  if (loading) return <div style={{ padding:52, textAlign:'center', color:'#9ca3af' }}>⏳ Cargando…</div>
  if (errorMsg) return <div style={{ padding:24 }}><div style={{ padding:14, background:'#fef2f2', borderRadius:12, color:'#dc2626' }}>⚠️ {errorMsg}</div></div>

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <h2 style={{ margin:0, color:'#15803d', fontSize:20, fontWeight:900 }}>Gestión de Trabajadores</h2>
            <p style={{ margin:'4px 0 0', color:'#6b7280', fontSize:13 }}>{usuarios.length} usuarios</p>
          </div>
          <Btn onClick={() => setCreateOpen(true)}>➕ Crear usuario</Btn>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr>{['ID','Nombre','Email','Rol','Estado','Acciones'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id}>
                <td style={S.td}>{u.id}</td>
                <td style={S.td}>{u.name||'--'}</td>
                <td style={S.td}>{u.email}</td>
                <td style={S.td}><span style={{ fontWeight:700, color:u.role==='admin'?'#b45309':'#15803d' }}>{u.role==='admin'?'👑 Admin':'👷 Inspector'}</span></td>
                <td style={S.td}>
                  <span style={{ display:'inline-block', padding:'4px 10px', borderRadius:999, fontSize:11, fontWeight:700, background:u.active?'#f0fdf4':'#fef2f2', color:u.active?'#166534':'#dc2626', border:`1px solid ${u.active?'#86efac':'#fca5a5'}` }}>
                    {u.active?'✅ Activo':'❌ Inactivo'}
                  </span>
                </td>
                <td style={S.td}>
                  <div style={{ display:'flex', gap:8 }}>
                    <Btn variant="outline" small onClick={()=>{setEditUser(u);setEditForm({name:u.name||'',email:u.email||'',role:u.role||'',password:''});setEditOpen(true)}}>✏️ Editar</Btn>
                    <Btn variant={u.active?'gray':'primary'} small onClick={()=>toggleActive(u)}>{u.active?'🚫 Desactivar':'✅ Activar'}</Btn>
                  </div>
                </td>
              </tr>
            ))}
            {usuarios.length===0&&<tr><td colSpan={6} style={{...S.td,textAlign:'center',color:'#9ca3af',padding:32}}>Sin usuarios</td></tr>}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <div style={S.modalOv} onClick={e=>e.target===e.currentTarget&&setCreateOpen(false)}>
          <div style={S.modal}>
            <div style={S.modalHead}><h3 style={{margin:0,color:'#15803d',fontSize:17,fontWeight:900}}>Crear Usuario</h3><Btn variant="gray" small onClick={()=>setCreateOpen(false)}>✕</Btn></div>
            <form onSubmit={handleCreate}>
              <div style={S.modalBody}>
                {[['name','text','Nombre completo'],['email','email','Email *'],['password','password','Contraseña * (mín. 6 caracteres)']].map(([k,t,lbl])=>(
                  <div key={k} style={{marginBottom:12}}>
                    <label style={S.label}>{lbl}</label>
                    <input style={S.input} type={t} value={newUser[k]} onChange={e=>setNewUser(p=>({...p,[k]:e.target.value}))} required={k!=='name'} minLength={k==='password'?6:undefined}/>
                  </div>
                ))}
                <div style={{marginBottom:12}}>
                  <label style={S.label}>Rol</label>
                  <select style={S.select} value={newUser.role} onChange={e=>setNewUser(p=>({...p,role:e.target.value}))}>
                    <option value="inspector">Inspector</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              <div style={S.modalFoot}>
                <Btn variant="gray" onClick={()=>setCreateOpen(false)} disabled={saving}>Cancelar</Btn>
                <Btn disabled={saving}>{saving?'Creando…':'Crear'}</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {editOpen&&editUser&&(
        <div style={S.modalOv} onClick={e=>e.target===e.currentTarget&&setEditOpen(false)}>
          <div style={S.modal}>
            <div style={S.modalHead}><h3 style={{margin:0,color:'#15803d',fontSize:17,fontWeight:900}}>Editar — {editUser.email}</h3><Btn variant="gray" small onClick={()=>setEditOpen(false)}>✕</Btn></div>
            <form onSubmit={handleEdit}>
              <div style={S.modalBody}>
                {[['name','text','Nombre'],['email','email','Email'],['password','password','Nueva contraseña (opcional)']].map(([k,t,lbl])=>(
                  <div key={k} style={{marginBottom:12}}>
                    <label style={S.label}>{lbl}</label>
                    <input style={S.input} type={t} value={editForm[k]} onChange={e=>setEditForm(p=>({...p,[k]:e.target.value}))} placeholder={k==='password'?'Dejar vacío para no cambiar':undefined}/>
                  </div>
                ))}
                <div style={{marginBottom:12}}>
                  <label style={S.label}>Rol</label>
                  <select style={S.select} value={editForm.role} onChange={e=>setEditForm(p=>({...p,role:e.target.value}))}>
                    <option value="inspector">Inspector</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              <div style={S.modalFoot}>
                <Btn variant="gray" onClick={()=>setEditOpen(false)} disabled={saving}>Cancelar</Btn>
                <Btn disabled={saving}>{saving?'Guardando…':'Guardar'}</Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function PanelAdmin() {
  const router = useRouter()
  const [tab, setTab] = useState('inspecciones')
  const [loggingOut, setLoggingOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const logout = async () => {
    setLoggingOut(true)
    try { await fetch('/api/auth/logout', { method:'POST', credentials:'include' }) }
    finally { try { localStorage.removeItem('adminToken') } catch {} router.push('/login'); setLoggingOut(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f0f4f0' }}>
      <div style={{ maxWidth:1240, margin:'0 auto', padding:'16px 18px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fff', borderRadius:16, padding:'10px 16px', border:'1px solid #e5e7eb', boxShadow:'0 4px 20px rgba(0,0,0,0.06)', marginBottom:16, flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', gap:8 }}>
            {[['inspecciones','📋 Inspecciones'],['trabajadores','👥 Trabajadores']].map(([val,lbl]) => (
              <button key={val} onClick={() => setTab(val)} style={{
                padding:'9px 16px', borderRadius:12, cursor:'pointer', border:'1px solid',
                borderColor: tab===val?'#16a34a':'#e5e7eb',
                background:  tab===val?'#f0fdf4':'#fff',
                color:       tab===val?'#15803d':'#374151',
                fontWeight:900, fontSize:13
              }}>{lbl}</button>
            ))}
          </div>
          <div style={{ position:'relative' }}>
            <button onClick={() => setMenuOpen(o=>!o)} style={{ width:40, height:40, borderRadius:'50%', background:'#fef9c3', border:'1px solid #fcd34d', cursor:'pointer', fontSize:17, fontWeight:900, color:'#92400e' }}>A</button>
            {menuOpen && (
              <>
                <div style={{ position:'fixed', inset:0, zIndex:998 }} onClick={() => setMenuOpen(false)} />
                <div style={{ position:'absolute', top:48, right:0, zIndex:999, background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, boxShadow:'0 8px 28px rgba(0,0,0,0.12)', minWidth:190, padding:6 }}>
                  <div style={{ padding:'8px 14px', fontSize:12, color:'#9ca3af', borderBottom:'1px solid #f1f5f9', marginBottom:4 }}>Admin</div>
                  <button onClick={logout} disabled={loggingOut} style={{ display:'flex', width:'100%', padding:'9px 14px', borderRadius:8, border:'none', background:'transparent', color:'#dc2626', fontWeight:700, fontSize:13, cursor:'pointer', gap:8, alignItems:'center' }}>
                    {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        {tab==='inspecciones' ? <InspeccionesTab /> : <TrabajadoresTab />}
      </div>
    </div>
  )
}