'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setToken } from '@/lib/auth/clientToken'

export default function PortalLogin() {
  const router = useRouter()
  const [mode, setMode] = useState(null) // null | 'admin' | 'inspector'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const expectedRole = mode

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!expectedRole) return

    setLoading(true)

    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim()
        })
      })

      const data = await r.json()
      if (!r.ok) throw new Error(data?.msg || 'Error de login')

      if (data.role !== expectedRole) {
        throw new Error(
          expectedRole === 'admin'
            ? 'Este acceso es solo para Administración.'
            : 'Este acceso es solo para Operaciones (Inspector).'
        )
      }

      setToken(data.token)

      if (data.role === 'admin') router.push('/admin')
      if (data.role === 'inspector') router.push('/inspecciones/nueva')
    } catch (err) {
      alert(err?.message || 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.wrap}>
      {/* TOP BAR */}
      <div style={styles.topbar}>
        <img src="/logo-insproduce.png" alt="Insproduce" style={styles.logo} />
      </div>

      <div style={styles.grid}>
        {/* ADMIN */}
        <section
          style={{
            ...styles.panel,
            backgroundImage:
              "linear-gradient(rgba(232,176,74,.72), rgba(232,176,74,.72)), url('/bg-admin.jpg')"
          }}
        >
          <div style={styles.panelContent}>
            <div style={styles.kicker}>ADMINISTRACIÓN</div>
            <h1 style={styles.title}>GESTIÓN Y REPORTES</h1>
            <p style={styles.desc}>
              Monitoreo de calidad, análisis de datos en Azure SQL y visualización de indicadores clave.
            </p>

            {mode !== 'admin' ? (
              <button
                style={styles.btnGhost}
                onClick={() => setMode('admin')}
              >
                VER DASHBOARD
              </button>
            ) : (
              <LoginCard
                title="Iniciar sesión — Administración"
                email={email}
                password={password}
                setEmail={setEmail}
                setPassword={setPassword}
                loading={loading}
                onSubmit={handleLogin}
                onBack={() => setMode(null)}
                themeColor="#E8B04A"
              />
            )}
          </div>
        </section>

        {/* INSPECTOR */}
        <section
          style={{
            ...styles.panel,
            backgroundImage:
              "linear-gradient(rgba(46,125,50,.72), rgba(46,125,50,.72)), url('/bg-ops.jpg')"
          }}
        >
          <div style={styles.panelContent}>
            <div style={styles.kicker}>OPERACIONES</div>
            <h1 style={styles.title}>INSPECCIÓN DE CAMPO</h1>
            <p style={styles.desc}>
              Registro rápido de auditorías, documentación y reportes de estado de fruta.
            </p>

            {mode !== 'inspector' ? (
              <button
                style={styles.btnGhost}
                onClick={() => setMode('inspector')}
              >
                NUEVA INSPECCIÓN
              </button>
            ) : (
              <LoginCard
                title="Iniciar sesión — Operaciones"
                email={email}
                password={password}
                setEmail={setEmail}
                setPassword={setPassword}
                loading={loading}
                onSubmit={handleLogin}
                onBack={() => setMode(null)}
                themeColor="#2E7D32"
              />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function LoginCard({
  title,
  email,
  password,
  setEmail,
  setPassword,
  loading,
  onSubmit,
  onBack,
  themeColor
}) {
  return (
    <form onSubmit={onSubmit} style={styles.card}>
      <div style={styles.cardHeader}>
        <strong>{title}</strong>
        <button
          type="button"
          onClick={onBack}
          style={styles.backBtn}
        >
          Volver
        </button>
      </div>

      <input
        style={{ ...styles.input, borderColor: themeColor }}
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <input
        style={{ ...styles.input, borderColor: themeColor }}
        placeholder="Contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <button
        disabled={loading}
        type="submit"
        style={{
          ...styles.btnSolid,
          background: themeColor
        }}
      >
        {loading ? 'INGRESANDO...' : 'INICIAR SESIÓN'}
      </button>
    </form>
  )
}

const styles = {
  wrap: {
    minHeight: '100vh',
    background: '#fff'
  },

  topbar: {
    height: 90,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },

  logo: {
    height: 60,
    width: 'auto',
    objectFit: 'contain'
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    minHeight: 'calc(100vh - 90px)'
  },

  panel: {
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: '#fff',
    display: 'flex'
  },

  panelContent: {
    width: '100%',
    padding: 48,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center'
  },

  kicker: {
    letterSpacing: 4,
    opacity: 0.9,
    fontSize: 12
  },

  title: {
    margin: 0,
    fontSize: 44,
    lineHeight: 1.05,
    fontWeight: 800
  },

  desc: {
    margin: 0,
    maxWidth: 520,
    opacity: 0.95
  },

  btnGhost: {
    marginTop: 10,
    background: 'transparent',
    color: '#fff',
    border: '2px solid rgba(255,255,255,.75)',
    padding: '12px 26px',
    borderRadius: 14,
    fontWeight: 800,
    cursor: 'pointer'
  },

  card: {
    marginTop: 18,
    width: 620,
    maxWidth: '95%',
    background: 'rgba(255,255,255,.92)',
    color: '#111',
    borderRadius: 16,
    padding: 18,
    boxShadow: '0 10px 30px rgba(0,0,0,.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  backBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontWeight: 700
  },

  input: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    border: '2px solid',
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#111827'
  },

  btnSolid: {
    marginTop: 4,
    color: '#fff',
    border: 'none',
    padding: 14,
    borderRadius: 12,
    fontWeight: 900,
    cursor: 'pointer'
  }
}
