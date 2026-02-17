'use client'

import React, { useState, useEffect } from 'react'

const STATUS_OPTIONS = [
  { value: 'Pendiente',  label: '🟡 Pendiente',  color: '#92400e', bg: '#fffbeb', bd: '#fcd34d' },
  { value: 'Completada', label: '🟢 Completada', color: '#166534', bg: '#f0fdf4', bd: '#86efac' },
  { value: 'Cancelada',  label: '🔴 Cancelada',  color: '#991b1b', bg: '#fff1f2', bd: '#fca5a5' },
]

/**
 * Componente COMPLETO de Google Sheets
 * Incluye: Configuración + Tabla Editable + Sincronización
 */
export default function GestionInspecciones({ onSyncSuccess }) {
  const [inspecciones, setInspecciones] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [configured, setConfigured] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [sheetUrl, setSheetUrl] = useState('')
  const [lastSync, setLastSync] = useState(null)
  const [syncStats, setSyncStats] = useState(null)
  const [inspectores, setInspectores] = useState([])

  const [showNewRow, setShowNewRow] = useState(false)
  const [newInspection, setNewInspection] = useState({
    producer: '',
    lot: '',
    variety: '',
    commodity: '',
    inspector: '',
    estado: 'Pendiente'
  })

  useEffect(() => {
    checkConfiguration()
    loadLastSync()
    loadInspectores()
    if (configured) {
      loadFromSheet()
    }
  }, [configured])

  const checkConfiguration = async () => {
    try {
      const res = await fetch('/api/google-sheets/config', {
        credentials: 'include'
      })
      const data = await res.json()
      setConfigured(data.configured)
      setSheetUrl(data.sheetUrl || '')
    } catch (err) {
      console.error('Error checking config:', err)
    }
  }

  const loadLastSync = async () => {
    try {
      const res = await fetch('/api/google-sheets/last-sync', {
        credentials: 'include'
      })
      const data = await res.json()
      if (data.lastSync) {
        setLastSync(new Date(data.lastSync))
      }
    } catch (err) {
      console.error('Error loading last sync:', err)
    }
  }

  const loadInspectores = async () => {
    try {
      const res = await fetch('/api/users?role=inspector', {
        credentials: 'include'
      })
      const data = await res.json()
      if (res.ok && Array.isArray(data)){
        setInspectores(data.filter(u => u.active))
      }
    } catch (err) {
      console.error('Error loading inspectores:', err)
    }
  }

  const loadFromSheet = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/google-sheets/load', {
        credentials: 'include'
      })
      
      const data = await res.json()
      
      if (!res.ok) throw new Error(data?.msg || 'Error al cargar')
      
      setInspecciones(data.inspecciones || [])
    } catch (err) {
      console.error('Error loading:', err)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    try {
      const res = await fetch('/api/google-sheets/config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data?.msg || 'Error al guardar')

      alert('✅ Configuración guardada')
      setConfigured(true)
      setShowConfig(false)
      await loadFromSheet()

    } catch (err) {
      alert('❌ ' + err.message)
    }
  }

  const testConnection = async () => {
    try {
      const res = await fetch('/api/google-sheets/test', {
        credentials: 'include'
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data?.msg || 'Error en la conexión')

      alert(`✅ Conexión exitosa!\n\nSheet: ${data.title}\nFilas: ${data.rowCount}`)

    } catch (err) {
      alert('❌ Error: ' + err.message)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/google-sheets/sync', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data?.msg || 'Error al sincronizar')

      setSyncStats(data)
      setLastSync(new Date())
      alert(`✅ Sincronización completada:\n- ${data.nuevas} inspecciones creadas\n- ${data.errores} errores`)
      
      await loadFromSheet()
      if (onSyncSuccess) onSyncSuccess()

    } catch (err) {
      alert('❌ ' + err.message)
    } finally {
      setSyncing(false)
    }
  }

  const handleAddRow = async () => {
    if (!newInspection.producer || !newInspection.lot) {
      alert('⚠️ Productor y Lote son obligatorios')
      return
    }

    try {
      const res = await fetch('/api/google-sheets/add-row', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInspection)
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data?.msg || 'Error al agregar')

      alert('✅ Fila agregada al Google Sheet')
      setShowNewRow(false)
      setNewInspection({ producer: '', lot: '', variety: '', commodity: '', inspector: '', estado: 'Pendiente' })
      await loadFromSheet()

    } catch (err) {
      alert('❌ ' + err.message)
    }
  }

  const handleEditRow = (index) => {
    setEditingRow(index)
  }

  const handleSaveEdit = async (index) => {
    const insp = inspecciones[index]
    
    try {
      const res = await fetch('/api/google-sheets/update-row', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowNumber: insp._rowNumber,
          data: {
            producer: insp.Productor,
            lot: insp.Lote,
            variety: insp.Variedad,
            commodity: insp.Commodity,
            inspector: insp.Inspector,
            estado: insp.Estado || 'Pendiente'
          }
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data?.msg || 'Error al actualizar')

      alert('✅ Fila actualizada en Google Sheet')
      setEditingRow(null)
      await loadFromSheet()

    } catch (err) {
      alert('❌ ' + err.message)
    }
  }

  const handleCancelEdit = () => {
    setEditingRow(null)
    loadFromSheet()
  }

  const handleDeleteRow = async (index) => {
    const insp = inspecciones[index]
    
    if (!confirm(`¿Eliminar inspección "${insp.Lote}" - "${insp.Productor}"?`)) return

    try {
      const res = await fetch('/api/google-sheets/delete-row', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowNumber: insp._rowNumber })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data?.msg || 'Error al eliminar')

      alert('✅ Fila eliminada del Google Sheet')
      await loadFromSheet()

    } catch (err) {
      alert('❌ ' + err.message)
    }
  }

  const updateField = (index, field, value) => {
    const updated = [...inspecciones]
    updated[index][field] = value
    setInspecciones(updated)
  }

  const styles = {
    container: {
      background: '#fff',
      borderRadius: 16,
      border: '1px solid #eef2f7',
      boxShadow: '0 4px 22px rgba(16,24,40,0.08)',
      padding: 20,
      marginBottom: 20
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
      flexWrap: 'wrap',
      gap: 12
    },
    title: {
      margin: 0,
      color: '#2E7D32',
      fontSize: 20,
      fontWeight: 900,
      display: 'flex',
      alignItems: 'center',
      gap: 10
    },
    statusBadge: (active) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 900,
      background: active ? '#e8f5e9' : '#fff7ed',
      color: active ? '#2E7D32' : '#c2410c',
      border: `1px solid ${active ? '#a7d7ad' : '#fed7aa'}`
    }),
    buttonGroup: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap'
    },
    btn: (variant = 'primary', disabled = false) => {
      const base = {
        padding: '10px 16px',
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 900,
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        opacity: disabled ? 0.5 : 1
      }
      if (variant === 'primary') return { ...base, background: '#2E7D32', color: '#fff' }
      if (variant === 'secondary') return { ...base, background: '#1565c0', color: '#fff' }
      if (variant === 'danger') return { ...base, background: '#c62828', color: '#fff' }
      if (variant === 'outline') return { ...base, background: '#fff', border: '2px solid #2E7D32', color: '#2E7D32' }
      if (variant === 'gray') return { ...base, background: '#64748b', color: '#fff' }
      return base
    },
    infoBox: {
      background: '#f8fafc',
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      fontSize: 13,
      color: '#667085'
    },
    configBox: {
      background: '#f8fafc',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16
    },
    input: {
      width: '100%',
      padding: 10,
      borderRadius: 8,
      border: '1px solid #e5e7eb',
      fontSize: 13,
      boxSizing: 'border-box'
    },
    tableWrap: {
      overflowX: 'auto',
      borderRadius: 12,
      border: '1px solid #eef2f7'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    },
    th: {
      background: '#f8fafc',
      padding: 12,
      textAlign: 'left',
      color: '#2E7D32',
      borderBottom: '2px solid #eef2f7',
      fontSize: 11,
      textTransform: 'uppercase',
      fontWeight: 900,
      whiteSpace: 'nowrap'
    },
    td: {
      padding: 10,
      borderBottom: '1px solid #eef2f7',
      verticalAlign: 'middle'
    },
    badge: (status) => {
      const opt = STATUS_OPTIONS.find(s => s.value === status)
      if (!opt) return {
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 900,
        background: '#f3f4f6',
        color: '#6b7280',
        border: '1px solid #d1d5db'
      }
      return {
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 900,
        background: opt.bg,
        color: opt.color,
        border: `1px solid ${opt.bd}`
      }
    },
    newRowForm: {
      background: '#f8fafc',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 12
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    },
    label: {
      fontSize: 11,
      fontWeight: 900,
      color: '#374151'
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>
            <span>📊</span>
            Gestión de Inspecciones - Google Sheets
            <span style={styles.statusBadge(configured)}>
              {configured ? '✅ Conectado' : '⚠️ Sin configurar'}
            </span>
          </h2>
          <p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>
            {configured ? `${inspecciones.length} inspecciones en el Sheet` : 'Configura Google Sheets para comenzar'}
          </p>
        </div>

        <div style={styles.buttonGroup}>
          {configured && (
            <>
              <button
                style={styles.btn('secondary')}
                onClick={() => setShowNewRow(!showNewRow)}
              >
                {showNewRow ? '❌ Cancelar' : '➕ Nueva Fila'}
              </button>

              <button
                style={styles.btn('primary', syncing)}
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? '⏳ Sincronizando...' : '🔄 Importar a BD'}
              </button>

              <button
                style={styles.btn('outline', loading)}
                onClick={loadFromSheet}
                disabled={loading}
              >
                {loading ? '⏳ Cargando...' : '🔃 Recargar'}
              </button>
            </>
          )}

          <button
            style={styles.btn('gray')}
            onClick={() => setShowConfig(!showConfig)}
          >
            ⚙️ {showConfig ? 'Ocultar Config' : 'Configurar'}
          </button>
        </div>
      </div>

      {/* Última sincronización */}
      {configured && lastSync && !showConfig && (
        <div style={styles.infoBox}>
          📅 Última importación: {lastSync.toLocaleDateString('es-CL')} {lastSync.toLocaleTimeString('es-CL')}
          {syncStats && ` • ${syncStats.nuevas} nuevas • ${syncStats.errores} errores`}
        </div>
      )}

      {/* Configuración */}
      {showConfig && (
        <div style={styles.configBox}>
          <h3 style={{ margin: '0 0 12px', color: '#2E7D32', fontSize: 16 }}>
            ⚙️ Configuración de Google Sheets
          </h3>

          <div style={{ fontSize: 12, color: '#667085', marginBottom: 12, lineHeight: 1.6 }}>
            1. Crea un Google Sheet con columnas: Productor | Lote | Variedad | Commodity | Inspector | Estado | ID Inspección
            <br />
            2. Comparte el Sheet con el email de servicio (ver documentación)
            <br />
            3. Configura las variables de entorno en .env.local
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 900, color: '#374151', display: 'block', marginBottom: 6 }}>
              URL del Google Sheet (opcional)
            </label>
            <input
              style={styles.input}
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button style={styles.btn('primary')} onClick={saveConfig}>
              💾 Guardar
            </button>

            <button style={styles.btn('secondary')} onClick={testConnection}>
              🧪 Probar Conexión
            </button>

            <button style={styles.btn('gray')} onClick={() => setShowConfig(false)}>
              ❌ Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Alerta si no está configurado */}
      {!configured && !showConfig && (
        <div style={{ 
          background: '#fff7ed', 
          borderRadius: 12, 
          padding: 16, 
          border: '1px solid #fed7aa'
        }}>
          <div style={{ color: '#c2410c', fontWeight: 900, marginBottom: 8 }}>
            ⚠️ Configuración pendiente
          </div>
          <div style={{ color: '#9a3412', fontSize: 13, lineHeight: 1.6 }}>
            Para usar Google Sheets, configura las variables de entorno en .env.local y haz clic en "Configurar".
          </div>
        </div>
      )}

      {/* Formulario nueva fila */}
      {configured && showNewRow && (
        <div style={styles.newRowForm}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Productor *</label>
            <input
              style={styles.input}
              value={newInspection.producer}
              onChange={(e) => setNewInspection(prev => ({ ...prev, producer: e.target.value }))}
              placeholder="Ej: Agrícola Norte"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Lote *</label>
            <input
              style={styles.input}
              value={newInspection.lot}
              onChange={(e) => setNewInspection(prev => ({ ...prev, lot: e.target.value }))}
              placeholder="Ej: LOTE-001"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Variedad</label>
            <input
              style={styles.input}
              value={newInspection.variety}
              onChange={(e) => setNewInspection(prev => ({ ...prev, variety: e.target.value }))}
              placeholder="Ej: Uva Thompson"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Commodity</label>
            <input
              style={styles.input}
              value={newInspection.commodity}
              onChange={(e) => setNewInspection(prev => ({ ...prev, commodity: e.target.value }))}
              placeholder="Ej: 0805"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Inspector</label>
            <select
              style={styles.input}
              value={newInspection.inspector}
              onChange={(e) => setNewInspection(prev => ({ ...prev, inspector: e.target.value }))}>
                <option value="">Sin asignar</option>
                {inspectores.map(inspector => (
                  <option key={inspector.id} value={inspector.email}>
                    {inspector.name}
                  </option>
                ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Estado</label>
            <select
              style={styles.input}
              value={newInspection.estado}
              onChange={(e) => setNewInspection(prev => ({ ...prev, estado: e.target.value }))}>
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button style={styles.btn('primary')} onClick={handleAddRow}>
              ✅ Agregar
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      {configured && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Productor</th>
                <th style={styles.th}>Lote</th>
                <th style={styles.th}>Variedad</th>
                <th style={styles.th}>Commodity</th>
                <th style={styles.th}>Inspector</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ ...styles.td, textAlign: 'center', padding: 30 }}>
                    ⏳ Cargando...
                  </td>
                </tr>
              ) : inspecciones.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...styles.td, textAlign: 'center', padding: 30, color: '#667085' }}>
                    No hay inspecciones. Agrega una nueva o sincroniza desde Google Sheets.
                  </td>
                </tr>
              ) : (
                inspecciones.map((insp, idx) => (
                  <tr key={idx}>
                    {/* PRODUCTOR - ahora es input de texto libre */}
                    <td style={styles.td}>
                      {editingRow === idx ? (
                        <input
                          style={styles.input}
                          value={insp.Productor || ''}
                          onChange={(e) => updateField(idx, 'Productor', e.target.value)}
                          placeholder="Nombre del productor"
                        />
                      ) : (
                        <span>{insp.Productor || '--'}</span>
                      )}
                    </td>
                    
                    <td style={styles.td}>
                      {editingRow === idx ? (
                        <input
                          style={styles.input}
                          value={insp.Lote || ''}
                          onChange={(e) => updateField(idx, 'Lote', e.target.value)}
                        />
                      ) : (
                        <strong>{insp.Lote || '--'}</strong>
                      )}
                    </td>

                    <td style={styles.td}>
                      {editingRow === idx ? (
                        <input
                          style={styles.input}
                          value={insp.Variedad || ''}
                          onChange={(e) => updateField(idx, 'Variedad', e.target.value)}
                        />
                      ) : (
                        insp.Variedad || '--'
                      )}
                    </td>

                    <td style={styles.td}>
                      {editingRow === idx ? (
                        <input
                          style={styles.input}
                          value={insp.Commodity || ''}
                          onChange={(e) => updateField(idx, 'Commodity', e.target.value)}
                        />
                      ) : (
                        insp.Commodity || '--'
                      )}
                    </td>

                    <td style={styles.td}>
                      {editingRow === idx ? (
                        <select
                          style={styles.input}
                          value={insp.Inspector || ''}
                          onChange={(e) => updateField(idx, 'Inspector', e.target.value)}
                        >
                          <option value="">Sin asignar</option>
                          {inspectores.map(inspector => (
                            <option key={inspector.id} value={inspector.email}>
                              {inspector.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontSize: 12 }}>{insp.Inspector || '--'}</span>
                      )}
                    </td>

                    {/* ESTADO - ahora es editable con dropdown */}
                    <td style={styles.td}>
                      {editingRow === idx ? (
                        <select
                          style={styles.input}
                          value={insp.Estado || 'Pendiente'}
                          onChange={(e) => updateField(idx, 'Estado', e.target.value)}
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span style={styles.badge(insp.Estado || 'Pendiente')}>
                          {STATUS_OPTIONS.find(s => s.value === insp.Estado)?.label || insp.Estado || '🟡 Pendiente'}
                        </span>
                      )}
                    </td>

                    <td style={styles.td}>
                      <span style={{ fontSize: 11, color: '#667085' }}>
                        {insp['ID Inspección'] || insp.ID || '--'}
                      </span>
                    </td>

                    <td style={styles.td}>
                      {editingRow === idx ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            style={styles.btn('primary')}
                            onClick={() => handleSaveEdit(idx)}
                          >
                            💾
                          </button>
                          <button
                            style={styles.btn('gray')}
                            onClick={handleCancelEdit}
                          >
                            ❌
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            style={styles.btn('outline')}
                            onClick={() => handleEditRow(idx)}
                          >
                            ✏️
                          </button>
                          <button
                            style={styles.btn('danger')}
                            onClick={() => handleDeleteRow(idx)}
                          >
                            🗑️
                          </button>
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