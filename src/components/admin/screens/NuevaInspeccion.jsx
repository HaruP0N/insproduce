'use client'
import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { Field } from './_ui'
import ImageUploader from '@/components/ImageUploader'
import { useI18n } from '@/lib/i18n'
import { commodityVisual } from '@/lib/inspectorData'
import { PHOTO_SET, photoSetKey } from '@/lib/photoSet'
import { sumWeights, baxloStats } from '@/lib/sampling'

const EMPTY_HEADER = {
  producer: '', lot: '', pallet_number: '', variety: '', caliber: '',
  packaging_code: '', packaging_type: '', packaging_date: '',
  net_weight: '', sample_weight_g: '', ten_pieces_weight: '', brix_avg: '', baxlo_min: '', baxlo_mode: '', baxlo_max: '',
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

// Lista dinámica de valores numéricos (pesos de muestra, lecturas Baxlo):
// agregar cuantos se quiera; el resumen (suma o min/moda/máx) se calcula solo.
function WeightList({ label, help, list, setList, summary, badge, addLabel, t }) {
  const setAt = (i, v) => setList((p) => p.map((x, j) => (j === i ? v : x)))
  const removeAt = (i) => setList((p) => (p.length === 1 ? [''] : p.filter((_, j) => j !== i)))
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="field-label">{label}</label>
      {help && <div className="form-help" style={{ marginTop: 0, marginBottom: 6 }}>{help}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {list.map((v, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input className="input" type="number" step="0.1" inputMode="decimal" value={v}
              onChange={(e) => setAt(i, e.target.value)} style={{ flex: 1 }} />
            <button type="button" className="btn btn-icon btn-sm" onClick={() => removeAt(i)} title={t('common.delete')}
              disabled={list.length === 1 && !v}>
              <Icon name="x" size={13} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => setList((p) => [...p, ''])}>
        <Icon name="plus" size={13} /> {addLabel}
      </button>
      {summary && (
        <div style={{ marginTop: 7, fontSize: 12.5, fontWeight: 800, color: 'var(--accent-strong)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {summary}
          {badge && <span style={{ background: badge.bg, color: badge.fg, padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>{badge.label}</span>}
        </div>
      )}
    </div>
  )
}

// Set de fotos oficial FTF: 7 generales (una vez por empaque) + 11 por variedad,
// numeradas en el orden del instructivo "Photo Set for Inspection".
function PhotoSetCard({ photos, setPhotos, saving, t, lang }) {
  const taken = PHOTO_SET.filter((p) => (photos[photoSetKey(p.tag)] || []).length > 0).length
  const grp = (g) => PHOTO_SET.filter((p) => p.group === g)
  const slot = (p) => (
    <div key={p.tag} style={{ background: 'var(--surface-2, rgba(0,0,0,.02))', borderRadius: 10, padding: 10, border: '1px solid var(--border)' }}>
      <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 18, height: 18, borderRadius: '50%', background: (photos[photoSetKey(p.tag)] || []).length ? 'var(--accent-strong)' : 'var(--surface-2, rgba(0,0,0,.08))', color: (photos[photoSetKey(p.tag)] || []).length ? '#fff' : 'var(--text-faint)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, flexShrink: 0 }}>{p.n}</span>
        {lang === 'en' ? p.en : p.es}
      </label>
      <ImageUploader fieldKey={photoSetKey(p.tag)} images={photos[photoSetKey(p.tag)] || []}
        onChange={(urls) => setPhotos((prev) => ({ ...prev, [photoSetKey(p.tag)]: urls }))} maxImages={3} disabled={saving} />
    </div>
  )
  return (
    <Card title={`${t('ni.photoSet')} · ${taken}/18`} sub={t('ni.photoSetSub')} style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>{t('ni.photoSetGeneral')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))', gap: 10, marginBottom: 14 }}>
        {grp('general').map(slot)}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>{t('ni.photoSetVariety')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))', gap: 10 }}>
        {grp('variety').map(slot)}
      </div>
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
  const [sampleWeights, setSampleWeights] = useState(['']) // se pesan N muestras y se SUMAN
  const [baxloReadings, setBaxloReadings] = useState(['']) // N lecturas → min/moda/máx automáticos
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
    setHeader((p) => ({
      ...p,
      sample_weight_g: total != null ? String(total) : '',
      baxlo_min: st ? String(st.min) : '',
      baxlo_mode: st ? String(st.mode) : '',
      baxlo_max: st ? String(st.max) : '',
    }))
  }, [sampleWeights, baxloReadings])

  const grouped = useMemo(() => groupFields(fields), [fields])
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
        // mismo lote, siguiente pallet: se conserva la cabecera y se limpian métricas y fotos
        setHeader(p => ({ ...p, pallet_number: nextPalletCode(p.pallet_number), ten_pieces_weight: '' }))
        setSampleWeights(['']); setBaxloReadings([''])
        setValues({}); setPhotos({})
        window.scrollTo({ top: 0, behavior: 'smooth' })
        onToast({ title: t('ni.savedNext'), sub: `ID ${data.id}` })
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '0 16px' }}>
            <WeightList label={t('ni.sampleWeights')} help={t('ni.sampleWeightsHelp')} list={sampleWeights} setList={setSampleWeights}
              summary={header.sample_weight_g ? `${t('ni.sampleTotal')}: ${header.sample_weight_g} g` : null} addLabel={t('ni.addWeight')} t={t} />
            <Field label={t('ni.tenPieces')} help={t('ni.tenPiecesHelp')}>
              <input className="input" type="number" step="0.1" value={header.ten_pieces_weight} onChange={setH('ten_pieces_weight')} placeholder="28" />
            </Field>
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
                {numberField('brix_avg', 'ni.brix')}
                {numberField('temp_pulp', 'ni.tempPulp')}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
                {grpFields.map(f => (
                  <div key={f.key} style={{ background: 'var(--surface-2, rgba(0,0,0,.02))', borderRadius: 10, padding: 12, border: '1px solid var(--border)' }}>
                    <label className="field-label">
                      {humanize(bareKey(f.key))}{f.unit === '%' && inGrams ? ' (g)' : f.unit ? ` (${f.unit})` : ''}{f.required ? ' *' : ''}
                    </label>
                    {f.field_type === 'select' ? (
                      <select className="select" value={values[f.key] ?? ''} onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}>
                        <option value="">--</option>
                        {(f.options || []).map(op => <option key={op} value={op}>{op}</option>)}
                      </select>
                    ) : (
                      <input className="input" type={f.field_type === 'number' ? 'number' : 'text'}
                        step={f.field_type === 'number' ? '0.01' : undefined}
                        min={f.min_value ?? undefined} max={f.max_value ?? undefined}
                        value={values[f.key] ?? ''} onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))} />
                    )}
                    {inGrams && f.unit === '%' && values[f.key] && num(header.sample_weight_g) > 0 && Number.isFinite(Number(values[f.key])) && (
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent-strong)', marginTop: 4 }}>
                        = {(Number(values[f.key]) / num(header.sample_weight_g) * 100).toFixed(2)}%
                      </div>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <ImageUploader fieldKey={f.key} images={photos[f.key] || []}
                        onChange={urls => setPhotos(p => ({ ...p, [f.key]: urls }))} maxImages={3} disabled={saving} />
                    </div>
                  </div>
                ))}
              </div>
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
