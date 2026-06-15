'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── useInspecciones ──────────────────────────────────────────────────────────
// Encapsula fetch + estado de inspecciones y asignaciones

export function useInspecciones() {
  const [inspecciones, setInspecciones]   = useState([])
  const [asignaciones, setAsignaciones]   = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')

  const fetchDatos = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [rInsp, rAsig] = await Promise.all([
        fetch('/api/inspecciones/historial', { credentials: 'include' }),
        fetch('/api/assignments/pendientes', { credentials: 'include' })
      ])
      const dInsp = await rInsp.json().catch(() => null)
      const dAsig = await rAsig.json().catch(() => null)
      if (!rInsp.ok) throw new Error(dInsp?.msg || 'Error al cargar')
      setInspecciones(Array.isArray(dInsp) ? dInsp : [])
      setAsignaciones(dAsig?.asignaciones || [])
    } catch (err) {
      setError(err?.message || 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDatos() }, [fetchDatos])

  return { inspecciones, asignaciones, loading, error, refetch: fetchDatos }
}

// ─── useInspeccionDetalle ─────────────────────────────────────────────────────
// Carga el detalle de una inspección específica

export function useInspeccionDetalle() {
  const [detail, setDetail]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [open, setOpen]         = useState(false)

  const openDetalle = async (insp) => {
    setOpen(true)
    setLoading(true)
    setDetail(null)
    try {
      const res  = await fetch(`/api/inspecciones/${insp.id}`, { credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.msg || 'Error')
      setDetail(data)
    } catch (err) {
      alert(err?.message)
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const closeDetalle = () => {
    setOpen(false)
    setDetail(null)
  }

  return { detail, loading, open, openDetalle, closeDetalle, setDetail }
}