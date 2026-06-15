'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, CheckCircle2, LogOut, Inbox, Loader2, Eye, ChevronDown, ChevronRight, Rocket } from 'lucide-react'

export default function DashboardInspector() {
  const router = useRouter()
  const [tab, setTab] = useState('asignadas')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => { loadUserInfo() }, [])

  const loadUserInfo = async () => {
    try {
      const res  = await fetch('/api/auth/me', { credentials: 'include' })
      const data = await res.json()
      if (res.ok && data.user) setUser(data.user)
    } catch (err) { console.error('Error loading user:', err) }
  }

  const logout = async () => {
    setLoggingOut(true)
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }) }
    finally { router.push('/login') }
  }

  const TABS = [
    { value: 'asignadas',   label: 'Mis Inspecciones', Icon: ClipboardList },
    { value: 'completadas', label: 'Completadas',       Icon: CheckCircle2  }
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f0' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: 18 }}>

        {/* ── Top bar ── */}
        <div style={{ display: 'flex', gap: 10, padding: 12, background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {TABS.map(({ value, label, Icon }) => (
              <button key={value} onClick={() => setTab(value)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 12, cursor: 'pointer', border: '1px solid', borderColor: tab === value ? '#16a34a' : '#e5e7eb', background: tab === value ? '#f0fdf4' : '#fff', color: tab === value ? '#15803d' : '#374151', fontWeight: 900, fontSize: 13 }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setDropdownOpen(o => !o)} title={user?.name || 'Inspector'} style={{ width: 40, height: 40, borderRadius: '50%', background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {user?.name?.charAt(0).toUpperCase() || 'I'}
            </button>

            {dropdownOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setDropdownOpen(false)} />
                <div style={{ position: 'absolute', top: 48, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.12)', minWidth: 200, padding: 6, zIndex: 1000 }}>
                  <div style={{ padding: '8px 14px', borderBottom: '1px solid #f1f5f9', marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#15803d' }}>{user?.name || 'Inspector'}</span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{user?.email || ''}</span>
                  </div>
                  <button onClick={logout} style={{ display: 'flex', width: '100%', padding: '9px 14px', borderRadius: 8, border: 'none', background: 'transparent', color: '#dc2626', fontWeight: 700, fontSize: 13, cursor: 'pointer', gap: 8, alignItems: 'center' }}>
                    <LogOut size={14} /> {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {tab === 'asignadas'   && <InspeccionesAsignadasTab />}
        {tab === 'completadas' && <InspeccionesCompletadasTab />}
      </div>
    </div>
  )
}

// ─── Asignadas ────────────────────────────────────────────────────────────────
function InspeccionesAsignadasTab() {
  const [inspecciones, setInspecciones] = useState([])
  const [loading, setLoading]           = useState(true)
  const [expandedProducer, setExpandedProducer] = useState(null)
  const router = useRouter()

  useEffect(() => { loadInspecciones() }, [])

  const loadInspecciones = async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/inspecciones/asignadas', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setInspecciones(data.inspecciones || [])
    } catch (err) { console.error('Error loading:', err) }
    finally { setLoading(false) }
  }

  const groupedByProducer = useMemo(() => {
    const groups = {}
    inspecciones.forEach(insp => {
      const p = insp.producer || 'Sin productor'
      if (!groups[p]) groups[p] = []
      groups[p].push(insp)
    })
    return groups
  }, [inspecciones])

  const S = {
    card:         { background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: 20 },
    producerCard: { background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #e5e7eb', cursor: 'pointer' },
    inspCard:     { background: '#fff', borderRadius: 8, padding: 12, marginTop: 8, border: '1px solid #e5e7eb' },
    badge:        { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 900, background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d', marginLeft: 8 },
    btn:          { marginTop: 8, width: '100%', padding: 10, borderRadius: 10, background: '#16a34a', color: '#fff', border: 'none', fontWeight: 900, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }
  }

  if (loading) return (
    <div style={S.card}>
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Loader2 size={16} /> Cargando inspecciones...
      </div>
    </div>
  )

  return (
    <div style={S.card}>
      <h2 style={{ margin: '0 0 4px', color: '#15803d', fontSize: 20, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ClipboardList size={18} /> Mis Inspecciones Asignadas
      </h2>
      <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: 13 }}>
        {inspecciones.length} {inspecciones.length === 1 ? 'inspección pendiente' : 'inspecciones pendientes'}
      </p>

      {inspecciones.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
          <Inbox size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#374151' }}>No tienes inspecciones asignadas</div>
          <div style={{ fontSize: 13 }}>Cuando el administrador te asigne una inspección, aparecerá aquí.</div>
        </div>
      ) : (
        Object.entries(groupedByProducer).map(([producer, inspList]) => (
          <div key={producer} style={S.producerCard}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(22,163,74,0.15)'; e.currentTarget.style.borderColor = '#16a34a' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e5e7eb' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onClick={() => setExpandedProducer(expandedProducer === producer ? null : producer)}>
              <div>
                <strong style={{ fontSize: 16, color: '#111827' }}>{producer}</strong>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                  {inspList.length} {inspList.length === 1 ? 'inspección pendiente' : 'inspecciones pendientes'}
                </div>
              </div>
              {expandedProducer === producer ? <ChevronDown size={18} color="#6b7280" /> : <ChevronRight size={18} color="#6b7280" />}
            </div>

            {expandedProducer === producer && (
              <div style={{ marginTop: 12 }}>
                {inspList.map(insp => (
                  <div key={insp.id} style={S.inspCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <strong style={{ fontSize: 14, color: '#111827' }}>{insp.lot || 'Sin lote'}</strong>
                      <span style={S.badge}>Pendiente</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, lineHeight: 1.6 }}>
                      {insp.variety      && <div style={{ marginBottom: 4 }}><span style={{ fontWeight: 600, color: '#374151' }}>Variedad:</span> {insp.variety}</div>}
                      {insp.commodity_code && <div style={{ marginBottom: 4 }}><span style={{ fontWeight: 600, color: '#374151' }}>Commodity:</span> {insp.commodity_code}</div>}
                      {insp.notes_admin  && <div style={{ marginTop: 8, padding: 8, background: '#fffbeb', borderRadius: 8, fontSize: 12 }}><strong style={{ color: '#92400e' }}>Nota:</strong> {insp.notes_admin}</div>}
                    </div>
                    <button style={S.btn} onClick={() => router.push(`/inspecciones/nueva?assignment_id=${insp.id}`)}
                      onMouseEnter={e => e.currentTarget.style.background = '#15803d'}
                      onMouseLeave={e => e.currentTarget.style.background = '#16a34a'}>
                      <Rocket size={14} /> Iniciar Inspección
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ─── Completadas ──────────────────────────────────────────────────────────────
function InspeccionesCompletadasTab() {
  const [inspecciones, setInspecciones] = useState([])
  const [loading, setLoading]           = useState(true)
  const [detailOpen, setDetailOpen]     = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail]             = useState(null)

  useEffect(() => { loadInspecciones() }, [])

  const loadInspecciones = async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/inspecciones/completadas', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setInspecciones(data.inspecciones || [])
    } catch (err) { console.error('Error loading:', err) }
    finally { setLoading(false) }
  }

  const verDetalle = async (id) => {
    setDetailOpen(true); setDetailLoading(true); setDetail(null)
    try {
      const res  = await fetch(`/api/inspecciones/${id}`, { credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.msg || 'Error')
      setDetail(data)
    } catch (err) { alert(err?.message); setDetailOpen(false) }
    finally { setDetailLoading(false) }
  }

  const S = {
    card:        { background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' },
    th:          { padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#15803d', fontSize: 11, textTransform: 'uppercase', fontWeight: 900, background: '#f8fafc' },
    td:          { padding: '12px 16px', borderBottom: '1px solid #f1f5f9', color: '#374151' },
    badge:       { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 900, background: '#f0fdf4', color: '#166534', border: '1px solid #86efac' },
    btn:         { padding: '7px 12px', borderRadius: 8, background: '#16a34a', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
    modalOv:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 9999 },
    modal:       { width: '100%', maxWidth: 900, maxHeight: '90vh', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' },
    modalHeader: { background: 'linear-gradient(135deg,#15803d,#16a34a)', color: '#fff', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    modalBody:   { overflowY: 'auto', flex: 1, padding: 22 },
    closeBtn:    { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }
  }

  if (loading) return (
    <div style={S.card}>
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Loader2 size={16} /> Cargando inspecciones...
      </div>
    </div>
  )

  return (
    <div style={S.card}>
      <div style={{ padding: 20, borderBottom: '1px solid #f1f5f9' }}>
        <h2 style={{ margin: '0 0 4px', color: '#15803d', fontSize: 20, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={18} /> Inspecciones Completadas
        </h2>
        <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
          {inspecciones.length} {inspecciones.length === 1 ? 'inspección finalizada' : 'inspecciones finalizadas'}
        </p>
      </div>

      {inspecciones.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
          <ClipboardList size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#374151' }}>Aún no has completado inspecciones</div>
          <div style={{ fontSize: 13 }}>Tus inspecciones finalizadas aparecerán aquí.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Fecha','Lote','Productor','Variedad','Estado','Acciones'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {inspecciones.map(insp => (
                <tr key={insp.id}>
                  <td style={S.td}>{new Date(insp.created_at).toLocaleDateString('es-CL')}</td>
                  <td style={S.td}><strong>{insp.lot || '--'}</strong></td>
                  <td style={S.td}>{insp.producer || '--'}</td>
                  <td style={S.td}>{insp.variety || '--'}</td>
                  <td style={S.td}><span style={S.badge}><CheckCircle2 size={11} /> Completada</span></td>
                  <td style={S.td}>
                    <button style={S.btn} onClick={() => verDetalle(insp.id)}
                      onMouseEnter={e => e.currentTarget.style.background = '#15803d'}
                      onMouseLeave={e => e.currentTarget.style.background = '#16a34a'}>
                      <Eye size={13} /> Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal detalle ── */}
      {detailOpen && (
        <div style={S.modalOv} onMouseDown={e => e.target === e.currentTarget && setDetailOpen(false)}>
          <div style={S.modal}>
            <div style={S.modalHeader}>
              <div>
                <div style={{ fontSize: 10, opacity: .75, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 }}>Inspección #{detail?.id}</div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>{detail?.commodity_code} — {detail?.lot || '…'}</h3>
              </div>
              <button style={S.closeBtn} onClick={() => setDetailOpen(false)}>
                ✕ Cerrar
              </button>
            </div>

            <div style={S.modalBody}>
              {detailLoading && (
                <div style={{ textAlign: 'center', padding: 52, color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Loader2 size={16} /> Cargando detalles…
                </div>
              )}

              {!detailLoading && detail && (
                <>
                  {/* Info general */}
                  <div style={{ marginBottom: 20 }}>
                    <h4 style={{ margin: '0 0 12px', color: '#15803d', fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ClipboardList size={14} /> Información General
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                      {[
                        ['Productor',       detail.producer],
                        ['Lote',            detail.lot],
                        ['Variedad',        detail.variety],
                        ['Calibre',         detail.caliber],
                        ['Código Embalaje', detail.packaging_code],
                        ['Tipo Embalaje',   detail.packaging_type],
                        ['Fecha Embalaje',  detail.packaging_date ? new Date(detail.packaging_date).toLocaleDateString('es-CL') : null],
                        ['Peso Neto',       detail.net_weight ? `${detail.net_weight} kg` : null],
                      ].filter(([, v]) => v).map(([label, val]) => (
                        <div key={label} style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 14px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: 10, fontWeight: 900, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Brix & Temperaturas */}
                  {(detail.brix_avg || detail.temp_water || detail.temp_ambient || detail.temp_pulp) && (
                    <div style={{ marginBottom: 20 }}>
                      <h4 style={{ margin: '0 0 12px', color: '#15803d', fontSize: 14, fontWeight: 900 }}>Temperaturas & Brix</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                        {[
                          ['Brix',      detail.brix_avg     != null ? `${detail.brix_avg}°`      : null],
                          ['Agua',      detail.temp_water   != null ? `${detail.temp_water}°C`   : null],
                          ['Ambiente',  detail.temp_ambient != null ? `${detail.temp_ambient}°C` : null],
                          ['Pulpa',     detail.temp_pulp    != null ? `${detail.temp_pulp}°C`    : null],
                        ].filter(([, v]) => v).map(([label, val]) => (
                          <div key={label} style={{ background: '#f0fdf4', borderRadius: 12, padding: '10px 14px', border: '1px solid #86efac' }}>
                            <div style={{ fontSize: 10, fontWeight: 900, color: '#166534', marginBottom: 4 }}>{label}</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: '#14532d' }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Métricas */}
                  <div>
                    <h4 style={{ margin: '0 0 12px', color: '#15803d', fontSize: 14, fontWeight: 900 }}>Métricas de Calidad</h4>
                    {Object.keys(detail.metrics?.values || {}).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', background: '#f8fafc', borderRadius: 14, fontSize: 14 }}>Sin métricas registradas</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                        {Object.entries(detail.metrics.values).map(([k, v]) => {
                          const bare  = k.includes('.') ? k.split('.')[1] : k
                          const label = bare.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                          return (
                            <div key={k} style={{ background: '#eff6ff', borderRadius: 12, padding: '10px 14px', border: '1px solid #93c5fd' }}>
                              <div style={{ fontSize: 10, fontWeight: 900, color: '#1e40af', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
                              <div style={{ fontSize: 15, fontWeight: 900, color: '#1e3a8a' }}>{v || '--'}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Notas */}
                  {detail.notes && (
                    <div style={{ marginTop: 20, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12, padding: '10px 16px' }}>
                      <div style={{ fontSize: 10, fontWeight: 900, color: '#92400e', marginBottom: 4, textTransform: 'uppercase' }}>Comentarios</div>
                      <div style={{ fontSize: 14, color: '#78350f', lineHeight: 1.5 }}>{detail.notes}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}