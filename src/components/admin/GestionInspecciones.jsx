'use client'

import React, { useState, useEffect } from 'react'
import {
  Sheet, CheckCircle2, AlertTriangle, Plus, RefreshCw, RotateCcw,
  Settings, X, Save, FlaskConical, Pencil, Trash2, CalendarClock,
  Circle
} from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'Pendiente',  label: 'Pendiente',  color: '#92400e', bg: '#fffbeb', bd: '#fcd34d' },
  { value: 'Completada', label: 'Completada', color: '#166534', bg: '#f0fdf4', bd: '#86efac' },
  { value: 'Cancelada',  label: 'Cancelada',  color: '#991b1b', bg: '#fff1f2', bd: '#fca5a5' },
]

const STATUS_ICONS = {
  Pendiente:  <Circle      size={10} fill="#f59e0b" color="#f59e0b" />,
  Completada: <CheckCircle2 size={10} color="#16a34a" />,
  Cancelada:  <X           size={10} color="#dc2626" />,
}

export default function GestionInspecciones({ onSyncSuccess }) {
  const [inspecciones, setInspecciones]   = useState([])
  const [loading, setLoading]             = useState(false)
  const [syncing, setSyncing]             = useState(false)
  const [editingRow, setEditingRow]       = useState(null)
  const [configured, setConfigured]       = useState(false)
  const [showConfig, setShowConfig]       = useState(false)
  const [sheetUrl, setSheetUrl]           = useState('')
  const [lastSync, setLastSync]           = useState(null)
  const [syncStats, setSyncStats]         = useState(null)
  const [inspectores, setInspectores]     = useState([])
  const [commodities, setCommodities]     = useState([])
  const [showNewRow, setShowNewRow]       = useState(false)
  const [newInspection, setNewInspection] = useState({
    producer: '', lot: '', variety: '', commodity: '', inspector: '', estado: 'Pendiente'
  })

  useEffect(() => {
    checkConfiguration()
    loadLastSync()
    loadInspectores()
    loadCommodities()
    if (configured) loadFromSheet()
  }, [configured])

  const checkConfiguration = async () => {
    try {
      const res  = await fetch('/api/google-sheets/config', { credentials: 'include' })
      const data = await res.json()
      setConfigured(data.configured)
      setSheetUrl(data.sheetUrl || '')
    } catch (err) { console.error('Error checking config:', err) }
  }

  const loadLastSync = async () => {
    try {
      const res  = await fetch('/api/google-sheets/last-sync', { credentials: 'include' })
      const data = await res.json()
      if (data.lastSync) setLastSync(new Date(data.lastSync))
    } catch (err) { console.error('Error loading last sync:', err) }
  }

  const loadInspectores = async () => {
    try {
      const res  = await fetch('/api/users?role=inspector', { credentials: 'include' })
      const data = await res.json()
      if (res.ok && Array.isArray(data)) setInspectores(data.filter(u => u.active))
    } catch (err) { console.error('Error loading inspectores:', err) }
  }

  const loadCommodities = async () => {
    try {
      const res  = await fetch('/api/commodities', { credentials: 'include' })
      const data = await res.json()
      if (res.ok && Array.isArray(data)) setCommodities(data)
    } catch (err) { console.error('Error loading commodities:', err) }
  }

  const loadFromSheet = async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/google-sheets/load', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.msg || 'Error al cargar')
      setInspecciones(data.inspecciones || [])
    } catch (err) { console.error('Error loading:', err) }
    finally { setLoading(false) }
  }

  const saveConfig = async () => {
    try {
      const res  = await fetch('/api/google-sheets/config', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.msg || 'Error al guardar')
      alert('Configuración guardada')
      setConfigured(true); setShowConfig(false)
      await loadFromSheet()
    } catch (err) { alert(err.message) }
  }

  const testConnection = async () => {
    try {
      const res  = await fetch('/api/google-sheets/test', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.msg || 'Error en la conexión')
      alert(`Conexión exitosa!\n\nSheet: ${data.title}\nFilas: ${data.rowCount}`)
    } catch (err) { alert('Error: ' + err.message) }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res  = await fetch('/api/google-sheets/sync', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.msg || 'Error al sincronizar')
      setSyncStats(data); setLastSync(new Date())
      alert(`Sincronización completada:\n- ${data.nuevas} inspecciones creadas\n- ${data.skipped || 0} omitidas\n- ${data.errores} errores`)
      await loadFromSheet()
      if (onSyncSuccess) onSyncSuccess()
    } catch (err) { alert(err.message) }
    finally { setSyncing(false) }
  }

  const handleAddRow = async () => {
    if (!newInspection.producer || !newInspection.lot) {
      alert('Productor y Lote son obligatorios'); return
    }
    try {
      const res  = await fetch('/api/google-sheets/add-row', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInspection)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.msg || 'Error al agregar')
      alert('Fila agregada al Google Sheet')
      setShowNewRow(false)
      setNewInspection({ producer: '', lot: '', variety: '', commodity: '', inspector: '', estado: 'Pendiente' })
      await loadFromSheet()
    } catch (err) { alert(err.message) }
  }

  const handleSaveEdit = async (index) => {
    const insp = inspecciones[index]
    try {
      const res  = await fetch('/api/google-sheets/update-row', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowNumber: insp._rowNumber,
          data: { producer: insp.Productor, lot: insp.Lote, variety: insp.Variedad, commodity: insp.Commodity, inspector: insp.Inspector, estado: insp.Estado || 'Pendiente' }
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.msg || 'Error al actualizar')
      alert('Fila actualizada'); setEditingRow(null); await loadFromSheet()
    } catch (err) { alert(err.message) }
  }

  const handleDeleteRow = async (index) => {
    const insp = inspecciones[index]
    if (!confirm(`¿Eliminar "${insp.Lote}" - "${insp.Productor}"?`)) return
    try {
      const res  = await fetch('/api/google-sheets/delete-row', {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowNumber: insp._rowNumber })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.msg || 'Error al eliminar')
      alert('Fila eliminada'); await loadFromSheet()
    } catch (err) { alert(err.message) }
  }

  const updateField = (index, field, value) => {
    const updated = [...inspecciones]
    updated[index][field] = value
    setInspecciones(updated)
  }

  // ── Estilos ──
  const S = {
    container: { background: '#fff', borderRadius: 16, border: '1px solid #eef2f7', boxShadow: '0 4px 22px rgba(16,24,40,0.08)', padding: 20, marginBottom: 20 },
    btn: (variant = 'primary', disabled = false) => {
      const base = { padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, opacity: disabled ? 0.5 : 1 }
      const v = { primary: { ...base, background: '#16a34a', color: '#fff' }, secondary: { ...base, background: '#2563eb', color: '#fff' }, danger: { ...base, background: '#dc2626', color: '#fff' }, outline: { ...base, background: '#fff', border: '1.5px solid #16a34a', color: '#15803d' }, gray: { ...base, background: '#6b7280', color: '#fff' } }
      return v[variant] || base
    },
    input: { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box', color: '#111827' },
    th: { background: '#f8fafc', padding: '10px 14px', textAlign: 'left', color: '#15803d', borderBottom: '2px solid #eef2f7', fontSize: 11, textTransform: 'uppercase', fontWeight: 900, whiteSpace: 'nowrap' },
    td: { padding: '10px 14px', borderBottom: '1px solid #eef2f7', verticalAlign: 'middle', fontSize: 13, color: '#374151' },
  }

  const badgeStyle = (status) => {
    const opt = STATUS_OPTIONS.find(s => s.value === status)
    if (!opt) return { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db' }
    return { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: opt.bg, color: opt.color, border: `1px solid ${opt.bd}` }
  }

  return (
    <div style={S.container}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: '#15803d', fontSize: 18, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sheet size={18} />
            Gestión de Inspecciones — Google Sheets
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: configured ? '#f0fdf4' : '#fff7ed', color: configured ? '#15803d' : '#c2410c', border: `1px solid ${configured ? '#86efac' : '#fed7aa'}` }}>
              {configured ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
              {configured ? 'Conectado' : 'Sin configurar'}
            </span>
          </h2>
          <p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>
            {configured ? `${inspecciones.length} inspecciones en el Sheet` : 'Configura Google Sheets para comenzar'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {configured && (
            <>
              <button style={S.btn('secondary')} onClick={() => setShowNewRow(v => !v)}>
                {showNewRow ? <X size={14} /> : <Plus size={14} />}
                {showNewRow ? 'Cancelar' : 'Nueva Fila'}
              </button>
              <button style={S.btn('primary', syncing)} onClick={handleSync} disabled={syncing}>
                <RefreshCw size={14} />
                {syncing ? 'Sincronizando...' : 'Importar a BD'}
              </button>
              <button style={S.btn('outline', loading)} onClick={loadFromSheet} disabled={loading}>
                <RotateCcw size={14} />
                {loading ? 'Cargando...' : 'Recargar'}
              </button>
            </>
          )}
          <button style={S.btn('gray')} onClick={() => setShowConfig(v => !v)}>
            <Settings size={14} />
            {showConfig ? 'Ocultar Config' : 'Configurar'}
          </button>
        </div>
      </div>

      {/* ── Última sync ── */}
      {configured && lastSync && !showConfig && (
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#667085', display: 'flex', alignItems: 'center', gap: 7 }}>
          <CalendarClock size={14} />
          Última importación: {lastSync.toLocaleDateString('es-CL')} {lastSync.toLocaleTimeString('es-CL')}
          {syncStats && ` • ${syncStats.nuevas} nuevas • ${syncStats.skipped || 0} omitidas • ${syncStats.errores} errores`}
        </div>
      )}

      {/* ── Config ── */}
      {showConfig && (
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px', color: '#15803d', fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Settings size={15} /> Configuración de Google Sheets
          </h3>
          <div style={{ fontSize: 12, color: '#667085', marginBottom: 12, lineHeight: 1.7 }}>
            1. Crea un Google Sheet con columnas: Productor | Lote | Variedad | Commodity | Inspector | Estado | ID Inspección<br />
            2. Comparte el Sheet con el email de servicio (ver documentación)<br />
            3. Configura las variables de entorno en .env.local
          </div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>URL del Google Sheet (opcional)</label>
          <input style={S.input} type="url" placeholder="https://docs.google.com/spreadsheets/d/..." value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={S.btn('primary')} onClick={saveConfig}><Save size={14} /> Guardar</button>
            <button style={S.btn('secondary')} onClick={testConnection}><FlaskConical size={14} /> Probar Conexión</button>
            <button style={S.btn('gray')} onClick={() => setShowConfig(false)}><X size={14} /> Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Sin configurar ── */}
      {!configured && !showConfig && (
        <div style={{ background: '#fff7ed', borderRadius: 12, padding: 16, border: '1px solid #fed7aa' }}>
          <div style={{ color: '#c2410c', fontWeight: 900, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={15} /> Configuración pendiente
          </div>
          <div style={{ color: '#9a3412', fontSize: 13, lineHeight: 1.6 }}>
            Para usar Google Sheets, configura las variables de entorno en .env.local y haz clic en "Configurar".
          </div>
        </div>
      )}

      {/* ── Nueva fila ── */}
      {configured && showNewRow && (
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {[['producer','Productor *'],['lot','Lote *'],['variety','Variedad']].map(([k, lbl]) => (
            <div key={k}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>{lbl}</label>
              <input style={S.input} value={newInspection[k]} onChange={e => setNewInspection(p => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Commodity</label>
            <select style={S.input} value={newInspection.commodity} onChange={e => setNewInspection(p => ({ ...p, commodity: e.target.value }))}>
              <option value="">Sin especificar</option>
              {commodities.map(c => <option key={c.id} value={c.code}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Inspector</label>
            <select style={S.input} value={newInspection.inspector} onChange={e => setNewInspection(p => ({ ...p, inspector: e.target.value }))}>
              <option value="">Sin asignar</option>
              {inspectores.map(i => <option key={i.id} value={i.email}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Estado</label>
            <select style={S.input} value={newInspection.estado} onChange={e => setNewInspection(p => ({ ...p, estado: e.target.value }))}>
              {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button style={S.btn('primary')} onClick={handleAddRow}><CheckCircle2 size={14} /> Agregar</button>
          </div>
        </div>
      )}

      {/* ── Tabla ── */}
      {configured && (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #eef2f7' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Productor','Lote','Variedad','Commodity','Inspector','Estado','ID','Acciones'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', padding: 30, color: '#9ca3af' }}>Cargando...</td></tr>
              ) : inspecciones.length === 0 ? (
                <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', padding: 30, color: '#667085' }}>No hay inspecciones. Agrega una nueva o sincroniza desde Google Sheets.</td></tr>
              ) : (
                inspecciones.map((insp, idx) => (
                  <tr key={idx}>
                    <td style={S.td}>
                      {editingRow === idx
                        ? <input style={S.input} value={insp.Productor || ''} onChange={e => updateField(idx, 'Productor', e.target.value)} />
                        : insp.Productor || '--'}
                    </td>
                    <td style={S.td}>
                      {editingRow === idx
                        ? <input style={S.input} value={insp.Lote || ''} onChange={e => updateField(idx, 'Lote', e.target.value)} />
                        : <strong>{insp.Lote || '--'}</strong>}
                    </td>
                    <td style={S.td}>
                      {editingRow === idx
                        ? <input style={S.input} value={insp.Variedad || ''} onChange={e => updateField(idx, 'Variedad', e.target.value)} />
                        : insp.Variedad || '--'}
                    </td>
                    <td style={S.td}>
                      {editingRow === idx
                        ? <select style={S.input} value={insp.commodity_code || insp.Commodity || ''} onChange={e => { updateField(idx, 'Commodity', e.target.value); updateField(idx, 'commodity_code', e.target.value) }}>
                            <option value="">Sin especificar</option>
                            {commodities.map(c => <option key={c.id} value={c.code}>{c.name}</option>)}
                          </select>
                        : insp.commodity_code || insp.Commodity || '--'}
                    </td>
                    <td style={S.td}>
                      {editingRow === idx
                        ? <select style={S.input} value={insp.Inspector || ''} onChange={e => updateField(idx, 'Inspector', e.target.value)}>
                            <option value="">Sin asignar</option>
                            {inspectores.map(i => <option key={i.id} value={i.email}>{i.name}</option>)}
                          </select>
                        : <span style={{ fontSize: 12 }}>{insp.Inspector || '--'}</span>}
                    </td>
                    <td style={S.td}>
                      {editingRow === idx
                        ? <select style={S.input} value={insp.Estado || 'Pendiente'} onChange={e => updateField(idx, 'Estado', e.target.value)}>
                            {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                        : <span style={badgeStyle(insp.Estado || 'Pendiente')}>
                            {STATUS_ICONS[insp.Estado || 'Pendiente']}
                            {insp.Estado || 'Pendiente'}
                          </span>}
                    </td>
                    <td style={S.td}>
                      <span style={{ fontSize: 11, color: '#667085' }}>{insp['ID Inspección'] || insp.ID || '--'}</span>
                    </td>
                    <td style={S.td}>
                      {editingRow === idx ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={S.btn('primary')} onClick={() => handleSaveEdit(idx)}><Save size={13} /></button>
                          <button style={S.btn('gray')} onClick={() => { setEditingRow(null); loadFromSheet() }}><X size={13} /></button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={S.btn('outline')} onClick={() => setEditingRow(idx)}><Pencil size={13} /></button>
                          <button style={S.btn('danger')} onClick={() => handleDeleteRow(idx)}><Trash2 size={13} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}