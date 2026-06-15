'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { getToken } from '@/lib/auth/clientToken'

const EMPTY_HEADER = {
  producer: '', lot: '', variety: '', caliber: '',
  packaging_code: '', packaging_type: '', packaging_date: '',
  net_weight: '', brix_avg: '', temp_water: '', temp_ambient: '', temp_pulp: '', notes: ''
}

const EMPTY_HEADER_PHOTOS = {
  packaging_code: [], packaging_type: [], packaging_date: [],
  net_weight: [], brix_avg: [], temp_water: [], temp_ambient: [], temp_pulp: []
}

export default function useFormularioInspeccion() {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  // ── Sesión ──
  const [booting, setBooting] = useState(true)
  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState('')

  // ── Asignación ──
  const [assignmentId, setAssignmentId]     = useState(null)
  const [assignmentData, setAssignmentData] = useState(null)
  const [isFromAssignment, setIsFromAssignment] = useState(false)

  // ── Commodities / template ──
  const [commodities, setCommodities]   = useState([])
  const [commodityCode, setCommodityCode] = useState('')
  const [template, setTemplate]         = useState(null)
  const [fields, setFields]             = useState([])

  // ── Valores del formulario ──
  const [header, setHeader]             = useState(EMPTY_HEADER)
  const [values, setValues]             = useState({})
  const [photos, setPhotos]             = useState({})
  const [headerPhotos, setHeaderPhotos] = useState(EMPTY_HEADER_PHOTOS)
  const [loading, setLoading]           = useState(false)

  const authHeaders = useMemo(() => (
    token ? { Authorization: 'Bearer ' + token } : {}
  ), [token])

  // ── Bootstrap sesión ──
  useEffect(() => {
    let alive = true
    const run = async () => {
      setBooting(true)
      const t = getToken()
      if (alive) setToken(t)
      try {
        const r    = await fetch('/api/auth/me')
        const data = await r.json().catch(() => ({}))
        if (!r.ok || !data?.ok) throw new Error(data?.msg || 'Sesión inválida')
        if (alive) setUser(data.user)
      } catch {
        router.replace(`/login?next=${encodeURIComponent(pathname || '/ops')}`)
      } finally {
        if (alive) setBooting(false)
      }
    }
    run()
    return () => { alive = false }
  }, [router, pathname])

  // ── Detectar assignment_id ──
  useEffect(() => {
    const aId = searchParams.get('assignment_id')
    if (aId) { setAssignmentId(aId); setIsFromAssignment(true) }
  }, [searchParams])

  // ── Cargar asignación ──
  useEffect(() => {
    if (!assignmentId || !token) return
    let alive = true
    const run = async () => {
      try {
        const res  = await fetch(`/api/assignments/${assignmentId}`, { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.msg || 'Error al cargar asignación')
        if (!alive) return
        setAssignmentData(data)
        setHeader(prev => ({ ...prev, producer: data.producer || '', lot: data.lot || '', variety: data.variety || '' }))
        if (data.commodity_code) setCommodityCode(data.commodity_code)
      } catch (err) {
        alert('⚠️ ' + err.message)
      }
    }
    run()
    return () => { alive = false }
  }, [assignmentId, token])

  // ── Cargar commodities ──
  useEffect(() => {
    if (!token) return
    let alive = true
    const run = async () => {
      try {
        const res  = await fetch('/api/commodities', { headers: authHeaders })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.msg || 'Error commodities')
        if (!alive) return
        const list = Array.isArray(data) ? data : []
        setCommodities(list)
        if (list.length) setCommodityCode(c => c || list[0].code)
      } catch (e) {
        alert('No se pudieron cargar commodities.')
      }
    }
    run()
    return () => { alive = false }
  }, [token, authHeaders])

  // ── Cargar template ──
  useEffect(() => {
    if (!commodityCode || !token) return
    let alive = true
    const run = async () => {
      try {
        setTemplate(null); setFields([]); setValues({}); setPhotos({})
        const res  = await fetch(`/api/metric-templates/code/${commodityCode}`, { headers: authHeaders })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.msg || 'Error template')
        if (!alive) return
        const flds = Array.isArray(data.fields) ? data.fields : []
        setTemplate(data.template || null)
        setFields(flds)
        const initV = {}, initP = {}
        flds.forEach(f => { initV[f.key] = ''; initP[f.key] = [] })
        setValues(initV)
        setPhotos(initP)
      } catch (e) {
        alert(`No se pudo cargar la template para ${commodityCode}`)
      }
    }
    run()
    return () => { alive = false }
  }, [commodityCode, token, authHeaders])

  // ── Handlers ──
  const handleHeader  = useCallback(e => {
    const { name, value } = e.target
    setHeader(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleField   = useCallback((key, value) => setValues(prev => ({ ...prev, [key]: value })), [])
  const handlePhotos  = useCallback((key, urls)  => setPhotos(prev => ({ ...prev, [key]: urls })), [])

  const changeCommodity = useCallback((direction) => {
    setCommodities(list => {
      const idx = list.findIndex(c => c.code === commodityCode)
      const next = list[idx + direction]
      if (next) setCommodityCode(next.code)
      return list
    })
  }, [commodityCode])

  const resetForm = useCallback(() => {
    setHeader(EMPTY_HEADER)
    setValues(prev  => Object.fromEntries(Object.keys(prev).map(k => [k, ''])))
    setPhotos(prev  => Object.fromEntries(Object.keys(prev).map(k => [k, []])))
    setHeaderPhotos(EMPTY_HEADER_PHOTOS)
  }, [])

  // ── Submit ──
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!commodityCode) return alert('Selecciona commodity')
    setLoading(true)
    try {
      const payload = {
        commodity_code: commodityCode,
        producer:       header.producer      || null,
        lot:            header.lot           || null,
        variety:        header.variety       || null,
        caliber:        header.caliber       || null,
        packaging_code: header.packaging_code || null,
        packaging_type: header.packaging_type || null,
        packaging_date: header.packaging_date || null,
        net_weight:     header.net_weight  === '' ? null : Number(header.net_weight),
        brix_avg:       header.brix_avg    === '' ? null : Number(header.brix_avg),
        temp_water:     header.temp_water  === '' ? null : Number(header.temp_water),
        temp_ambient:   header.temp_ambient === '' ? null : Number(header.temp_ambient),
        temp_pulp:      header.temp_pulp   === '' ? null : Number(header.temp_pulp),
        notes:          header.notes        || null,
        metrics:        values,
        photos,
        assignment_id:  assignmentId || null
      }

      const res  = await fetch('/api/inspecciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.msg || 'Error creando inspección')

      alert(`✅ Inspección guardada (ID: ${data.id})`)
      isFromAssignment ? router.push('/inspector') : resetForm()
    } catch (err) {
      alert(err?.message || 'Error al guardar inspección')
    } finally {
      setLoading(false)
    }
  }, [commodityCode, header, values, photos, assignmentId, authHeaders, isFromAssignment, router, resetForm])

  const handleGoBack = useCallback(() => {
    isFromAssignment ? router.push('/inspector') : router.back()
  }, [isFromAssignment, router])

  // ── Derived ──
  const currentIndex = commodities.findIndex(c => c.code === commodityCode)
  const canGoPrev    = currentIndex > 0
  const canGoNext    = currentIndex < commodities.length - 1
  const isPreasigned = isFromAssignment && !!assignmentData?.commodity_code

  return {
    // estado
    booting, user, loading,
    // asignación
    assignmentData, isFromAssignment, isPreasigned,
    // commodity
    commodities, commodityCode, canGoPrev, canGoNext,
    // template
    template, fields,
    // form
    header, values, photos, headerPhotos, setHeaderPhotos,
    // handlers
    handleHeader, handleField, handlePhotos,
    handleSubmit, handleGoBack, changeCommodity
  }
}