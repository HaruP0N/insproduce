// src/components/FormularioInspeccion.js
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { getToken } from '@/lib/auth/clientToken'
import ImageUploader from './ImageUploader'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE COMMODITIES
// ═══════════════════════════════════════════════════════════════════════════
const COMMODITY_THEMES = {
  BLUEBERRY: { name: 'Arándano', icon: '🫐', color: '#6366f1', lightBg: '#eef2ff', darkBg: '#e0e7ff' },
  RASPBERRY: { name: 'Frambuesa', icon: '🍓', color: '#ec4899', lightBg: '#fdf2f8', darkBg: '#fce7f3' },
  STRAWBERRY: { name: 'Frutilla', icon: '🍓', color: '#ef4444', lightBg: '#fef2f2', darkBg: '#fee2e2' },
  BLACKBERRY: { name: 'Mora', icon: '🫐', color: '#7c3aed', lightBg: '#faf5ff', darkBg: '#f3e8ff' },
  RED_CURRANTS: { name: 'Grosella', icon: '🔴', color: '#dc2626', lightBg: '#fef2f2', darkBg: '#fee2e2' },
  REDCURRANT: { name: 'Grosella', icon: '🔴', color: '#dc2626', lightBg: '#fef2f2', darkBg: '#fee2e2' }
}

const METRIC_GROUPS = {
  quality: { label: '🔬 Calidad', description: 'Métricas de calidad del producto', color: '#15803d' },
  condition: { label: '🩺 Condición', description: 'Estado físico y condición', color: '#1e40af' },
  pack: { label: '📦 Embalaje', description: 'Características de empaque', color: '#7c3aed' }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function parseKey(key) {
  if (!key) return { prefix: '', bare: key }
  const dot = key.indexOf('.')
  if (dot === -1) return { prefix: '', bare: key }
  return { prefix: key.substring(0, dot), bare: key.substring(dot + 1) }
}

function humanize(str) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function groupFields(fields) {
  const groups = {}
  fields.forEach(f => {
    const { prefix } = parseKey(f.key)
    const g = prefix || '_other'
    if (!groups[g]) groups[g] = []
    groups[g].push(f)
  })
  return groups
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function FormularioInspeccion() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [booting, setBooting] = useState(true)
  const [user, setUser] = useState(null)
  const [token, setTokenState] = useState('')
  const [loading, setLoading] = useState(false)

  const [assignmentId, setAssignmentId] = useState(null)
  const [assignmentData, setAssignmentData] = useState(null)
  const [isFromAssignment, setIsFromAssignment] = useState(false)

  const [commodities, setCommodities] = useState([])
  const [commodityCode, setCommodityCode] = useState('')
  const [template, setTemplate] = useState(null)
  const [fields, setFields] = useState([])
  const [values, setValues] = useState({})
  const [photos, setPhotos] = useState({}) // { "quality.dust": ["url1", "url2"], ... }

  const [header, setHeader] = useState({
    producer: '', lot: '', variety: '', caliber: '',
    packaging_code: '', packaging_type: '', packaging_date: '',
    net_weight: '', brix_avg: '', temp_water: '', temp_ambient: '', temp_pulp: '', notes: ''
  })

  const [headerPhotos, setHeaderPhotos] = useState({
    packaging_code: [],
    packaging_type: [],
    packaging_date: [],
    net_weight: [],
    brix_avg: [],
    temp_water: [],
    temp_ambient: [],
    temp_pulp: []
  })

  // Bootstrap sesión
  useEffect(() => {
    let alive = true
    const run = async () => {
      setBooting(true)
      const t = getToken()
      if (alive) setTokenState(t)
      try {
        const r = await fetch('/api/auth/me')
        const data = await r.json().catch(() => ({}))
        if (!r.ok || !data?.ok) throw new Error(data?.msg || 'Sesión inválida')
        if (alive) setUser(data.user)
      } catch (e) {
        const next = pathname || '/ops'
        router.replace(`/login?next=${encodeURIComponent(next)}`)
        return
      } finally {
        if (alive) setBooting(false)
      }
    }
    run()
    return () => { alive = false }
  }, [router, pathname])

  const authHeaders = useMemo(() => {
    if (!token) return {}
    return { Authorization: 'Bearer ' + token }
  }, [token])

  // Detectar assignment_id
  useEffect(() => {
    const aId = searchParams.get('assignment_id')
    if (aId) {
      setAssignmentId(aId)
      setIsFromAssignment(true)
    }
  }, [searchParams])

  // Cargar asignación
  useEffect(() => {
    if (!assignmentId || !token) return
    let alive = true
    const loadAssignment = async () => {
      try {
        const res = await fetch(`/api/assignments/${assignmentId}`, { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.msg || 'Error al cargar asignación')
        if (!alive) return
        setAssignmentData(data)
        
        // Pre-cargar datos
        setHeader(prev => ({
          ...prev,
          producer: data.producer || '',
          lot: data.lot || '',
          variety: data.variety || ''
        }))
        
        // ← NUEVO: Si tiene commodity, pre-seleccionarlo
        if (data.commodity_code) {
          setCommodityCode(data.commodity_code)
        }
      } catch (err) {
        console.error('Error loading assignment:', err)
        alert('⚠️ No se pudieron cargar los datos de la asignación')
      }
    }
    loadAssignment()
    return () => { alive = false }
  }, [assignmentId, token])

  // Cargar commodities
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
        alert('No se pudieron cargar commodities.')
      }
    }
    if (token) run()
    return () => { alive = false }
  }, [token, authHeaders])

  // Cargar template
  useEffect(() => {
    let alive = true
    if (!commodityCode || !token) return
    const run = async () => {
      try {
        setTemplate(null)
        setFields([])
        setValues({})
        setPhotos({})
        const res = await fetch(`/api/metric-templates/code/${commodityCode}`, { headers: authHeaders })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.msg || 'Error template')
        if (!alive) return
        setTemplate(data.template || null)
        setFields(Array.isArray(data.fields) ? data.fields : [])
        const init = {}
        const initPhotos = {}
        ;(data.fields || []).forEach(f => {
          init[f.key] = ''
          initPhotos[f.key] = []
        })
        setValues(init)
        setPhotos(initPhotos)
      } catch (e) {
        console.error(e)
        alert(`No se pudo cargar la template para ${commodityCode}`)
      }
    }
    run()
    return () => { alive = false }
  }, [commodityCode, token, authHeaders])

  const handleHeader = (e) => {
    const { name, value } = e.target
    setHeader(prev => ({ ...prev, [name]: value }))
  }

  const handleField = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const handlePhotos = (key, urls) => {
    setPhotos(prev => ({ ...prev, [key]: urls }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!commodityCode) return alert('Selecciona commodity')
    setLoading(true)
    try {
      const allPhotos = { ...photos, ...Object.fromEntries(Object.entries(headerPhotos).map(([k, v]) => [`header.${k}`, v]))}

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
        metrics: values,
        photos: photos, // ← Nuevo: fotos por métrica
        assignment_id: assignmentId || null
      }

      const res = await fetch('/api/inspecciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload)
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.msg || 'Error creando inspección')

      alert(`✅ Inspección guardada (ID: ${data.id})`)

      if (isFromAssignment) {
        router.push('/inspector')
      } else {
        setHeader(prev => ({
          ...prev, producer: '', lot: '', variety: '', caliber: '',
          packaging_code: '', packaging_type: '', packaging_date: '',
          net_weight: '', brix_avg: '', temp_water: '', temp_ambient: '', temp_pulp: '', notes: ''
        }))
        setValues(prev => {
          const cleared = {}
          Object.keys(prev || {}).forEach(k => cleared[k] = '')
          return cleared
        })
        setPhotos(prev => {
          const cleared = {}
          Object.keys(prev || {}).forEach(k => cleared[k] = [])
          return cleared
        })

        setHeaderPhotos({
          packaging_code: [],
          packaging_type: [],
          packaging_date: [],
          net_weight: [],
          brix_avg: [],
          temp_water: [],
          temp_ambient: [],
          temp_pulp: []
        })
      }
    } catch (err) {
      console.error(err)
      alert(err?.message || 'Error al guardar inspección')
    } finally {
      setLoading(false)
    }
  }

  const handleGoBack = () => {
    if (isFromAssignment) {
      router.push('/inspector')
    } else {
      router.back()
    }
  }

  const currentTheme = COMMODITY_THEMES[commodityCode] || { 
    name: 'Berry', icon: '🫐', color: '#6b7280', lightBg: '#f3f4f6', darkBg: '#e5e7eb' 
  }

  const groupedFields = useMemo(() => groupFields(fields), [fields])

  const currentIndex = commodities.findIndex(c => c.code === commodityCode)
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < commodities.length - 1

  const changeCommodity = (direction) => {
    const newIndex = currentIndex + direction
    if (newIndex >= 0 && newIndex < commodities.length) {
      setCommodityCode(commodities[newIndex].code)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  if (booting) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>⏳ Cargando sesión...</div>
  if (!user) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Redirigiendo...</div>
  if (user.role !== 'inspector') return <div style={{ padding: 40 }}>Acceso restringido (solo inspectores)</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f0', paddingBottom: 40 }}>
      {/* Header sticky */}
      <div style={{ 
        position: 'sticky', top: 0, zIndex: 100,
        background: currentTheme.color, 
        color: '#fff', 
        padding: '16px 20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <button onClick={handleGoBack} style={{ 
            background: 'rgba(255,255,255,0.2)', 
            border: '1px solid rgba(255,255,255,0.3)', 
            color: '#fff', 
            padding: '8px 14px', 
            borderRadius: 8, 
            fontWeight: 700, 
            fontSize: 13, 
            cursor: 'pointer' 
          }}>
            ← Volver
          </button>

          {/* Selector de Berry */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* ← NUEVO: Solo mostrar flechas si NO viene de asignación con commodity */}
            {!(isFromAssignment && assignmentData?.commodity_code) && (
              <button 
                onClick={() => changeCommodity(-1)}
                disabled={!canGoPrev}
                style={{ 
                  background: 'rgba(255,255,255,0.2)', 
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff', 
                  width: 36, 
                  height: 36, 
                  borderRadius: 8, 
                  fontSize: 18, 
                  fontWeight: 900,
                  cursor: canGoPrev ? 'pointer' : 'not-allowed',
                  opacity: canGoPrev ? 1 : 0.4
                }}
              >
                ‹
              </button>
            )}

            <div style={{ 
              background: 'rgba(255,255,255,0.95)', 
              color: currentTheme.color, 
              padding: '10px 20px', 
              borderRadius: 12,
              display: 'flex', 
              alignItems: 'center', 
              gap: 10,
              minWidth: 200,
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: 28 }}>{currentTheme.icon}</span>
              <span style={{ fontSize: 18, fontWeight: 900 }}>{currentTheme.name}</span>
              {/* ← NUEVO: Indicador si está pre-asignado */}
              {isFromAssignment && assignmentData?.commodity_code && (
                <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>✓ Pre-asignado</span>
              )}
            </div>

            {!(isFromAssignment && assignmentData?.commodity_code) && (
              <button 
                onClick={() => changeCommodity(1)}
                disabled={!canGoNext}
                style={{ 
                  background: 'rgba(255,255,255,0.2)', 
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff', 
                  width: 36, 
                  height: 36, 
                  borderRadius: 8, 
                  fontSize: 18, 
                  fontWeight: 900,
                  cursor: canGoNext ? 'pointer' : 'not-allowed',
                  opacity: canGoNext ? 1 : 0.4
                }}
              >
                ›
              </button>
            )}
          </div>

          <div style={{ fontSize: 13, opacity: 0.9 }}>
            {user.email}
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ maxWidth: 1200, margin: '20px auto', padding: '0 20px' }}>
        
        {/* Asignación */}
        {isFromAssignment && assignmentData && (
          <div style={{ 
            background: currentTheme.lightBg, 
            border: `2px solid ${currentTheme.color}`,
            borderRadius: 16, 
            padding: 20, 
            marginBottom: 20 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ 
                background: currentTheme.color, 
                color: '#fff', 
                padding: '6px 12px', 
                borderRadius: 8, 
                fontSize: 12, 
                fontWeight: 900 
              }}>
                ✅ ASIGNACIÓN PRE-CARGADA
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {[
                ['Productor', assignmentData.producer],
                ['Lote', assignmentData.lot],
                ['Variedad', assignmentData.variety]
              ].filter(([, v]) => v).map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: currentTheme.color, marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cabecera */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#111827', fontSize: 16, fontWeight: 900 }}>
            📋 {isFromAssignment ? 'Completar Información' : 'Identificación del Lote'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {[
              ['producer', 'Productor', true, 'text', isFromAssignment],
              ['lot', 'Lote / Serie', true, 'text', isFromAssignment],
              ['variety', 'Variedad', false, 'text', isFromAssignment],
              ['caliber', 'Calibre', false, 'text', false],
              ['packaging_code', 'Cod. Embalaje', false, 'text', false],
              ['packaging_type', 'Tipo Embalaje', false, 'text', false],
              ['packaging_date', 'Fecha Embalaje', false, 'date', false],
              ['net_weight', 'Peso neto (kg)', false, 'number', false],
              ['brix_avg', 'Brix promedio', false, 'number', false],
              ['temp_water', 'Temp agua (°C)', false, 'number', false],
              ['temp_ambient', 'Temp ambiente (°C)', false, 'number', false],
              ['temp_pulp', 'Temp pulpa (°C)', false, 'number', false],
            ].map(([k, label, req, type, readonly]) => (
              <div key={k}>
                <label style={{ 
                  display: 'block', 
                  fontSize: 11, 
                  fontWeight: 900, 
                  color: readonly ? currentTheme.color : '#374151', 
                  marginBottom: 6, 
                  textTransform: 'uppercase' 
                }}>
                  {label} {readonly && '✓'}
                </label>
                <input
                  type={type}
                  name={k}
                  value={header[k]}
                  onChange={handleHeader}
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    borderRadius: 10, 
                    border: readonly ? `2px solid ${currentTheme.color}` : '1px solid #d1d5db',
                    background: readonly ? currentTheme.lightBg : '#fff',
                    color: '#111827',
                    fontSize: 14,
                    fontWeight: readonly ? 700 : 400,
                    boxSizing: 'border-box'
                  }}
                  required={!!req}
                  readOnly={readonly}
                  step={type === 'number' ? '0.01' : undefined}
                />
              </div>
            ))}

            {/* Campos CON fotos (packaging_code en adelante) */}
            {[
              ['packaging_code', 'Cod. Embalaje', false, 'text'],
              ['packaging_type', 'Tipo Embalaje', false, 'text'],
              ['packaging_date', 'Fecha Embalaje', false, 'date'],
              ['net_weight', 'Peso neto (kg)', false, 'number'],
              ['brix_avg', 'Brix promedio', false, 'number'],
              ['temp_water', 'Temp agua (°C)', false, 'number'],
              ['temp_ambient', 'Temp ambiente (°C)', false, 'number'],
              ['temp_pulp', 'Temp pulpa (°C)', false, 'number']
            ].map(([k, label, req, type]) => (
              <div key={k} style={{ gridColumn: '1 / -1' }}>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 900,
                  color: '#374151',
                  marginBottom: 6,
                  textTransform: 'uppercase'
                }}>
                  {label}
                </label>
                <input
                  type={type}
                  name={k}
                  value={header[k]}
                  onChange={handleHeader}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    color: '#111827',
                    fontSize: 14,
                    boxSizing: 'border-box'
                  }}
                  required={!!req}
                  step={type === 'number' ? '0.01' : undefined}
                />
                {/* ← NUEVO: Upload de fotos */}
                <div style={{ marginTop: 8 }}>
                  <ImageUploader
                    fieldKey={`header.${k}`}
                    images={headerPhotos[k] || []}
                    onChange={(urls) => setHeaderPhotos(prev => ({ ...prev, [k]: urls }))}
                    maxImages={3}
                    disabled={loading}
                  />
                </div>
              </div>
            ))}

            {/* Notas (sin fotos) */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 900, color: '#374151', marginBottom: 6, textTransform: 'uppercase' }}>
                Notas / Comentarios
              </label>
              <textarea
                name="notes"
                value={header.notes}
                onChange={handleHeader}
                rows={3}
                style={{ 
                  width: '100%', 
                  padding: '10px 12px', 
                  borderRadius: 10, 
                  border: '1px solid #d1d5db',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>
        </div>

        {/* Métricas por grupo */}
        {Object.entries(groupedFields).map(([grp, grpFields]) => {
          const groupCfg = METRIC_GROUPS[grp] || { label: '📋 Otros', color: '#6b7280' }
          return (
            <div 
              key={grp} 
              style={{ 
                background: '#fff', 
                borderRadius: 16, 
                padding: 20, 
                marginBottom: 20,
                border: `2px solid ${groupCfg.color}20`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}
            >
              <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `2px solid ${groupCfg.color}20` }}>
                <h3 style={{ margin: 0, color: groupCfg.color, fontSize: 18, fontWeight: 900 }}>
                  {groupCfg.label}
                </h3>
                {groupCfg.description && (
                  <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>{groupCfg.description}</p>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                {grpFields.map(f => {
                  const fieldPhotos = photos[f.key] || []
                  return (
                    <div 
                      key={f.key} 
                      style={{ 
                        background: '#f8fafc', 
                        borderRadius: 12, 
                        padding: 16,
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      <label style={{ 
                        display: 'block', 
                        fontSize: 12, 
                        fontWeight: 900, 
                        color: groupCfg.color, 
                        marginBottom: 8,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5
                      }}>
                        {humanize(parseKey(f.key).bare)} 
                        {f.unit && ` (${f.unit})`}
                        {f.required && ' *'}
                      </label>

                      {/* Input */}
                      {f.field_type === 'select' ? (
                        <select
                          value={values[f.key] ?? ''}
                          onChange={e => handleField(f.key, e.target.value)}
                          style={{ 
                            width: '100%', 
                            padding: '10px 12px', 
                            borderRadius: 8, 
                            border: '1px solid #d1d5db',
                            fontSize: 14,
                            marginBottom: 12,
                            background: '#fff'
                          }}
                          required={!!f.required}
                        >
                          <option value="">-- Seleccionar --</option>
                          {(f.options || []).map(op => (
                            <option key={op} value={op}>{op}</option>
                          ))}
                        </select>
                      ) : f.field_type === 'number' ? (
                        <input
                          type="number"
                          value={values[f.key] ?? ''}
                          onChange={e => handleField(f.key, e.target.value)}
                          style={{ 
                            width: '100%', 
                            padding: '10px 12px', 
                            borderRadius: 8, 
                            border: '1px solid #d1d5db',
                            fontSize: 14,
                            marginBottom: 12,
                            background: '#fff'
                          }}
                          min={f.min_value ?? undefined}
                          max={f.max_value ?? undefined}
                          step="0.01"
                          required={!!f.required}
                        />
                      ) : (
                        <input
                          type="text"
                          value={values[f.key] ?? ''}
                          onChange={e => handleField(f.key, e.target.value)}
                          style={{ 
                            width: '100%', 
                            padding: '10px 12px', 
                            borderRadius: 8, 
                            border: '1px solid #d1d5db',
                            fontSize: 14,
                            marginBottom: 12,
                            background: '#fff'
                          }}
                          required={!!f.required}
                        />
                      )}

                      {/* Upload de fotos */}
                      <ImageUploader
                        fieldKey={f.key}
                        images={fieldPhotos}
                        onChange={urls => handlePhotos(f.key, urls)}
                        maxImages={3}
                        disabled={loading}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Botón submit */}
        <div style={{ 
          position: 'sticky', 
          bottom: 20, 
          background: '#fff', 
          padding: 16, 
          borderRadius: 16, 
          boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
          border: '2px solid #e5e7eb'
        }}>
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '16px', 
              background: loading ? '#9ca3af' : currentTheme.color, 
              color: '#fff', 
              border: 'none', 
              borderRadius: 12, 
              fontSize: 16, 
              fontWeight: 900,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            {loading ? '⏳ GUARDANDO...' : '✅ GUARDAR Y FINALIZAR'}
          </button>
        </div>
      </form>
    </div>
  )
}
