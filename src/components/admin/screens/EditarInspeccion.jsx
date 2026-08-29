'use client'
import { useState } from 'react'
import { Icon } from '@/components/proto/Icon'
import { useI18n } from '@/lib/i18n'
import { Modal, Field } from './_ui'
import { updateInspeccion, updateInspeccionMetrics } from '@/lib/adminCrud'

const HEAD_KEYS = ['producer', 'variety', 'brix_avg', 'brix_min', 'brix_max', 'diameter_min', 'diameter_max', 'temp_water', 'temp_ambient', 'temp_pulp', 'net_weight', 'sample_weight_g', 'notes']
const numOrNull = (v) => v === '' || v == null ? null : Number(v)

export default function EditarInspeccion({ detail, onClose, onSaved, onToast }) {
  const { t } = useI18n()
  const [head, setHead] = useState(() => {
    const h = {}
    HEAD_KEYS.forEach(k => { h[k] = detail[k] == null ? '' : String(detail[k]) })
    return h
  })
  const [metrics, setMetrics] = useState(() => ({ ...(detail.metrics?.values || {}) }))
  const [busy, setBusy] = useState(false)
  const setH = (k, v) => setHead(s => ({ ...s, [k]: v }))
  const setM = (k, v) => setMetrics(s => ({ ...s, [k]: v }))
  const measurements = detail.measurements || []

  const submit = async () => {
    setBusy(true)
    try {
      // 1) reemplaza mediciones (recalcula), 2) actualiza cabecera (recalcula con el set final)
      if (measurements.length) await updateInspeccionMetrics(detail.id, metrics)
      await updateInspeccion(detail.id, {
        producer: head.producer || null,
        variety: head.variety || null,
        brix_avg: numOrNull(head.brix_avg), brix_min: numOrNull(head.brix_min), brix_max: numOrNull(head.brix_max),
        diameter_min: numOrNull(head.diameter_min), diameter_max: numOrNull(head.diameter_max),
        temp_water: numOrNull(head.temp_water), temp_ambient: numOrNull(head.temp_ambient), temp_pulp: numOrNull(head.temp_pulp),
        net_weight: numOrNull(head.net_weight), sample_weight_g: numOrNull(head.sample_weight_g),
        notes: head.notes || null,
      })
      onToast({ title: t('edit.saved'), sub: `#${detail.id}` })
      onSaved()
    } catch (e) { onToast({ title: t('common.error'), sub: e.message, bad: true }) }
    finally { setBusy(false) }
  }

  return (
    <Modal size="lg" title={`${t('edit.title')} #${detail.id}`} icon="edit" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}><Icon name="check" size={15} />{busy ? t('common.saving') : t('common.save')}</button>
      </>}>
      <div className="form-help" style={{ marginBottom: 14 }}>{t('edit.recalcNote')}</div>

      <div className="sec-title" style={{ marginBottom: 12 }}>{t('edit.header')}</div>
      <div className="form-grid">
        <Field label={t('tbl.productor')}><input className="input" value={head.producer} onChange={e => setH('producer', e.target.value)} /></Field>
        <Field label={t('tbl.variedad')}><input className="input" value={head.variety} onChange={e => setH('variety', e.target.value)} /></Field>
      </div>
      <div className="form-grid">
        <Field label={`${t('cap.brix')} ${t('cap.average')} (°Bx)`}><input className="input mono" inputMode="decimal" value={head.brix_avg} onChange={e => setH('brix_avg', e.target.value)} /></Field>
        <Field label={`${t('cap.brix')} ${t('cap.min')} / ${t('cap.max')}`}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input mono" inputMode="decimal" value={head.brix_min} onChange={e => setH('brix_min', e.target.value)} placeholder={t('cap.min')} />
            <input className="input mono" inputMode="decimal" value={head.brix_max} onChange={e => setH('brix_max', e.target.value)} placeholder={t('cap.max')} />
          </div>
        </Field>
      </div>
      <div className="form-grid">
        <Field label={`${t('cap.caliber')}`}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input mono" inputMode="decimal" value={head.diameter_min} onChange={e => setH('diameter_min', e.target.value)} placeholder={t('cap.min')} />
            <input className="input mono" inputMode="decimal" value={head.diameter_max} onChange={e => setH('diameter_max', e.target.value)} placeholder={t('cap.max')} />
          </div>
        </Field>
        <Field label={`${t('cap.netWeight')} (g)`}><input className="input mono" inputMode="decimal" value={head.net_weight} onChange={e => setH('net_weight', e.target.value)} /></Field>
        <Field label={`${t('cap.sampleWeight')} (g)`}><input className="input mono" inputMode="decimal" value={head.sample_weight_g} onChange={e => setH('sample_weight_g', e.target.value)} /></Field>
      </div>
      <div className="form-grid">
      </div>
      <div className="form-grid">
        <Field label={`${t('cap.pulp')} (°C)`}><input className="input mono" inputMode="decimal" value={head.temp_pulp} onChange={e => setH('temp_pulp', e.target.value)} /></Field>
      </div>
      <Field label={t('ins.observations')}><textarea className="textarea" rows={2} value={head.notes} onChange={e => setH('notes', e.target.value)} /></Field>

      {measurements.length > 0 && (<>
        <div className="sec-title" style={{ margin: '6px 0 12px' }}>{t('edit.defects')}</div>
        <div className="form-grid">
          {measurements.map(m => {
            const type = m.value_type || 'number'
            const v = metrics[m.key] ?? ''
            return (
              <Field key={m.key} label={m.label || m.key}>
                {type === 'boolean' ? (
                  <div className="seg" style={{ width: '100%' }}>
                    <button type="button" className={v === 'true' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setM(m.key, 'true')}>{t('cap.yes')}</button>
                    <button type="button" className={v === 'false' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setM(m.key, 'false')}>{t('cap.no')}</button>
                  </div>
                ) : type === 'number' ? (
                  <input className="input mono" inputMode="decimal" value={v} onChange={e => setM(m.key, e.target.value)} />
                ) : (
                  <input className="input" value={v} onChange={e => setM(m.key, e.target.value)} />
                )}
              </Field>
            )
          })}
        </div>
      </>)}
    </Modal>
  )
}
