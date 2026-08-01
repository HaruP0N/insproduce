'use client'
import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { Field } from './_ui'
import ImageUploader from '@/components/ImageUploader'
import { useI18n } from '@/lib/i18n'

const EMPTY_HEADER = {
  producer: '', lot: '', variety: '', caliber: '',
  packaging_code: '', packaging_type: '', packaging_date: '',
  net_weight: '', brix_avg: '', temp_water: '', temp_ambient: '', temp_pulp: '', notes: '',
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

const GRID3 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0 16px' }

export default function NuevaInspeccionScreen({ onToast, onDone, onCancel }) {
  const { t } = useI18n()
  const [commodities, setCommodities] = useState([])
  const [code, setCode] = useState('')
  const [fields, setFields] = useState([])
  const [tplErr, setTplErr] = useState(null)
  const [header, setHeader] = useState(EMPTY_HEADER)
  const [values, setValues] = useState({})
  const [photos, setPhotos] = useState({})
  const [saving, setSaving] = useState(false)

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
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!code) return
    let alive = true
    setFields([]); setValues({}); setPhotos({}); setTplErr(null)
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

  const grouped = useMemo(() => groupFields(fields), [fields])
  const setH = (k) => (e) => setHeader(p => ({ ...p, [k]: e.target.value }))
  const num = (v) => (v === '' || v == null ? null : Number(v))

  const submit = async () => {
    if (!code) return
    if (!header.lot.trim() || !header.producer.trim())
      return onToast({ title: t('ni.needLotProducer'), bad: true })
    setSaving(true)
    try {
      const payload = {
        commodity_code: code,
        producer: header.producer.trim() || null,
        lot: header.lot.trim() || null,
        variety: header.variety || null,
        caliber: header.caliber || null,
        packaging_code: header.packaging_code || null,
        packaging_type: header.packaging_type || null,
        packaging_date: header.packaging_date || null,
        net_weight: num(header.net_weight),
        brix_avg: num(header.brix_avg),
        temp_water: num(header.temp_water),
        temp_ambient: num(header.temp_ambient),
        temp_pulp: num(header.temp_pulp),
        notes: header.notes || null,
        metrics: values,
        photos,
        assignment_id: null,
      }
      const res = await fetch('/api/inspecciones', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.msg || t('ni.errSave'))
      onToast({
        title: t('ni.saved'),
        sub: `ID ${data.id}` + (data.warnings?.length ? ` · ${data.warnings.join(' · ')}` : ''),
      })
      onDone()
    } catch (e) {
      onToast({ title: t('ni.errSave'), sub: e.message, bad: true })
    } finally {
      setSaving(false)
    }
  }

  const numberField = (key, labelKey) => (
    <Field label={t(labelKey)}>
      <input className="input" type="number" step="0.01" value={header[key]} onChange={setH(key)} />
    </Field>
  )

  return (
    <div className="content-inner fade-up">
      <div className="grid cols-2-1" style={{ alignItems: 'start', marginBottom: 16 }}>
        <Card title={t('ni.headerTitle')} sub={t('ni.headerSub')}>
          <div style={GRID3}>
            <Field label={t('ni.commodity')} required>
              <select className="select" value={code} onChange={e => setCode(e.target.value)}>
                {commodities.map(c => <option key={c.code} value={c.code}>{c.es_name || c.name || c.code}</option>)}
              </select>
            </Field>
            <Field label={t('tbl.productor')} required>
              <input className="input" value={header.producer} onChange={setH('producer')} placeholder={t('asg.producerPh')} />
            </Field>
            <Field label={t('ni.lot')} required>
              <input className="input" value={header.lot} onChange={setH('lot')} placeholder="L-2026-001" />
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
            {numberField('net_weight', 'ni.netWeight')}
            {numberField('brix_avg', 'ni.brix')}
            {numberField('temp_water', 'ni.tempWater')}
            {numberField('temp_ambient', 'ni.tempAmbient')}
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
          </div>
          {tplErr && <div className="form-help" style={{ color: 'var(--red)', marginTop: 10 }}>{tplErr}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn" onClick={onCancel} disabled={saving}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving || !code}>
              <Icon name="check" size={15} />
              {saving ? t('common.saving') : t('ni.save')}
            </button>
          </div>
        </Card>
      </div>

      {Object.entries(grouped).map(([grp, grpFields]) => (
        <Card key={grp} title={t(`ni.group.${grp}`) === `ni.group.${grp}` ? humanize(grp) : t(`ni.group.${grp}`)}
          style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
            {grpFields.map(f => (
              <div key={f.key} style={{ background: 'var(--surface-2, rgba(0,0,0,.02))', borderRadius: 10, padding: 12, border: '1px solid var(--border)' }}>
                <label className="field-label">
                  {humanize(bareKey(f.key))}{f.unit ? ` (${f.unit})` : ''}{f.required ? ' *' : ''}
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
    </div>
  )
}
