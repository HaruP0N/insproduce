'use client'
import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { Field } from './_ui'
import ImageUploader from '@/components/ImageUploader'
import { useI18n } from '@/lib/i18n'
import { commodityVisual } from '@/lib/inspectorData'
import { PHOTO_SET, photoSetKey } from '@/lib/photoSet'
import { sumWeights, baxloStats, numStats } from '@/lib/sampling'
import { groupManifest } from '@/lib/manifest'

const EMPTY_HEADER = {
  producer: '', lot: '', pallet_number: '', variety: '', caliber: '',
  packaging_code: '', packaging_type: '', packaging_date: '',
  net_weight: '', sample_weight_g: '', ten_pieces_weight: '', brix_avg: '', brix_min: '', brix_max: '', baxlo_min: '', baxlo_mode: '', baxlo_max: '',
  temp_pulp: '', notes: '',
}

function groupFields(fields) {
  const groups = {}
  fields.forEach(f => {
    const dot = f.key.indexOf('.')
    const g = dot === -1 ? '_other' : f.key.substring(0, dot)
    if (!groups[g]) groups[g] = []
    groups[g].push(f)
  })
  return groups
}
const humanize = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const bareKey = (k) => { const dot = k.indexOf('.'); return dot === -1 ? k : k.substring(dot + 1) }


// 'P3' → 'P4'; sin sufijo numérico o vacío → '' (lo escribe el usuario)
export function nextPalletCode(code) {
  const c = String(code || '').trim()
  if (!c) return 'P2' // el guardado sin N° usó 'P1'
  const m = c.match(/^(.*?)(\d+)$/)
  return m ? m[1] + (Number(m[2]) + 1) : ''
}

// prefill de la cabecera desde un pallet del manifiesto (mismo mapeo que el botón Inspeccionar)
function manifestPrefill(g) {
  return {
    producer: g.growers.join(' + '),
    lot: g.lot || '',
    pallet_number: g.pallet,
    variety: g.varieties.join(' / '),
    packaging_type: g.parts[0]?.packaging || '',
    packaging_date: (g.dates || []).slice().sort()[0] || '',
    caliber: ((g.parts[0]?.packaging || '').match(/jumbo|large|regular|small|petite/i)?.[0] || '').replace(/^./, (c) => c.toUpperCase()),
  }
}

const GRID3 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0 16px' }

// Clasificación de firmeza Baxlo (manual FTF, escala Shore): Soft <60 · Sensitiva 61-74 · Firme ≥75
export function baxloClass(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n < 60) return { label: 'Soft', bg: '#F7DFDF', fg: '#8A2727' }
  if (n < 75) return { label: 'Sensitiva', bg: '#F3EDD6', fg: '#6B5300' }
  return { label: 'Firme', bg: '#E3F2E8', fg: '#1D5E3A' }
}

// Lista dinámica de valores numéricos (pesos de muestra, lecturas Baxlo) en un
// panel propio: filas alineadas, quitar solo cuando hay más de una, resumen abajo.
function WeightList({ label, help, list, setList, summary, badge, addLabel, t }) {
  const setAt = (i, v) => setList((p) => p.map((x, j) => (j === i ? v : x)))
  const removeAt = (i) => setList((p) => (p.length === 1 ? [''] : p.filter((_, j) => j !== i)))
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--surface-2, rgba(0,0,0,.02))', display: 'flex', flexDirection: 'column' }}>
      <label className="field-label" style={{ marginBottom: 2 }}>{label}</label>
      {help && <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginBottom: 8, lineHeight: 1.35 }}>{help}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {list.map((v, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input className="input" type="number" step="0.1" inputMode="decimal" value={v}
              onChange={(e) => setAt(i, e.target.value)} style={{ flex: 1, minWidth: 0 }} />
            {list.length > 1 && (
              <button type="button" className="btn btn-icon btn-sm" onClick={() => removeAt(i)} title={t('common.delete')}>
                <Icon name="x" size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-sm" onClick={() => setList((p) => [...p, ''])}>
          <Icon name="plus" size={13} /> {addLabel}
        </button>
        {summary && (
          <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--accent-strong)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            {summary}
            {badge && <span style={{ background: badge.bg, color: badge.fg, padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>{badge.label}</span>}
          </span>
        )}
      </div>
    </div>
  )
}

// Set de fotos oficial FTF como el instructivo real: mosaico de tarjetas numeradas.
// Vacía = cámara punteada; con foto = miniatura. Tocar abre el uploader del slot.
function PhotoSetCard({ photos, setPhotos, saving, t, lang }) {
  const [openSlot, setOpenSlot] = useState(null)
  const taken = PHOTO_SET.filter((p) => (photos[photoSetKey(p.tag)] || []).length > 0).length
  const tile = (p) => {
    const urls = photos[photoSetKey(p.tag)] || []
    const open = openSlot === p.tag
    return (
      <div key={p.tag} style={{ minWidth: 0 }}>
        <button type="button" onClick={() => setOpenSlot(open ? null : p.tag)}
          style={{
            width: '100%', aspectRatio: '4 / 3', borderRadius: 10, cursor: 'pointer', position: 'relative',
            overflow: 'hidden', padding: 0, display: 'block',
            border: open ? '2px solid var(--accent-strong)' : urls.length ? '1.5px solid var(--accent-strong)' : '1.5px dashed var(--border)',
            background: urls.length ? '#000' : 'var(--surface-2, rgba(0,0,0,.02))',
          }}>
          {urls.length > 0 ? (
            <img src={urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.92 }} />
          ) : (
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>
              <Icon name="camera" size={20} />
            </span>
          )}
          <span style={{
            position: 'absolute', top: 5, left: 5, width: 20, height: 20, borderRadius: 6,
            background: urls.length ? 'var(--accent-strong)' : 'rgba(127,127,127,.25)',
            color: urls.length ? '#fff' : 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
          }}>{p.n}</span>
          {urls.length > 1 && (
            <span style={{ position: 'absolute', bottom: 5, right: 5, background: 'rgba(0,0,0,.65)', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 10.5, fontWeight: 800 }}>
              {urls.length}
            </span>
          )}
        </button>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.25, textAlign: 'center' }}>
          {lang === 'en' ? p.en : p.es}
        </div>
      </div>
    )
  }
  const openItem = PHOTO_SET.find((p) => p.tag === openSlot)
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(108px, 30%), 1fr))', gap: 10 }
  return (
    <Card title={`${t('ni.photoSet')} · ${taken}/18`} sub={t('ni.photoSetSub')} style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>{t('ni.photoSetGeneral')}</div>
      <div style={{ ...grid, marginBottom: 14 }}>{PHOTO_SET.filter((p) => p.group === 'general').map(tile)}</div>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>{t('ni.photoSetVariety')}</div>
      <div style={grid}>{PHOTO_SET.filter((p) => p.group === 'variety').map(tile)}</div>
      {openItem && (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2, rgba(0,0,0,.02))' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>
            {openItem.n}. {lang === 'en' ? openItem.en : openItem.es}
          </div>
          <ImageUploader fieldKey={photoSetKey(openItem.tag)} images={photos[photoSetKey(openItem.tag)] || []}
            onChange={(urls) => setPhotos((prev) => ({ ...prev, [photoSetKey(openItem.tag)]: urls }))} maxImages={3} disabled={saving} />
        </div>
      )}
    </Card>
  )
}

export default function NuevaInspeccionScreen({ onToast, onDone, onCancel, ctx }) {
  const { t, lang } = useI18n()
  const [commodities, setCommodities] = useState([])
  const [code, setCode] = useState('')
  const [standards, setStandards] = useState([])
  const [standardId, setStandardId] = useState('')
  const [fields, setFields] = useState([])
  const [tplErr, setTplErr] = useState(null)
  const [header, setHeader] = useState(EMPTY_HEADER)
  const [values, setValues] = useState({})
  const [photos, setPhotos] = useState({})
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1) // 1 = datos iniciales (identificación), 2 = datos de la inspección
  const [openPhotoKey, setOpenPhotoKey] = useState(null) // uploader visible solo del defecto tocado
  const [donePallets, setDonePallets] = useState(() => new Set()) // guardados en esta sesión (multi-pallet)
  const [sampleWeights, setSampleWeights] = useState(['']) // se pesan N muestras y se SUMAN
  const [baxloReadings, setBaxloReadings] = useState(['']) // N lecturas → min/moda/máx automáticos
  const [brixReadings, setBrixReadings] = useState(['']) // N lecturas → prom/mín/máx automáticos
  const [inGrams, setInGrams] = useState(true) // defectos en gramos → % automático con el peso muestra

  // Contexto desde Arribos: pre-carga commodity y, en reinspección, los datos del pallet
  useEffect(() => {
    if (!ctx) return
    if (ctx.arrival?.commodity_code) setCode(ctx.arrival.commodity_code)
    // fecha de embalaje del arribo (packing date del contenedor)
    if (ctx.arrival?.packing_date) {
      setHeader((p) => ({ ...p, packaging_date: p.packaging_date || String(ctx.arrival.packing_date).slice(0, 10) }))
    }
    // pallet elegido desde el manifiesto del contenedor: cabecera prellenada
    if (ctx.prefill) {
      setHeader((p) => ({
        ...p,
        producer: ctx.prefill.producer || '',
        lot: ctx.prefill.lot || '',
        pallet_number: ctx.prefill.pallet_number || '',
        variety: ctx.prefill.variety || '',
        packaging_type: ctx.prefill.packaging || p.packaging_type,
        packaging_date: ctx.prefill.packaging_date ? String(ctx.prefill.packaging_date).slice(0, 10) : p.packaging_date,
        caliber: ctx.prefill.caliber ? ctx.prefill.caliber[0].toUpperCase() + ctx.prefill.caliber.slice(1).toLowerCase() : p.caliber,
      }))
    }
    if (ctx.reinspect) {
      setHeader((p) => ({
        ...p,
        producer: ctx.reinspect.producer || '',
        lot: ctx.reinspect.lot || '',
        pallet_number: (ctx.reinspect.pallet_code && ctx.reinspect.pallet_code !== 'P1') ? ctx.reinspect.pallet_code : '',
        variety: ctx.reinspect.variety || '',
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx])

  useEffect(() => {
    let alive = true
    fetch('/api/commodities', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!alive) return
        const list = Array.isArray(d) ? d : []
        setCommodities(list)
        setCode(c => c || list[0]?.code || '')
      })
      .catch(() => alive && onToast({ title: t('ni.errCommodities'), bad: true }))
    fetch('/api/standards', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (alive) setStandards(Array.isArray(d) ? d : []) })
      .catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!code) return
    let alive = true
    setFields([]); setValues({}); setPhotos({}); setTplErr(null); setStandardId('')
    fetch(`/api/metric-templates/code/${code}`, { credentials: 'include' })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!alive) return
        if (!ok) throw new Error(d?.msg || 'template')
        const flds = Array.isArray(d.fields) ? d.fields : []
        setFields(flds)
        setValues(Object.fromEntries(flds.map(f => [f.key, ''])))
        setPhotos(Object.fromEntries(flds.map(f => [f.key, []])))
      })
      .catch(() => alive && setTplErr(t('ni.errTemplate', { code })))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  // las listas alimentan los campos derivados de la cabecera
  useEffect(() => {
    const total = sumWeights(sampleWeights)
    const st = baxloStats(baxloReadings)
    const bx = numStats(brixReadings)
    setHeader((p) => ({
      ...p,
      sample_weight_g: total != null ? String(total) : '',
      baxlo_min: st ? String(st.min) : '',
      baxlo_mode: st ? String(st.mode) : '',
      baxlo_max: st ? String(st.max) : '',
      brix_avg: bx ? String(bx.avg) : '',
      brix_min: bx ? String(bx.min) : '',
      brix_max: bx ? String(bx.max) : '',
    }))
  }, [sampleWeights, baxloReadings, brixReadings])

  const grouped = useMemo(() => groupFields(fields), [fields])

  // pallets del manifiesto del arribo: ya inspeccionados (BD) o guardados recién quedan marcados
  const manifestGroups = useMemo(() => {
    if (!ctx?.arrival?.manifest?.length) return []
    const inspected = new Set((ctx.arrival.inspections || []).map((i) => i.pallet_code))
    return groupManifest(ctx.arrival.manifest).map((g) => ({
      ...g, done: inspected.has(g.pallet) || donePallets.has(g.pallet),
    }))
  }, [ctx, donePallets])

  const applyManifestPallet = (pallet) => {
    const g = manifestGroups.find((x) => x.pallet === pallet)
    if (!g) return
    setHeader((p) => ({ ...p, ...manifestPrefill(g) }))
  }
  const setH = (k) => (e) => setHeader(p => ({ ...p, [k]: e.target.value }))
  const num = (v) => (v === '' || v == null ? null : Number(v))

  const submit = async (andNext = false) => {
    if (!code) return
    if (!header.lot.trim() || !header.producer.trim())
      return onToast({ title: t('ni.needLotProducer'), bad: true })
    if (header.temp_pulp === '')
      return onToast({ title: t('ni.needTempPulp'), bad: true })
    // modo gramos: g defecto / g muestra * 100 (el motor y las tolerancias trabajan en %)
    const sw = num(header.sample_weight_g)
    const metricsOut = {}
    for (const [k, v] of Object.entries(values)) {
      if (v === '' || v == null) { continue }
      const f = fields.find((x) => x.key === k)
      if (inGrams && f?.unit === '%' && Number.isFinite(Number(v))) {
        if (!sw) return onToast({ title: t('ni.needSampleWeight'), bad: true })
        metricsOut[k] = String(Math.round((Number(v) / sw) * 10000) / 100)
      } else {
        metricsOut[k] = v
      }
    }
    setSaving(true)
    try {
      const payload = {
        commodity_code: code,
        producer: header.producer.trim() || null,
        lot: header.lot.trim() || null,
        pallet_number: header.pallet_number.trim() || null,
        variety: header.variety || null,
        caliber: header.caliber || null,
        packaging_code: header.packaging_code || null,
        packaging_type: header.packaging_type || null,
        packaging_date: header.packaging_date || null,
        net_weight: num(header.net_weight),
        sample_weight_g: num(header.sample_weight_g),
        ten_pieces_weight_g: num(header.ten_pieces_weight),
        brix_avg: num(header.brix_avg),
        brix_min: num(header.brix_min),
        brix_max: num(header.brix_max),
        temp_pulp: num(header.temp_pulp),
        baxlo_min: num(header.baxlo_min),
        baxlo_mode: num(header.baxlo_mode),
        baxlo_max: num(header.baxlo_max),
        notes: header.notes || null,
        metrics: metricsOut,
        photos,
        assignment_id: null,
        standard_id: standardId ? Number(standardId) : null,
        arrival_id: ctx?.arrival?.id ?? null,
        reinspection_of: ctx?.reinspect?.id ?? null,
      }
      const res = await fetch('/api/inspecciones', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.msg || t('ni.errSave'))
      // PDF del informe en segundo plano (no bloquea el guardado)
      fetch(`/api/inspecciones/${data.id}/generar-pdf`, { method: 'POST', credentials: 'include' }).catch(() => {})
      if (andNext) {
        const savedPallet = header.pallet_number.trim()
        setSampleWeights(['']); setBaxloReadings(['']); setBrixReadings([''])
        setValues({}); setPhotos({})
        if (manifestGroups.length) {
          // siguiente pallet PENDIENTE del manifiesto, con su propio prellenado
          const done = new Set([...donePallets, savedPallet])
          setDonePallets(done)
          const next = manifestGroups.find((g) => !g.done && g.pallet !== savedPallet && !done.has(g.pallet))
          if (next) {
            setHeader((p) => ({ ...p, ...manifestPrefill(next), ten_pieces_weight: '' }))
            setStep(1)
            onToast({ title: t('ni.savedNext'), sub: `ID ${data.id} · ${t('ni.nextPallet', { p: next.pallet })}` })
          } else {
            onToast({ title: t('ni.allPalletsDone'), sub: `ID ${data.id}` })
            onDone()
            return
          }
        } else {
          // sin manifiesto: correlativo P1→P2 como antes
          setHeader(p => ({ ...p, pallet_number: nextPalletCode(p.pallet_number), ten_pieces_weight: '' }))
          onToast({ title: t('ni.savedNext'), sub: `ID ${data.id}` })
        }
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        onToast({
          title: t('ni.saved'),
          sub: `ID ${data.id}` + (data.warnings?.length ? ` · ${data.warnings.join(' · ')}` : ''),
        })
        onDone()
      }
    } catch (e) {
      onToast({ title: t('ni.errSave'), sub: e.message, bad: true })
    } finally {
      setSaving(false)
    }
  }

  const nextStep = () => {
    if (!code) return
    if (!header.lot.trim() || !header.producer.trim())
      return onToast({ title: t('ni.needLotProducer'), bad: true })
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const numberField = (key, labelKey) => (
    <Field label={t(labelKey)}>
      <input className="input" type="number" step="0.01" value={header[key]} onChange={setH(key)} />
    </Field>
  )

  // Avisos del protocolo de muestreo (manual FTF)
  const hints = []
  const valOf = (frag) => Object.entries(values).some(([k, v]) => k.includes(frag) && Number(v) > 0)
  if (valOf('decay') || valOf('mold')) hints.push(t('ni.hintDecay'))
  if (valOf('underweight') || valOf('under_weight')) hints.push(t('ni.hintUnderweight'))
  const bx = baxloClass(header.baxlo_mode || header.baxlo_min)

  return (
    <div className="content-inner fade-up">
      {ctx?.arrival && (
        <div className="form-help" style={{ marginBottom: 12, padding: '9px 13px', background: 'var(--surface-2, rgba(99,102,241,.06))', border: '1px solid var(--border)', borderRadius: 9, fontSize: 13 }}>
          {t('ni.arrivalBanner', { c: ctx.arrival.container })}
          {ctx.arrival.warehouse ? <> · {ctx.arrival.warehouse}</> : null}
          {ctx.arrival.week_no ? <> · {t('arr.week')} {ctx.arrival.week_no}</> : null}
          {ctx.reinspect && <> · ↺ {t('ni.reinspBanner', { id: ctx.reinspect.id, lot: ctx.reinspect.lot || '—' })}</>}
        </div>
      )}

      {/* indicador de etapas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[1, 2].map((n) => (
          <button key={n} type="button" onClick={() => (n === 1 ? setStep(1) : nextStep())}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid var(--border)',
              borderRadius: 999, padding: '5px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              background: step === n ? 'var(--accent-strong)' : 'var(--surface, transparent)',
              color: step === n ? '#fff' : 'var(--text-dim)',
            }}>
            <span style={{ width: 17, height: 17, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: step === n ? 'rgba(255,255,255,.25)' : 'var(--surface-2, rgba(0,0,0,.06))' }}>{n}</span>
            {n === 1 ? t('ni.step1') : t('ni.step2')}
          </button>
        ))}
      </div>

      {step === 1 && (
        <Card title={t('ni.step1Title')} sub={t('ni.step1Sub')}>
          {manifestGroups.length > 0 && (
            <Field label={t('ni.manifestPallet')} help={t('ni.manifestPalletHelp')}>
              <select className="select" value={manifestGroups.some((g) => g.pallet === header.pallet_number) ? header.pallet_number : ''}
                onChange={(e) => applyManifestPallet(e.target.value)}>
                <option value="">{t('ni.manifestPalletPick')}</option>
                {manifestGroups.map((g) => (
                  <option key={g.pallet} value={g.pallet} disabled={g.done}>
                    {g.pallet} · {g.growers.join('+')} · {g.varieties.join('/')}{g.done ? ` — ${t('ni.palletDone')}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div style={GRID3}>
            <Field label={t('ni.commodity')} required>
              <select className="select" value={code} onChange={e => setCode(e.target.value)}>
                {commodities.map(c => <option key={c.code} value={c.code}>{commodityVisual(c.code, t).label}</option>)}
              </select>
            </Field>
            <Field label={t('ni.standard')} help={t('ni.standardHelp')}>
              <select className="select" value={standardId} onChange={e => setStandardId(e.target.value)}>
                <option value="">{t('ni.standardDefault')}</option>
                {standards.filter(s => s.commodity_code === code && s.active).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t('tbl.productor')} required>
              <input className="input" value={header.producer} onChange={setH('producer')} placeholder={t('asg.producerPh')} />
            </Field>
            <Field label={t('ni.lot')} required>
              <input className="input" value={header.lot} onChange={setH('lot')} placeholder="L-2026-001" />
            </Field>
            <Field label={t('ni.pallet')} help={t('ni.palletHelp')}>
              <input className="input" value={header.pallet_number} onChange={setH('pallet_number')} placeholder="P1" />
            </Field>
            <Field label={t('tbl.variedad')}>
              <input className="input" value={header.variety} onChange={setH('variety')} placeholder="Duke, Ventura…" />
            </Field>
            <Field label={t('ni.caliber')}>
              <input className="input" value={header.caliber} onChange={setH('caliber')} />
            </Field>
            <Field label={t('ni.packCode')}>
              <input className="input" value={header.packaging_code} onChange={setH('packaging_code')} />
            </Field>
            <Field label={t('ni.packType')}>
              <input className="input" value={header.packaging_type} onChange={setH('packaging_type')} />
            </Field>
            <Field label={t('ni.packDate')}>
              <input className="input" type="date" value={header.packaging_date} onChange={setH('packaging_date')} />
            </Field>
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-faint)', borderBottom: '1px solid var(--border)', padding: '14px 0 4px', marginBottom: 10 }}>
            {t('ni.samplesTitle')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: 12, alignItems: 'start' }}>
            <WeightList label={t('ni.sampleWeights')} help={t('ni.sampleWeightsHelp')} list={sampleWeights} setList={setSampleWeights}
              summary={header.sample_weight_g ? `${t('ni.sampleTotal')}: ${header.sample_weight_g} g` : null} addLabel={t('ni.addWeight')} t={t} />
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--surface-2, rgba(0,0,0,.02))' }}>
              <label className="field-label" style={{ marginBottom: 2 }}>{t('ni.tenPieces')}</label>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginBottom: 8, lineHeight: 1.35 }}>{t('ni.tenPiecesHelp')}</div>
              <input className="input" type="number" step="0.1" value={header.ten_pieces_weight} onChange={setH('ten_pieces_weight')} placeholder="28" />
            </div>
            <WeightList label={t('ni.baxloReadings')} help={t('ni.baxloReadingsHelp')} list={baxloReadings} setList={setBaxloReadings}
              summary={header.baxlo_min ? `Min ${header.baxlo_min} · ${t('ni.baxloModeShort')} ${header.baxlo_mode} · Máx ${header.baxlo_max}` : null}
              badge={baxloClass(header.baxlo_mode)} addLabel={t('ni.addReading')} t={t} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={nextStep} disabled={!code}>
              {t('ni.next')} <Icon name="chevRight" size={15} />
            </button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <>
          {/* resumen de los datos iniciales, con vuelta a la etapa 1 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14, padding: '9px 13px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface-2, rgba(0,0,0,.02))', fontSize: 13 }}>
            <b>{commodityVisual(code, t).label}</b>
            <span className="mono">{header.lot || '—'}</span>
            {header.pallet_number && <span className="mono" style={{ color: 'var(--accent-strong)', fontWeight: 700 }}>{header.pallet_number}</span>}
            <span style={{ color: 'var(--text-dim)' }}>{header.producer || '—'}{header.variety ? ` · ${header.variety}` : ''}</span>
            {header.packaging_type && <span style={{ color: 'var(--text-faint)' }}>{header.packaging_type}</span>}
            <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setStep(1)}>
              <Icon name="edit" size={13} /> {t('ni.editInitial')}
            </button>
          </div>

          <div className="grid cols-2-1" style={{ alignItems: 'start', marginBottom: 16 }}>
            <Card title={t('ni.step2Title')} sub={t('ni.step2Sub')}>
              <div className="form-help" style={{ marginBottom: 10 }}>
                {t('ni.sampleTotal')}: <b>{header.sample_weight_g || '—'} g</b>
                {header.baxlo_min ? <> · Baxlo {header.baxlo_min}/{header.baxlo_mode}/{header.baxlo_max}</> : null}
                {' '}· <a style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setStep(1)}>{t('ni.editInitial')}</a>
              </div>
              <div style={GRID3}>
                {numberField('net_weight', 'ni.netWeight')}
                {numberField('temp_pulp', 'ni.tempPulp')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: 12, alignItems: 'start', marginTop: 4 }}>
                <WeightList label={t('ni.brixReadings')} help={t('ni.brixReadingsHelp')} list={brixReadings} setList={setBrixReadings}
                  summary={header.brix_avg ? `${t('ni.brixAvgShort')} ${header.brix_avg} · Mín ${header.brix_min} · Máx ${header.brix_max} °Bx` : null}
                  addLabel={t('ni.addReading')} t={t} />
              </div>
              <Field label={t('ni.notes')}>
                <textarea className="input" rows={3} value={header.notes} onChange={setH('notes')} />
              </Field>
            </Card>

            <Card title={t('ni.summary')}>
              <div className="form-help" style={{ marginBottom: 10 }}>{t('ni.summaryHelp')}</div>
              <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div><b>{t('ni.commodity')}:</b> {code || '—'}</div>
                <div><b>{t('ni.metrics')}:</b> {fields.length}</div>
                <div><b>{t('ni.photosCount')}:</b> {Object.values(photos).reduce((a, p) => a + p.length, 0)}</div>
                {bx && (
                  <div><b>Baxlo:</b>{' '}
                    <span style={{ background: bx.bg, color: bx.fg, padding: '2px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 800 }}>
                      {bx.label}
                    </span>
                  </div>
                )}
              </div>
              {hints.map((h, i) => (
                <div key={i} className="form-help" style={{ color: '#9c6500', background: '#fdf6e3', border: '1px solid #eadfb8', borderRadius: 8, padding: '7px 10px', marginTop: 10 }}>
                  ⚠ {h}
                </div>
              ))}
              {tplErr && <div className="form-help" style={{ color: 'var(--red)', marginTop: 10 }}>{tplErr}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <button className="btn" onClick={onCancel} disabled={saving}>{t('common.cancel')}</button>
                <button className="btn" onClick={() => submit(true)} disabled={saving || !code}>
                  <Icon name="plus" size={15} />
                  {t('ni.saveNext')}
                </button>
                <button className="btn btn-primary" onClick={() => submit(false)} disabled={saving || !code}>
                  <Icon name="check" size={15} />
                  {saving ? t('common.saving') : t('ni.save')}
                </button>
              </div>
            </Card>
          </div>

          <PhotoSetCard photos={photos} setPhotos={setPhotos} saving={saving} t={t} lang={lang} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{t('ni.defectMode')}</span>
            <div className="seg">
              <button type="button" className={inGrams ? 'on' : ''} onClick={() => setInGrams(true)}>{t('ni.modeGrams')}</button>
              <button type="button" className={!inGrams ? 'on' : ''} onClick={() => setInGrams(false)}>%</button>
            </div>
            {inGrams && <span className="form-help" style={{ margin: 0 }}>{t('ni.modeGramsHelp')}</span>}
          </div>

          {Object.entries(grouped).map(([grp, grpFields]) => (
            <Card key={grp} title={t(`ni.group.${grp}`) === `ni.group.${grp}` ? humanize(grp) : t(`ni.group.${grp}`)}
              style={{ marginBottom: 16 }}>
              {grpFields.map(f => {
                const nPhotos = (photos[f.key] || []).length
                const pct = inGrams && f.unit === '%' && values[f.key] && num(header.sample_weight_g) > 0 && Number.isFinite(Number(values[f.key]))
                  ? (Number(values[f.key]) / num(header.sample_weight_g) * 100).toFixed(2) : null
                return (
                  <div key={f.key} style={{ borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', flexWrap: 'wrap' }}>
                      <label style={{ flex: '1 1 180px', fontSize: 13, fontWeight: 600, minWidth: 0 }}>
                        {humanize(bareKey(f.key))}{f.unit === '%' && inGrams ? ' (g)' : f.unit ? ` (${f.unit})` : ''}{f.required ? ' *' : ''}
                      </label>
                      {pct != null && <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-strong)', whiteSpace: 'nowrap' }}>= {pct}%</span>}
                      {f.field_type === 'select' ? (
                        <select className="select" style={{ width: 150, flex: '0 0 auto' }} value={values[f.key] ?? ''} onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}>
                          <option value="">--</option>
                          {(f.options || []).map(op => <option key={op} value={op}>{op}</option>)}
                        </select>
                      ) : (
                        <input className="input" style={{ width: 110, flex: '0 0 auto' }} type={f.field_type === 'number' ? 'number' : 'text'}
                          step={f.field_type === 'number' ? '0.01' : undefined}
                          min={f.min_value ?? undefined} max={f.max_value ?? undefined}
                          value={values[f.key] ?? ''} onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))} />
                      )}
                      <button type="button" className="btn btn-icon btn-sm" title={t('ni.photosCount')}
                        onClick={() => setOpenPhotoKey(k => k === f.key ? null : f.key)}
                        style={nPhotos ? { color: 'var(--accent-strong)', fontWeight: 800 } : undefined}>
                        <Icon name="camera" size={15} />{nPhotos > 0 && <span style={{ fontSize: 11, marginLeft: 2 }}>{nPhotos}</span>}
                      </button>
                    </div>
                    {openPhotoKey === f.key && (
                      <div style={{ padding: '4px 0 12px' }}>
                        <ImageUploader fieldKey={f.key} images={photos[f.key] || []}
                          onChange={urls => setPhotos(p => ({ ...p, [f.key]: urls }))} maxImages={3} disabled={saving} />
                      </div>
                    )}
                  </div>
                )
              })}
            </Card>
          ))}
          {!fields.length && !tplErr && code && (
            <Card><div className="empty">{t('common.loading')}</div></Card>
          )}
        </>
      )}
    </div>
  )
}
