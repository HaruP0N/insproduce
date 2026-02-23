'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import InspeccionesTab  from './inspecciones/InspeccionesTab'
import TrabajadoresTab  from './trabajadores/TrabajadoresTab'

// ─── PanelAdmin ───────────────────────────────────────────────────────────────
// Solo se ocupa de: layout, navegación de tabs, logout.
// Toda la lógica de negocio vive en las tabs correspondientes.

const TABS = [
  { value: 'inspecciones', label: '📋 Inspecciones' },
  { value: 'trabajadores', label: '👥 Trabajadores'  }
]

export default function PanelAdmin() {
  const router = useRouter()
  const [tab, setTab]           = useState('inspecciones')
  const [loggingOut, setLoggingOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f0' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '16px 18px' }}>

        {/* ── Navbar ── */}
        <nav style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#fff', borderRadius: 16, padding: '10px 16px',
          border: '1px solid #e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          marginBottom: 16, flexWrap: 'wrap', gap: 10
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8 }}>
            {TABS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                style={{
                  padding: '9px 16px', borderRadius: 12, cursor: 'pointer',
                  border: '1px solid',
                  borderColor: tab === value ? '#16a34a' : '#e5e7eb',
                  background:  tab === value ? '#f0fdf4'  : '#fff',
                  color:       tab === value ? '#15803d'  : '#374151',
                  fontWeight: 900, fontSize: 13
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Avatar + menú logout */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: '#fef9c3', border: '1px solid #fcd34d',
                cursor: 'pointer', fontSize: 17, fontWeight: 900, color: '#92400e'
              }}
            >
              A
            </button>

            {menuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setMenuOpen(false)} />
                <div style={{
                  position: 'absolute', top: 48, right: 0, zIndex: 999,
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
                  boxShadow: '0 8px 28px rgba(0,0,0,0.12)', minWidth: 190, padding: 6
                }}>
                  <div style={{ padding: '8px 14px', fontSize: 12, color: '#9ca3af', borderBottom: '1px solid #f1f5f9', marginBottom: 4 }}>
                    Admin
                  </div>
                  <button
                    onClick={logout}
                    disabled={loggingOut}
                    style={{
                      display: 'flex', width: '100%', padding: '9px 14px',
                      borderRadius: 8, border: 'none', background: 'transparent',
                      color: '#dc2626', fontWeight: 700, fontSize: 13,
                      cursor: 'pointer', gap: 8, alignItems: 'center'
                    }}
                  >
                    {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
                  </button>
                </div>
              </>
            )}
          </div>
        </nav>

        {/* ── Contenido de la tab activa ── */}
        {tab === 'inspecciones' ? <InspeccionesTab /> : <TrabajadoresTab />}
      </div>
    </div>
  )
}