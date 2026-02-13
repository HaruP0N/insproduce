'use client'

import React, { useState, useEffect } from 'react'

/**
 * Componente para sincronizar inspecciones con Google Sheets
 */
export default function SincronizarGoogleSheets({ onSyncSuccess }) {
  const [syncing, setSyncing] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [stats, setStats] = useState(null)
  const [sheetUrl, setSheetUrl] = useState('')
  const [showConfig, setShowConfig] = useState(false)

  useEffect(() => {
    checkConfiguration()
    loadLastSync()
  }, [])

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

  const handleSync = async () => {
    if (!configured) {
      alert('⚠️ Primero debes configurar la conexión con Google Sheets')
      setShowConfig(true)
      return
    }

    setSyncing(true)
    setStats(null)

    try {
      const res = await fetch('/api/google-sheets/sync', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.msg || 'Error al sincronizar')
      }

      setStats(data)
      setLastSync(new Date())
      
      alert(`✅ Sincronización completada:\n- ${data.nuevas} inspecciones creadas\n- ${data.actualizadas} actualizadas\n- ${data.errores} errores`)

      if (onSyncSuccess) onSyncSuccess()

    } catch (err) {
      console.error(err)
      alert('❌ ' + err.message)
    } finally {
      setSyncing(false)
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

    } catch (err) {
      alert('❌ ' + err.message)
    }
  }

  const testConnection = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/google-sheets/test', {
        credentials: 'include'
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data?.msg || 'Error en la conexión')

      alert(`✅ Conexión exitosa!\n\nSheet: ${data.title}\nFilas: ${data.rowCount}`)

    } catch (err) {
      alert('❌ Error: ' + err.message)
    } finally {
      setSyncing(false)
    }
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
      if (variant === 'outline') return { ...base, background: '#fff', border: '2px solid #2E7D32', color: '#2E7D32' }
      if (variant === 'secondary') return { ...base, background: '#1565c0', color: '#fff' }
      if (variant === 'gray') return { ...base, background: '#64748b', color: '#fff' }
      return base
    },
    infoBox: {
      background: '#f8fafc',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16
    },
    infoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid #e5e7eb'
    },
    infoLabel: {
      color: '#667085',
      fontSize: 13
    },
    infoValue: {
      color: '#111827',
      fontWeight: 900,
      fontSize: 14
    },
    configBox: {
      background: '#f8fafc',
      borderRadius: 12,
      padding: 16,
      marginTop: 16
    },
    input: {
      width: '100%',
      padding: 12,
      borderRadius: 10,
      border: '1px solid #e5e7eb',
      fontSize: 14,
      marginBottom: 12,
      boxSizing: 'border-box'
    },
    helpText: {
      fontSize: 12,
      color: '#667085',
      marginBottom: 12,
      lineHeight: 1.5
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>
            <span>📊</span>
            Google Sheets
            <span style={styles.statusBadge(configured)}>
              {configured ? '✅ Configurado' : '⚠️ Sin configurar'}
            </span>
          </h2>
          <p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>
            Sincroniza inspecciones desde tu Google Sheet
          </p>
        </div>

        <div style={styles.buttonGroup}>
          {configured && (
            <button
              style={styles.btn('primary', syncing)}
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? '⏳ Sincronizando...' : '🔄 Sincronizar Ahora'}
            </button>
          )}

          <button
            style={styles.btn('outline')}
            onClick={() => setShowConfig(!showConfig)}
          >
            ⚙️ {showConfig ? 'Ocultar' : 'Configurar'}
          </button>
        </div>
      </div>

      {/* Info de última sincronización */}
      {configured && lastSync && !showConfig && (
        <div style={styles.infoBox}>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Última sincronización</span>
            <span style={styles.infoValue}>
              {lastSync.toLocaleDateString('es-CL')} {lastSync.toLocaleTimeString('es-CL')}
            </span>
          </div>
          {stats && (
            <>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Nuevas inspecciones</span>
                <span style={styles.infoValue}>{stats.nuevas}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Actualizadas</span>
                <span style={styles.infoValue}>{stats.actualizadas}</span>
              </div>
              {stats.errores > 0 && (
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Errores</span>
                  <span style={{ ...styles.infoValue, color: '#c62828' }}>{stats.errores}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Configuración */}
      {showConfig && (
        <div style={styles.configBox}>
          <h3 style={{ margin: '0 0 12px', color: '#2E7D32', fontSize: 16 }}>
            Configuración de Google Sheets
          </h3>

          <div style={styles.helpText}>
            📝 <strong>Paso 1:</strong> Crea un Google Sheet con estas columnas:
            <br />
            • Productor | Lote | Variedad | Commodity | Inspector | Estado | ID Inspección
          </div>

          <div style={styles.helpText}>
            🔗 <strong>Paso 2:</strong> Comparte el Sheet con el email de servicio (ver documentación)
          </div>

          <div style={styles.helpText}>
            🔑 <strong>Paso 3:</strong> Configura las variables de entorno en .env.local
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 900, color: '#374151', display: 'block', marginBottom: 6 }}>
              URL del Google Sheet
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
            <button
              style={styles.btn('primary')}
              onClick={saveConfig}
            >
              💾 Guardar Configuración
            </button>

            <button
              style={styles.btn('secondary', syncing)}
              onClick={testConnection}
              disabled={syncing}
            >
              {syncing ? '⏳ Probando...' : '🧪 Probar Conexión'}
            </button>

            <button
              style={styles.btn('gray')}
              onClick={() => setShowConfig(false)}
            >
              ❌ Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Ayuda */}
      {!configured && !showConfig && (
        <div style={{ 
          background: '#fff7ed', 
          borderRadius: 12, 
          padding: 16, 
          border: '1px solid #fed7aa',
          marginTop: 16
        }}>
          <div style={{ color: '#c2410c', fontWeight: 900, marginBottom: 8 }}>
            ⚠️ Configuración pendiente
          </div>
          <div style={{ color: '#9a3412', fontSize: 13, lineHeight: 1.6 }}>
            Para usar Google Sheets, necesitas:
            <br />
            1. Configurar Google Cloud API (ver documentación)
            <br />
            2. Agregar variables de entorno en .env.local
            <br />
            3. Hacer clic en "Configurar" para conectar tu Sheet
          </div>
        </div>
      )}
    </div>
  )
}