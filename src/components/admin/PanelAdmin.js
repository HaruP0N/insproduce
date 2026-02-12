'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

/** Helpers */
function safeStr(v) {
  if (v === null || v === undefined) return ''
  return String(v)
}

function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '--'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function getMetricValue(metrics, key) {
  if (!metrics) return ''
  let m = metrics
  try {
    if (typeof m === 'string') m = JSON.parse(m)
  } catch {
    return ''
  }
  const values = m?.values || {}
  return values?.[key] ?? ''
}

/** =========================
 *  TAB: INSPECCIONES
 *  ========================= */
function InspeccionesTab() {
  const router = useRouter()

  const [inspecciones, setInspecciones] = useState([])
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
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/inspecciones/historial', {
        method: 'GET',
        credentials: 'include'
      })
      const data = await res.json().catch(() => null)

      if (!res.ok) throw new Error(data?.msg || 'Error al cargar historial')
      setInspecciones(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setErrorMsg(err?.message || 'Error al cargar historial')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDatos()
  }, [])

  const pdfEstaOk = (i) => !!i.pdf_url

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return inspecciones.filter((i) => {
      const matchText =
        !q ||
        safeStr(i.lot || i.lote).toLowerCase().includes(q) ||
        safeStr(i.producer || i.productor).toLowerCase().includes(q) ||
        safeStr(i.variety || i.variedad).toLowerCase().includes(q) ||
        safeStr(i.commodity_code).toLowerCase().includes(q)

      const matchPDF = !soloPendientePDF || !pdfEstaOk(i)
      return matchText && matchPDF
    })
  }, [inspecciones, search, soloPendientePDF])

  const metricas = useMemo(() => {
    const total = inspecciones.length
    const pdfPendientes = inspecciones.filter((i) => !pdfEstaOk(i)).length

    const brixValues = inspecciones
      .map((i) => Number(String(getMetricValue(i.metrics, 'general.brix')).replace(',', '.')))
      .filter((n) => Number.isFinite(n))
    const brixPromedio = brixValues.length
      ? (brixValues.reduce((a, b) => a + b, 0) / brixValues.length).toFixed(1)
      : '--'

    return { total, pdfPendientes, brixPromedio }
  }, [inspecciones])

  const openPdf = (insp) => {
    if (!insp?.pdf_url) return
    window.open(`/api/inspecciones/${insp.id}/pdf`, '_blank', 'noopener,noreferrer')
  }

  const generarPDF = async (insp) => {
    if (!insp?.id) return
    try {
      const res = await fetch(`/api/inspecciones/${insp.id}/generar-pdf`, {
        method: 'POST',
        credentials: 'include'
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.msg || 'Error al generar PDF')
      await fetchDatos()
      alert('✅ PDF generado')
    } catch (err) {
      console.error(err)
      alert(err?.message || 'Error al generar PDF')
    }
  }

  const openDetalle = async (insp) => {
    if (!insp?.id) return
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)

    try {
      const res = await fetch(`/api/inspecciones/${insp.id}`, {
        method: 'GET',
        credentials: 'include'
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.msg || 'Error al cargar detalle')
      setDetail(data)
    } catch (err) {
      console.error(err)
      alert(err?.message || 'Error al cargar detalle')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetalle = () => {
    setDetailOpen(false)
    setDetail(null)
  }

  const openEditHeader = () => {
    if (!detail) return
    setHeaderDraft({
      producer: detail.producer || '',
      lot: detail.lot || '',
      variety: detail.variety || '',
      caliber: detail.caliber || '',
      packaging_code: detail.packaging_code || '',
      packaging_type: detail.packaging_type || '',
      packaging_date: detail.packaging_date ? String(detail.packaging_date).slice(0, 10) : ''
    })
    setEditHeaderOpen(true)
  }

  const closeEditHeader = () => {
    setEditHeaderOpen(false)
    setHeaderDraft(null)
    setSavingHeader(false)
  }

  const saveHeader = async () => {
    if (!detail?.id) return
    setSavingHeader(true)
    try {
      const res = await fetch(`/api/inspecciones/${detail.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producer: headerDraft.producer || null,
          lot: headerDraft.lot || null,
          variety: headerDraft.variety || null,
          caliber: headerDraft.caliber || null,
          packaging_code: headerDraft.packaging_code || null,
          packaging_type: headerDraft.packaging_type || null,
          packaging_date: headerDraft.packaging_date || null
        })
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.msg || 'Error al guardar cabecera')

      await fetchDatos()
      await openDetalle({ id: detail.id })
      setEditHeaderOpen(false)
      alert('✅ Cabecera actualizada')
    } catch (err) {
      console.error(err)
      alert(err?.message || 'Error al guardar cabecera')
    } finally {
      setSavingHeader(false)
    }
  }

  const openEditMetrics = () => {
    if (!detail) return
    
    let m = detail.metrics
    
    // 🔧 FIX: Parsear correctamente
    try {
      if (typeof m === 'string') {
        m = JSON.parse(m)
      }
    } catch {
      m = { values: {} }
    }

    // 🔧 Asegurar que values existe
    const values = m?.values || {}

    setMetricsDraft({
      template_id: m?.template_id ?? null,
      template_version: m?.template_version ?? null,
      values: { ...values }
    })
    
    setEditMetricsOpen(true)
  }

  const closeEditMetrics = () => {
    setEditMetricsOpen(false)
    setMetricsDraft(null)
    setSavingMetrics(false)
  }

  const updateMetric = (key, value) => {
    setMetricsDraft((prev) => ({
      ...prev,
      values: { ...(prev?.values || {}), [key]: value }
    }))
  }

  const saveMetrics = async () => {
    if (!detail?.id) return
    setSavingMetrics(true)

    try {
      const res = await fetch(`/api/inspecciones/${detail.id}/metrics`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: metricsDraft.template_id,
          template_version: metricsDraft.template_version,
          values: metricsDraft.values
        })
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.msg || 'Error al guardar métricas')

      await fetchDatos()
      await openDetalle({ id: detail.id })
      setEditMetricsOpen(false)
      alert('✅ Métricas actualizadas')
    } catch (err) {
      console.error(err)
      alert(err?.message || 'Error al guardar métricas')
    } finally {
      setSavingMetrics(false)
    }
  }

  const styles = {
    container: { maxWidth: 1240, margin: '0 auto', padding: 18 },
    topRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 14,
      flexWrap: 'wrap'
    },
    title: { margin: 0, color: '#2E7D32', fontSize: 22, fontWeight: 900 },
    subtitle: { margin: '6px 0 0', color: '#667085', fontSize: 14 },

    filtersRow: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
    input: {
      padding: '10px 12px',
      borderRadius: 12,
      border: '1px solid #e5e7eb',
      minWidth: 320,
      outline: 'none',
      background: '#fff',
      color: '#111827'
    },
    checkbox: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#374151' },

    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: 12,
      marginBottom: 16
    },
    statCard: {
      background: '#fff',
      borderRadius: 16,
      padding: 16,
      border: '1px solid #eef2f7',
      boxShadow: '0 2px 14px rgba(16,24,40,0.06)'
    },
    statLabel: { color: '#667085', fontSize: 12, marginBottom: 6 },
    statValue: { fontSize: 28, fontWeight: 900, color: '#111827' },

    tableWrap: {
      background: '#fff',
      borderRadius: 16,
      border: '1px solid #eef2f7',
      boxShadow: '0 4px 22px rgba(16,24,40,0.08)',
      overflow: 'hidden'
    },
    tableHeader: {
      padding: 14,
      borderBottom: '1px solid #eef2f7',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      color: '#2E7D32',
      fontWeight: 900
    },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, color: '#111827' },
    th: {
      background: '#f8fafc',
      padding: 12,
      textAlign: 'left',
      color: '#2E7D32',
      borderBottom: '2px solid #eef2f7',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.6
    },
    td: { padding: 12, borderBottom: '1px solid #eef2f7', verticalAlign: 'top' },

    badge: (kind) => {
      const map = {
        pdfOk: { bg: '#e8f5e9', fg: '#2E7D32', bd: '#a7d7ad' },
        pdfPend: { bg: '#fff7ed', fg: '#c2410c', bd: '#fed7aa' }
      }
      const c = map[kind] || { bg: '#eee', fg: '#333', bd: '#ddd' }
      return {
        display: 'inline-block',
        padding: '5px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.bd}`
      }
    },

    btn: (variant) => {
      const base = {
        borderRadius: 12,
        padding: '10px 12px',
        fontSize: 12,
        fontWeight: 900,
        cursor: 'pointer',
        border: '1px solid transparent',
        display: 'inline-flex',
        gap: 8,
        alignItems: 'center'
      }
      if (variant === 'outline')
        return { ...base, background: '#fff', borderColor: '#2E7D32', color: '#2E7D32' }
      if (variant === 'blue') return { ...base, background: '#1565c0', color: '#fff' }
      if (variant === 'gray') return { ...base, background: '#64748b', color: '#fff' }
      if (variant === 'danger') return { ...base, background: '#c62828', color: '#fff' }
      return { ...base, background: '#2E7D32', color: '#fff' }
    },

    modalOverlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      zIndex: 9999
    },
    modal: {
      width: '100%',
      maxWidth: 980,
      maxHeight: '86vh',
      background: '#fff',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 14px 40px rgba(0,0,0,0.25)',
      display: 'flex',
      flexDirection: 'column'
    },
    modalHeader: {
      padding: 14,
      borderBottom: '1px solid #eef2f7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: '#fff'
    },
    modalTitle: { margin: 0, color: '#2E7D32', fontSize: 18, fontWeight: 900 },
    modalBody: { padding: 14, overflowY: 'auto', flex: 1, color: '#111827' },
    modalFooter: {
      padding: 14,
      borderTop: '1px solid #eef2f7',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10,
      flexWrap: 'wrap',
      background: '#fff'
    },

    sectionTitle: { marginTop: 10, marginBottom: 10, color: '#2E7D32', fontWeight: 900 },
    kvTable: { width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#111827' },
    kvTh: {
      textAlign: 'left',
      padding: 10,
      borderBottom: '1px solid #eef2f7',
      color: '#2E7D32',
      fontSize: 11,
      textTransform: 'uppercase'
    },
    kvTd: { padding: 10, borderBottom: '1px solid #eef2f7' },
    keyCode: {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 12
    },
    field: { 
      width: '100%', 
      padding: 10, 
      borderRadius: 12, 
      border: '1px solid #e5e7eb',
      backgroundColor: '#ffffff',
      color: '#111827'
    }
  }

  if (loading) return <div style={{ padding: 30, textAlign: 'center' }}>Cargando panel…</div>
  if (errorMsg) return <div style={{ padding: 30, color: '#c62828' }}>{errorMsg}</div>

  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <div>
          <h2 style={styles.title}>Panel Administrativo — Inspecciones</h2>
          <p style={styles.subtitle}>Historial, detalle, edición de cabecera y métricas</p>
        </div>

        <div style={styles.filtersRow}>
          <input
            style={styles.input}
            placeholder="Buscar por lote, productor, variedad, commodity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={soloPendientePDF}
              onChange={(e) => setSoloPendientePDF(e.target.checked)}
            />
            Solo PDF pendiente
          </label>

          <button style={styles.btn('outline')} onClick={fetchDatos}>
            Refrescar
          </button>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total inspecciones</div>
          <div style={styles.statValue}>{metricas.total}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Brix Promedio (metrics)</div>
          <div style={styles.statValue}>
            {metricas.brixPromedio === '--' ? '--' : `${metricas.brixPromedio}°`}
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>PDF pendientes</div>
          <div style={styles.statValue}>{metricas.pdfPendientes}</div>
        </div>
      </div>

      <div style={styles.tableWrap}>
        <div style={styles.tableHeader}>Historial de Inspecciones</div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Fecha</th>
              <th style={styles.th}>Commodity</th>
              <th style={styles.th}>Lote / Productor</th>
              <th style={styles.th}>Variedad</th>
              <th style={styles.th}>Brix</th>
              <th style={styles.th}>PDF</th>
              <th style={styles.th}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((insp) => {
              const pdfOk = pdfEstaOk(insp)
              const brix = getMetricValue(insp.metrics, 'general.brix')

              return (
                <tr key={insp.id}>
                  <td style={styles.td}>{formatDateDDMMYYYY(insp.created_at)}</td>

                  <td style={styles.td}>
                    <strong>{insp.commodity_code || '--'}</strong>
                    <br />
                    <span style={{ fontSize: 12, color: '#667085' }}>{insp.commodity_name || ''}</span>
                  </td>

                  <td style={styles.td}>
                    <strong>{insp.lot || '--'}</strong>
                    <br />
                    <span style={{ fontSize: 12, color: '#667085' }}>{insp.producer || '--'}</span>
                  </td>

                  <td style={styles.td}>{insp.variety || '--'}</td>
                  <td style={styles.td}>{safeStr(brix) ? `${brix}°` : '--'}</td>

                  <td style={styles.td}>
                    <span style={styles.badge(pdfOk ? 'pdfOk' : 'pdfPend')}>
                      {pdfOk ? '✅ PDF GENERADO' : '⏳ PDF PENDIENTE'}
                    </span>
                  </td>

                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button style={styles.btn('outline')} onClick={() => openDetalle(insp)}>
                        Detalle
                      </button>

                      {!pdfOk ? (
                        <button style={styles.btn()} onClick={() => generarPDF(insp)}>
                          Generar PDF
                        </button>
                      ) : (
                        <button style={styles.btn('blue')} onClick={() => openPdf(insp)}>
                          Ver PDF
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}

            {filtered.length === 0 && (
              <tr>
                <td style={styles.td} colSpan={7}>
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DETALLE */}
      {detailOpen && (
        <div style={styles.modalOverlay} onMouseDown={(e) => e.target === e.currentTarget && closeDetalle()}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Detalle Inspección — ID {detail?.id || ''}</h3>
                <div style={{ fontSize: 12, color: '#667085', marginTop: 4 }}>
                  {detail?.commodity_code ? `${detail.commodity_code} • ${detail.commodity_name || ''}` : 'Cargando...'}
                </div>
              </div>

              <button style={styles.btn('gray')} onClick={closeDetalle}>
                Cerrar
              </button>
            </div>

            <div style={styles.modalBody}>
              {detailLoading && <div style={{ padding: 10 }}>Cargando detalle...</div>}

              {!detailLoading && detail && (
                <>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                    <button style={styles.btn()} onClick={openEditHeader}>
                      Editar cabecera
                    </button>

                    <button style={styles.btn()} onClick={openEditMetrics}>
                      Editar métricas
                    </button>

                    {detail.pdf_url ? (
                      <button style={styles.btn('blue')} onClick={() => openPdf(detail)}>
                        Ver PDF
                      </button>
                    ) : (
                      <button style={styles.btn()} onClick={() => generarPDF(detail)}>
                        Generar PDF
                      </button>
                    )}
                  </div>

                  <div style={styles.sectionTitle}>Cabecera</div>
                  <table style={styles.kvTable}>
                    <thead>
                      <tr>
                        <th style={styles.kvTh}>Campo</th>
                        <th style={styles.kvTh}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Productor', detail.producer],
                        ['Lote', detail.lot],
                        ['Variedad', detail.variety],
                        ['Calibre', detail.caliber],
                        ['Código Embalaje', detail.packaging_code],
                        ['Tipo Embalaje', detail.packaging_type],
                        ['Fecha Embalaje', formatDateDDMMYYYY(detail.packaging_date)]
                      ].map(([k, v]) => (
                        <tr key={k}>
                          <td style={styles.kvTd}>
                            <strong>{k}</strong>
                          </td>
                          <td style={styles.kvTd}>{v || '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={styles.sectionTitle}>Métricas (metrics.values)</div>
                  <table style={styles.kvTable}>
                    <thead>
                      <tr>
                        <th style={styles.kvTh}>Key</th>
                        <th style={styles.kvTh}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(detail.metrics?.values || {}).map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ ...styles.kvTd, ...styles.keyCode }}>{k}</td>
                          <td style={styles.kvTd}>{safeStr(v)}</td>
                        </tr>
                      ))}
                      {Object.keys(detail.metrics?.values || {}).length === 0 && (
                        <tr>
                          <td style={styles.kvTd} colSpan={2}>
                            Sin métricas registradas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button style={styles.btn('gray')} onClick={closeDetalle}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR CABECERA */}
      {editHeaderOpen && headerDraft && (
        <div style={styles.modalOverlay} onMouseDown={(e) => e.target === e.currentTarget && closeEditHeader()}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Editar cabecera — ID {detail?.id}</h3>
              <button style={styles.btn('gray')} onClick={closeEditHeader}>
                Cerrar
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {[
                  ['producer', 'Productor'],
                  ['lot', 'Lote'],
                  ['variety', 'Variedad'],
                  ['caliber', 'Calibre'],
                  ['packaging_code', 'Cod. Embalaje'],
                  ['packaging_type', 'Tipo Embalaje']
                ].map(([k, label]) => (
                  <div key={k}>
                    <label style={{ fontSize: 11, fontWeight: 900, color: '#667085' }}>{label}</label>
                    <input
                      style={styles.field}
                      value={headerDraft[k] || ''}
                      onChange={(e) => setHeaderDraft((prev) => ({ ...prev, [k]: e.target.value }))}
                    />
                  </div>
                ))}

                <div>
                  <label style={{ fontSize: 11, fontWeight: 900, color: '#667085' }}>Fecha Embalaje</label>
                  <input
                    type="date"
                    style={styles.field}
                    value={headerDraft.packaging_date || ''}
                    onChange={(e) => setHeaderDraft((prev) => ({ ...prev, packaging_date: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button style={styles.btn('gray')} onClick={closeEditHeader} disabled={savingHeader}>
                Cancelar
              </button>
              <button style={styles.btn()} onClick={saveHeader} disabled={savingHeader}>
                {savingHeader ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR METRICAS */}
      {editMetricsOpen && metricsDraft && (
        <div style={styles.modalOverlay} onMouseDown={(e) => e.target === e.currentTarget && closeEditMetrics()}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Editar métricas — ID {detail?.id}</h3>
              <button style={styles.btn('gray')} onClick={closeEditMetrics}>
                Cerrar
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={{ color: '#667085', fontSize: 13, marginBottom: 10 }}>
                Editas las keys de <b>metrics.values</b> y luego guardas.
              </div>

              <table style={styles.kvTable}>
                <thead>
                  <tr>
                    <th style={styles.kvTh}>Key</th>
                    <th style={styles.kvTh}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(metricsDraft.values || {}).map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ ...styles.kvTd, ...styles.keyCode }}>{k}</td>
                      <td style={styles.kvTd}>
                        <input
                          style={styles.field}
                          value={safeStr(v)}
                          onChange={(e) => updateMetric(k, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}

                  {Object.keys(metricsDraft.values || {}).length === 0 && (
                    <tr>
                      <td style={styles.kvTd} colSpan={2}>
                        No hay keys en metrics.values para editar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={styles.modalFooter}>
              <button style={styles.btn('gray')} onClick={closeEditMetrics} disabled={savingMetrics}>
                Cancelar
              </button>
              <button style={styles.btn()} onClick={saveMetrics} disabled={savingMetrics}>
                {savingMetrics ? 'Guardando...' : 'Guardar métricas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** =========================
 *  TAB: TRABAJADORES
 *  ========================= */
function TrabajadoresTab() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Modales
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  
  // Form crear
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'inspector'
  })
  
  // Form editar
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: '',
    password: ''
  })

  const [saving, setSaving] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users', { credentials: 'include' })
      const data = await res.json().catch(() => [])
      setUsuarios(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })
      
      const data = await res.json()
      
      if (!res.ok) throw new Error(data?.msg || 'Error al crear usuario')
      
      alert('✅ Usuario creado exitosamente')
      setCreateOpen(false)
      setNewUser({ name: '', email: '', password: '', role: 'inspector' })
      await fetchUsers()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (user) => {
    setEditUser(user)
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      role: user.role || '',
      password: ''
    })
    setEditOpen(true)
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    if (!editUser?.id) return
    
    setSaving(true)
    
    try {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      
      const data = await res.json()
      
      if (!res.ok) throw new Error(data?.msg || 'Error al actualizar')
      
      alert('✅ Usuario actualizado')
      setEditOpen(false)
      await fetchUsers()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (user) => {
    if (!confirm(`¿${user.active ? 'Desactivar' : 'Activar'} usuario ${user.email}?`)) return
    
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !user.active })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data?.msg)
      
      alert(`✅ ${data.msg}`)
      await fetchUsers()
    } catch (err) {
      alert(err.message)
    }
  }

  const styles = {
    container: { padding: 18, maxWidth: 1240, margin: '0 auto' },
    card: {
      background: '#fff',
      borderRadius: 16,
      border: '1px solid #eef2f7',
      boxShadow: '0 4px 22px rgba(16,24,40,0.08)',
      padding: 18
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14
    },
    title: { margin: 0, color: '#2E7D32' },
    btn: (variant = 'primary') => {
      const base = {
        borderRadius: 12,
        padding: '10px 14px',
        fontSize: 13,
        fontWeight: 900,
        cursor: 'pointer',
        border: '1px solid transparent',
        display: 'inline-flex',
        gap: 6,
        alignItems: 'center'
      }
      if (variant === 'primary') return { ...base, background: '#2E7D32', color: '#fff' }
      if (variant === 'gray') return { ...base, background: '#64748b', color: '#fff' }
      if (variant === 'danger') return { ...base, background: '#c62828', color: '#fff' }
      if (variant === 'outline') return { ...base, background: '#fff', border: '1px solid #2E7D32', color: '#2E7D32' }
      return base
    },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, marginTop: 14 },
    th: {
      padding: 12,
      textAlign: 'left',
      borderBottom: '2px solid #eef2f7',
      color: '#2E7D32',
      fontSize: 11,
      textTransform: 'uppercase'
    },
    td: { padding: 12, borderBottom: '1px solid #eef2f7' },
    
    modalOverlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16
    },
    modal: {
      background: '#fff',
      borderRadius: 16,
      maxWidth: 500,
      width: '100%',
      boxShadow: '0 14px 40px rgba(0,0,0,0.3)'
    },
    modalHeader: {
      padding: 16,
      borderBottom: '1px solid #eef2f7',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    modalTitle: { margin: 0, color: '#2E7D32', fontSize: 18 },
    modalBody: { padding: 16 },
    modalFooter: {
      padding: 16,
      borderTop: '1px solid #eef2f7',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10
    },
    formGroup: { marginBottom: 14 },
    label: { display: 'block', fontSize: 12, fontWeight: 900, color: '#374151', marginBottom: 6 },
    input: {
      width: '100%',
      padding: 10,
      borderRadius: 10,
      border: '1px solid #e5e7eb',
      fontSize: 14,
      backgroundColor: '#fff',
      color: '#111827',
      boxSizing: 'border-box'
    },
    select: {
      width: '100%',
      padding: 10,
      borderRadius: 10,
      border: '1px solid #e5e7eb',
      fontSize: 14,
      backgroundColor: '#fff',
      color: '#111827',
      boxSizing: 'border-box'
    },
    badge: (active) => ({
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 900,
      background: active ? '#e8f5e9' : '#fee',
      color: active ? '#2E7D32' : '#c62828',
      border: `1px solid ${active ? '#a7d7ad' : '#fca'}`
    })
  }

  if (loading) return <div style={{ padding: 30 }}>Cargando trabajadores...</div>

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>Gestión de Trabajadores</h2>
          <button style={styles.btn('primary')} onClick={() => setCreateOpen(true)}>
            ➕ Crear Usuario
          </button>
        </div>
        
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>Nombre</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Rol</th>
              <th style={styles.th}>Estado</th>
              <th style={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td style={styles.td}>{u.id}</td>
                <td style={styles.td}>{u.name || '--'}</td>
                <td style={styles.td}>{u.email}</td>
                <td style={styles.td}>
                  <span style={{ 
                    fontWeight: 900, 
                    color: u.role === 'admin' ? '#E8B04A' : '#2E7D32' 
                  }}>
                    {u.role === 'admin' ? '👑 Admin' : '👷 Inspector'}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={styles.badge(u.active)}>
                    {u.active ? '✅ Activo' : '❌ Inactivo'}
                  </span>
                </td>
                <td style={styles.td}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={styles.btn('outline')} onClick={() => openEdit(u)}>
                      ✏️ Editar
                    </button>
                    <button 
                      style={styles.btn(u.active ? 'danger' : 'primary')} 
                      onClick={() => toggleActive(u)}
                    >
                      {u.active ? '🚫 Desactivar' : '✅ Activar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#667085' }}>
                  No hay usuarios registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL CREAR */}
      {createOpen && (
        <div style={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setCreateOpen(false)}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Crear Nuevo Usuario</h3>
              <button style={styles.btn('gray')} onClick={() => setCreateOpen(false)}>✕</button>
            </div>
            
            <form onSubmit={handleCreate}>
              <div style={styles.modalBody}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Nombre completo *</label>
                  <input
                    style={styles.input}
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Email *</label>
                  <input
                    style={styles.input}
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Contraseña *</label>
                  <input
                    style={styles.input}
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Rol *</label>
                  <select
                    style={styles.select}
                    value={newUser.role}
                    onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                    required
                  >
                    <option value="inspector">Inspector</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button type="button" style={styles.btn('gray')} onClick={() => setCreateOpen(false)} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" style={styles.btn('primary')} disabled={saving}>
                  {saving ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR */}
      {editOpen && editUser && (
        <div style={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setEditOpen(false)}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Editar Usuario — {editUser.email}</h3>
              <button style={styles.btn('gray')} onClick={() => setEditOpen(false)}>✕</button>
            </div>
            
            <form onSubmit={handleEdit}>
              <div style={styles.modalBody}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Nombre completo</label>
                  <input
                    style={styles.input}
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Email</label>
                  <input
                    style={styles.input}
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Nueva contraseña (opcional)</label>
                  <input
                    style={styles.input}
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Dejar vacío para no cambiar"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Rol</label>
                  <select
                    style={styles.select}
                    value={editForm.role}
                    onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                  >
                    <option value="inspector">Inspector</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button type="button" style={styles.btn('gray')} onClick={() => setEditOpen(false)} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" style={styles.btn('primary')} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/** =========================
 *  COMPONENTE PRINCIPAL CON DROPDOWN
 *  ========================= */
export default function PanelAdmin() {
  const router = useRouter()
  const [tab, setTab] = useState('inspecciones')
  const [loggingOut, setLoggingOut] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const logout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } finally {
      try { localStorage.removeItem('adminToken') } catch {}
      router.push('/login')
      setLoggingOut(false)
    }
  }

  const styles = {
    page: { minHeight: '100vh', background: '#f4f7f4' },
    wrapper: { maxWidth: 1240, margin: '0 auto', padding: 18 },
    tabsBar: {
      display: 'flex',
      gap: 10,
      padding: 12,
      background: '#fff',
      borderRadius: 16,
      border: '1px solid #eef2f7',
      boxShadow: '0 4px 22px rgba(16,24,40,0.08)',
      marginBottom: 14,
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap'
    },
    tabsLeft: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
    tabBtn: (active) => ({
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 12px',
      borderRadius: 12,
      cursor: 'pointer',
      border: '1px solid',
      borderColor: active ? '#2E7D32' : '#e5e7eb',
      background: active ? '#e8f5e9' : '#fff',
      color: active ? '#2E7D32' : '#374151',
      fontWeight: 900,
      fontSize: 13
    }),
    
    userDropdown: {
      position: 'relative',
      display: 'inline-block'
    },
    userBtn: {
      width: 42,
      height: 42,
      borderRadius: '50%',
      background: '#E8B04A',
      color: '#fff',
      border: 'none',
      cursor: 'pointer',
      fontSize: 18,
      fontWeight: 900,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    dropdownMenu: {
      position: 'absolute',
      top: '50px',
      right: 0,
      background: '#fff',
      border: '1px solid #eef2f7',
      borderRadius: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      minWidth: 200,
      padding: 8,
      zIndex: 1000
    },
    menuItem: {
      padding: '10px 14px',
      cursor: 'pointer',
      borderRadius: 8,
      fontSize: 14,
      color: '#374151',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    },
    logoutItem: {
      color: '#c62828',
      fontWeight: 900
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>
        <div style={styles.tabsBar}>
          <div style={styles.tabsLeft}>
            <button style={styles.tabBtn(tab === 'inspecciones')} onClick={() => setTab('inspecciones')}>
              📋 Inspecciones
            </button>

            <button style={styles.tabBtn(tab === 'trabajadores')} onClick={() => setTab('trabajadores')}>
              👥 Trabajadores
            </button>
          </div>

          <div style={styles.userDropdown}>
            <button 
              style={styles.userBtn}
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              U
            </button>

            {dropdownOpen && (
              <div style={styles.dropdownMenu}>
                <div 
                  style={{ ...styles.menuItem, padding: '8px 14px', borderBottom: '1px solid #eef2f7', marginBottom: 6 }}
                >
                  <span style={{ fontSize: 12, color: '#667085' }}>Admin Dashboard</span>
                </div>
                
                <div 
                  style={{ ...styles.menuItem, ...styles.logoutItem }}
                  onClick={logout}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fee'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  🚪 {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
                </div>
              </div>
            )}
          </div>
        </div>

        {tab === 'inspecciones' ? <InspeccionesTab /> : <TrabajadoresTab />}
      </div>
    </div>
  )
}