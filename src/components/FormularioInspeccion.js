// src/components/FormularioInspeccion.js
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getToken } from '@/lib/auth/clientToken'

export default function FormularioInspeccion() {
  const router = useRouter()
  const pathname = usePathname()

  const [booting, setBooting] = useState(true)     // validando sesión
  const [user, setUser] = useState(null)           // {id,email,role}
  const [token, setTokenState] = useState('')      // token desde localStorage

  const [loading, setLoading] = useState(false)

  // commodities + template
  const [commodities, setCommodities] = useState([])
  const [commodityCode, setCommodityCode] = useState('')
  const [template, setTemplate] = useState(null)
  const [fields, setFields] = useState([])
  const [values, setValues] = useState({}) // key -> value

  // cabecera (igual que tu backend nuevo)
  const [header, setHeader] = useState({
    producer: '',
    lot: '',
    variety: '',
    caliber: '',
    packaging_code: '',
    packaging_type: '',
    packaging_date: '',
    net_weight: '',
    brix_avg: '',
    temp_water: '',
    temp_ambient: '',
    temp_pulp: '',
    notes: ''
  })

  // -----------------------
  // 1) bootstrap: valida sesión por cookie (/api/auth/me)
  //    y además lee token desde localStorage (para fetch con Bearer)
  // -----------------------
  useEffect(() => {
    let alive = true

    const run = async () => {
      setBooting(true)

      // lee token del localStorage (para endpoints protegidos por Bearer)
      const t = getToken()
      if (alive) setTokenState(t)

      try {
        // /api/auth/me usa verifyTokenFromRequest => OJO:
        // eso lee Authorization header, NO cookie.
        // Entonces acá hacemos:
        // - si tenemos token localStorage => lo mandamos por Authorization
        // - si no, igual intentamos sin header (por si después migras verifyTokenFromRequest a cookies)
        const r = await fetch('/api/auth/me')
        const data = await r.json().catch(() => ({}))

        if (!r.ok || !data?.ok) throw new Error(data?.msg || 'Sesión inválida')

        if (alive) setUser(data.user)
      } catch (e) {
        // si no hay sesión válida, manda a login
        const next = pathname || '/ops'
        router.replace(`/login?next=${encodeURIComponent(next)}`)
        return
      } finally {
        if (alive) setBooting(false)
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [router, pathname])

  // headers auth para el resto de endpoints
  const authHeaders = useMemo(() => {
    if (!token) return {}
    return { Authorization: 'Bearer ' + token }
  }, [token])

  // -----------------------
  // 2) cargar commodities
  // -----------------------
  useEffect(() => {
    let alive = true

    const run = async () => {
      try {
        const res = await fetch('/api/commodities', { headers: authHeaders })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.msg || 'Error commodities')

        if (!alive) return
        setCommodities(Array.isArray(data) ? data : [])
        if (Array.isArray(data) && data.length) setCommodityCode(data[0].code)
      } catch (e) {
        console.error(e)
        alert('No se pudieron cargar commodities. Revisa sesión/token.')
      }
    }

    if (token) run()
    return () => {
      alive = false
    }
  }, [token, authHeaders])

  // -----------------------
  // 3) cargar template por commodity
  // -----------------------
  useEffect(() => {
    let alive = true
    if (!commodityCode) return
    if (!token) return

    const run = async () => {
      try {
        setTemplate(null)
        setFields([])
        setValues({})

        // 🔧 CORREGIDO: agregamos /code/ en la ruta
        const res = await fetch(`/api/metric-templates/code/${commodityCode}`, { 
          headers: authHeaders 
        })
        
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.msg || 'Error template')

        if (!alive) return
        setTemplate(data.template || null)
        setFields(Array.isArray(data.fields) ? data.fields : [])

        // init values
        const init = {}
        ;(data.fields || []).forEach((f) => {
          init[f.key] = ''
        })
        setValues(init)
      } catch (e) {
        console.error(e)
        alert(`No se pudo cargar la template para ${commodityCode}`)
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [commodityCode, token, authHeaders])

  const handleHeader = (e) => {
    const { name, value } = e.target
    setHeader((prev) => ({ ...prev, [name]: value }))
  }

  const handleField = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const renderInput = (f) => {
    const v = values[f.key] ?? ''

    if (f.field_type === 'select') {
      return (
        <select
          value={v}
          onChange={(e) => handleField(f.key, e.target.value)}
          style={styles.input}
          required={!!f.required}
        >
          <option value="">-- Seleccionar --</option>
          {(f.options || []).map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
      )
    }

    if (f.field_type === 'number') {
      return (
        <input
          type="number"
          value={v}
          onChange={(e) => handleField(f.key, e.target.value)}
          style={styles.input}
          min={f.min_value ?? undefined}
          max={f.max_value ?? undefined}
          step="0.01"
          required={!!f.required}
        />
      )
    }

    return (
      <input
        type="text"
        value={v}
        onChange={(e) => handleField(f.key, e.target.value)}
        style={styles.input}
        required={!!f.required}
      />
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!commodityCode) return alert('Selecciona commodity')

    setLoading(true)
    try {
      const payload = {
        commodity_code: commodityCode,

        producer: header.producer || null,
        lot: header.lot || null,
        variety: header.variety || null,
        caliber: header.caliber || null,

        packaging_code: header.packaging_code || null,
        packaging_type: header.packaging_type || null,
        packaging_date: header.packaging_date || null,

        net_weight: header.net_weight === '' ? null : Number(header.net_weight),
        brix_avg: header.brix_avg === '' ? null : Number(header.brix_avg),
        temp_water: header.temp_water === '' ? null : Number(header.temp_water),
        temp_ambient: header.temp_ambient === '' ? null : Number(header.temp_ambient),
        temp_pulp: header.temp_pulp === '' ? null : Number(header.temp_pulp),

        notes: header.notes || null,

        // acá mandamos SOLO las values dinámicas (tu backend ya las serializa)
        metrics: values
      }

      const res = await fetch('/api/inspecciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.msg || 'Error creando inspección')

      alert(`✓ Inspección guardada (ID: ${data.id}). PDF: PENDING`)

      // opcional: limpiar formulario, dejar commodity igual
      setHeader((prev) => ({
        ...prev,
        producer: '',
        lot: '',
        variety: '',
        caliber: '',
        packaging_code: '',
        packaging_type: '',
        packaging_date: '',
        net_weight: '',
        brix_avg: '',
        temp_water: '',
        temp_ambient: '',
        temp_pulp: '',
        notes: ''
      }))
      setValues((prev) => {
        const cleared = {}
        Object.keys(prev || {}).forEach((k) => (cleared[k] = ''))
        return cleared
      })
    } catch (err) {
      console.error(err)
      alert(err?.message || 'Error al guardar inspección')
    } finally {
      setLoading(false)
    }
  }

  // -----------------------
  // UI states
  // -----------------------
  if (booting) {
    return (
      <div style={{ padding: 24, fontFamily: 'Segoe UI, Roboto, sans-serif' }}>
        Cargando sesión...
      </div>
    )
  }

  // si llegara acá sin user (por alguna razón), redirigimos
  if (!user) {
    return (
      <div style={{ padding: 24, fontFamily: 'Segoe UI, Roboto, sans-serif' }}>
        Redirigiendo a login...
      </div>
    )
  }

  // si quieres forzar que solo inspector use este form:
  if (user.role !== 'inspector') {
    return (
      <div style={{ padding: 24, fontFamily: 'Segoe UI, Roboto, sans-serif' }}>
        <h2>Acceso restringido</h2>
        <p>Esta vista es solo para Operaciones (Inspector).</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.headerBar}>
          <h1 style={{ margin: 0, fontSize: 22 }}>INSPRODUCE — INSPECCIÓN</h1>
          <p style={{ margin: '6px 0 0', opacity: 0.9 }}>
            Operaciones • {user.email}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* commodity */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Selección de Producto</div>

            <label style={styles.label}>Commodity</label>
            <select
              value={commodityCode}
              onChange={(e) => setCommodityCode(e.target.value)}
              style={styles.input}
              required
            >
              {commodities.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>

            <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
              Template:{' '}
              <strong>{template ? `${template.name} (v${template.version})` : '—'}</strong>
            </div>
          </div>

          {/* header */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Identificación del Lote</div>

            <div style={styles.grid}>
              {[
                ['producer', 'Productor', true, 'text'],
                ['lot', 'Lote / Serie', true, 'text'],
                ['variety', 'Variedad', false, 'text'],
                ['caliber', 'Calibre', false, 'text'],
                ['packaging_code', 'Cod. Embalaje', false, 'text'],
                ['packaging_type', 'Tipo Embalaje', false, 'text'],
                ['packaging_date', 'Fecha Embalaje', false, 'date'],

                ['net_weight', 'Peso neto', false, 'number'],
                ['brix_avg', 'Brix prom.', false, 'number'],
                ['temp_water', 'Temp agua', false, 'number'],
                ['temp_ambient', 'Temp ambiente', false, 'number'],
                ['temp_pulp', 'Temp pulpa', false, 'number'],

                ['notes', 'Notas', false, 'text']
              ].map(([k, label, req, type]) => (
                <div key={k}>
                  <label style={styles.label}>{label}</label>
                  <input
                    type={type}
                    name={k}
                    value={header[k]}
                    onChange={handleHeader}
                    style={styles.input}
                    required={!!req}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* template fields */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Parámetros (Template)</div>

            <div style={styles.grid}>
              {fields.map((f) => (
                <div key={f.key}>
                  <label style={styles.label}>
                    {f.label}
                    {f.unit ? ` (${f.unit})` : ''}
                    {f.required ? ' *' : ''}
                  </label>
                  {renderInput(f)}
                </div>
              ))}
              {fields.length === 0 && (
                <div style={{ color: '#666', fontSize: 13 }}>
                  No hay fields definidos para este commodity/template.
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '0 22px 22px' }}>
            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? 'GUARDANDO...' : 'GUARDAR INSPECCIÓN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f4f7f4',
    padding: 20,
    fontFamily: 'Segoe UI, Roboto, sans-serif'
  },
  card: {
    maxWidth: 1100,
    margin: '0 auto',
    backgroundColor: '#fff',
    borderRadius: 12,
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    overflow: 'hidden'
  },
  headerBar: {
    backgroundColor: '#2E7D32',
    color: '#fff',
    padding: 24,
    textAlign: 'center',
    borderBottom: '6px solid #FFB300'
  },
  section: {
    padding: 22,
    borderBottom: '1px solid #eee'
  },
  sectionTitle: {
    color: '#2E7D32',
    marginBottom: 14,
    fontSize: '1.05rem',
    fontWeight: 'bold'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 14
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 6,
    textTransform: 'uppercase'
  },
  input: {
    width: '100%',
    padding: 10,
    borderRadius: 8,
    border: '1px solid #ccc',
    boxSizing: 'border-box',
    fontSize: 14,
    outlineColor: '#4CAF50',
    backgroundColor: '#ffffff',
    color: '#111827'
  },
  button: {
    width: '100%',
    padding: 16,
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 'bold',
    cursor: 'pointer'
  }
}