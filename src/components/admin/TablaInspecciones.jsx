'use client'

import React, { useState, useEffect } from 'react'

/**
 * Componente de tabla editable sincronizada con Google Sheets
 */
export default function TablaInspecciones({ onSyncSuccess }) {
  const [inspecciones, setInspecciones] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [configured, setConfigured] = useState(false)

  // Formulario para nueva inspección
  const [showNewRow, setShowNewRow] = useState(false)
  const [newInspection, setNewInspection] = useState({
    producer: '',
    lot: '',
    variety: '',
    commodity: '',
    inspector: ''
  })

  useEffect(() => {
    checkConfiguration()
    loadFromSheet()
  }, [])

  const checkConfiguration = async () => {
    try {
      const res = await fetch('/api/google-sheets/config', {
        credentials: 'include'
      })
      const data = await res.json()
      setConfigured(data.configured)
    } catch (err) {
      console.error('Error checking config:', err)
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

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/google-sheets/sync', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data?.msg || 'Error al sincronizar')

      alert(`✅ ${data.nuevas} inspecciones importadas`)
      
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
      setNewInspection({ producer: '', lot: '', variety: '', commodity: '', inspector: '' })
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
            inspector: insp.Inspector
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
    loadFromSheet() // Recargar para deshacer cambios
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
      fontWeight: 900
    },
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
    input: {
      width: '100%',
      padding: 8,
      borderRadius: 8,
      border: '1px solid #e5e7eb',
      fontSize: 13,
      boxSizing: 'border-box'
    },
    badge: (status) => {
      const colors = {
        'Importada': { bg: '#e8f5e9', fg: '#2E7D32', bd: '#a7d7ad' },
        'Pendiente': { bg: '#fff7ed', fg: '#c2410c', bd: '#fed7aa' },
        '': { bg: '#f3f4f6', fg: '#6b7280', bd: '#d1d5db' }
      }
      const c = colors[status] || colors['']
      return {
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 900,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.bd}`
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

  if (!configured) {
    return (
      <div style={styles.container}>
        <div style={{ 
          background: '#fff7ed', 
          borderRadius: 12, 
          padding: 16, 
          border: '1px solid #fed7aa'
        }}>
          <div style={{ color: '#c2410c', fontWeight: 900, marginBottom: 8 }}>
            ⚠️ Google Sheets no configurado
          </div>
          <div style={{ color: '#9a3412', fontSize: 13 }}>
            Por favor configura Google Sheets primero en la sección de arriba.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>📋 Gestión de Inspecciones</h2>
          <p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>
            {inspecciones.length} inspecciones en Google Sheets
          </p>
        </div>

        <div style={styles.buttonGroup}>
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
            {syncing ? '⏳ Sincronizando...' : '🔄 Sincronizar'}
          </button>

          <button
            style={styles.btn('outline', loading)}
            onClick={loadFromSheet}
            disabled={loading}
          >
            {loading ? '⏳ Cargando...' : '🔃 Recargar'}
          </button>
        </div>
      </div>

      {/* Formulario nueva fila */}
      {showNewRow && (
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
            <label style={styles.label}>Inspector (email)</label>
            <input
              style={styles.input}
              type="email"
              value={newInspection.inspector}
              onChange={(e) => setNewInspection(prev => ({ ...prev, inspector: e.target.value }))}
              placeholder="inspector@email.com"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button
              style={styles.btn('primary')}
              onClick={handleAddRow}
            >
              ✅ Agregar
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
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
                  <td style={styles.td}>
                    {editingRow === idx ? (
                      <input
                        style={styles.input}
                        value={insp.Productor || ''}
                        onChange={(e) => updateField(idx, 'Productor', e.target.value)}
                      />
                    ) : (
                      insp.Productor || '--'
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
                      <input
                        style={styles.input}
                        type="email"
                        value={insp.Inspector || ''}
                        onChange={(e) => updateField(idx, 'Inspector', e.target.value)}
                      />
                    ) : (
                      <span style={{ fontSize: 12 }}>{insp.Inspector || '--'}</span>
                    )}
                  </td>

                  <td style={styles.td}>
                    <span style={styles.badge(insp.Estado || '')}>
                      {insp.Estado || 'Pendiente'}
                    </span>
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
    </div>
  )
}