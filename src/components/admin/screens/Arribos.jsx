'use client'
import { useState, useEffect, useCallback } from 'react'
import { Card, StatusBadge } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { Modal, Field, ScreenState, RowAction, ConfirmDialog } from './_ui'
import { useI18n } from '@/lib/i18n'
import { commodityVisual } from '@/lib/inspectorData'

const api = async (path, opts = {}) => {
  const res = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.msg || 'Error')
  return data
}

const EMPTY = {
  container: '', commodity_code: 'BLUEBERRY', warehouse: '', carrier_type: 'Marítimo',
  vessel: '', arrival_date: '', warehouse_date: '', week_no: '', cartons: '',
  atmosphere: '', o2_pct: '', co2_pct: '', upc: '', fumigation: false, notes: '',
}

function NuevoArribo({ onClose, onSaved, onToast }) {
  const { t } = useI18n()
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!form.container.trim()) return onToast({ title: t('arr.needContainer'), bad: true })
    setBusy(true)
    try {
      await api('/api/arrivals', { method: 'POST', body: JSON.stringify(form) })
      onToast({ title: t('arr.created') })
      onSaved()
    } catch (e) {
      onToast({ title: t('arr.errSave'), sub: e.message, bad: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('arr.new')} icon="package" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          <Icon name="check" size={15} />{busy ? t('common.saving') : t('common.save')}
        </button>
      </>}>
      <div className="form-grid" style={{ gap: '0 14px' }}>
        <Field label={t('arr.container')} required>
          <input className="input" value={form.container} onChange={(e) => set('container', e.target.value)} placeholder="ZMOU5555481" />
        </Field>
        <Field label={t('arr.warehouse')}>
          <input className="input" value={form.warehouse} onChange={(e) => set('warehouse', e.target.value)} placeholder="Four Seasons" />
        </Field>
        <Field label={t('arr.carrier')}>
          <select className="select" value={form.carrier_type} onChange={(e) => set('carrier_type', e.target.value)}>
            {['Marítimo', 'Aéreo', 'Terrestre'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label={t('arr.vessel')}>
          <input className="input" value={form.vessel} onChange={(e) => set('vessel', e.target.value)} />
        </Field>
        <Field label={t('arr.arrivalDate')}>
          <input className="input" type="date" value={form.arrival_date} onChange={(e) => set('arrival_date', e.target.value)} />
        </Field>
        <Field label={t('arr.warehouseDate')}>
          <input className="input" type="date" value={form.warehouse_date} onChange={(e) => set('warehouse_date', e.target.value)} />
        </Field>
        <Field label={t('arr.week')}>
          <input className="input" type="number" value={form.week_no} onChange={(e) => set('week_no', e.target.value)} />
        </Field>
        <Field label={t('arr.cartons')}>
          <input className="input" type="number" value={form.cartons} onChange={(e) => set('cartons', e.target.value)} />
        </Field>
        <Field label="UPC">
          <input className="input" value={form.upc} onChange={(e) => set('upc', e.target.value)} />
        </Field>
        <Field label={t('arr.atmosphere')}>
          <input className="input" value={form.atmosphere} onChange={(e) => set('atmosphere', e.target.value)} placeholder="AC" />
        </Field>
        <Field label="% O2">
          <input className="input" type="number" step="0.01" value={form.o2_pct} onChange={(e) => set('o2_pct', e.target.value)} />
        </Field>
        <Field label="% CO2">
          <input className="input" type="number" step="0.01" value={form.co2_pct} onChange={(e) => set('co2_pct', e.target.value)} />
        </Field>
      </div>
      <Field label={t('arr.fumigation')}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.fumigation} onChange={(e) => set('fumigation', e.target.checked)} />
          {t('arr.fumigated')}
        </label>
      </Field>
      <Field label={t('ni.notes')}>
        <textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
    </Modal>
  )
}

function DetalleArribo({ id, onToast, onAddInspection, onReinspect, onBack }) {
  const { t, lang } = useI18n()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    api(`/api/arrivals/${id}`).then(setData).catch((e) => setError(e.message))
  }, [id])
  useEffect(load, [load])

  if (error) return <div className="empty"><div className="ei"><Icon name="xCircle" size={20} /></div>{error}</div>
  if (!data) return <div className="empty" style={{ padding: 30 }}><Icon name="clock" size={16} /> {t('common.loading')}</div>

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CL') : '—')
  const meta = [
    [t('arr.warehouse'), data.warehouse], [t('arr.carrier'), data.carrier_type],
    [t('arr.arrivalDate'), fmtDate(data.arrival_date)], [t('arr.week'), data.week_no],
    [t('arr.cartons'), data.cartons], ['UPC', data.upc],
  ]

  return (
    <Card
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <button className="btn btn-icon btn-sm" onClick={onBack} title={t('common.back')}><Icon name="chevLeft" size={15} /></button>
        {t('arr.detail')} · {data.container}
      </span>}
      action={
        <button className="btn btn-primary btn-sm" onClick={() => onAddInspection(data)}>
          <Icon name="plus" size={14} /> {t('arr.addInspection')}
        </button>
      }>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
        {meta.map(([label, v]) => (
          <div key={label}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{v ?? '—'}</div>
          </div>
        ))}
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th>ID</th><th>{t('tbl.loteProductor')}</th><th>{t('tbl.variedad')}</th>
            <th className="num">{t('tbl.score')}</th><th>{t('tbl.resolucion')}</th>
            <th>{t('arr.causal')}</th><th>Baxlo</th><th></th>
          </tr>
        </thead>
        <tbody>
          {data.inspections.map((i) => (
            <tr key={i.id}>
              <td className="mono">#{i.id}{i.reinspection_of ? <span title={`${t('arr.reinspOf')} #${i.reinspection_of}`} style={{ color: 'var(--accent)', fontWeight: 700 }}> ↺</span> : ''}</td>
              <td><div className="cell-strong mono" style={{ fontSize: 12 }}>{i.lot || '—'}{i.pallet_code && i.pallet_code !== 'P1' ? <span style={{ color: 'var(--accent)', fontWeight: 700 }}> · {i.pallet_code}</span> : ''}</div><div className="cell-dim">{i.producer || ''}</div></td>
              <td style={{ color: 'var(--text-dim)' }}>{i.variety || '—'}</td>
              <td className="num">{i.score ?? '—'}</td>
              <td><StatusBadge resolucion={i.resolution === 'approved' ? 'aprobado' : i.resolution === 'conditional' ? 'condicional' : i.resolution === 'rejected' ? 'rechazado' : i.resolution} /></td>
              <td style={{ fontSize: 12.5 }}>{i.causal || '—'}</td>
              <td className="mono" style={{ fontSize: 12 }}>
                {i.firmness_min != null || i.firmness_max != null
                  ? `${i.firmness_min ?? '—'}-${i.firmness_mode ?? '—'}-${i.firmness_max ?? '—'}`
                  : '—'}
              </td>
              <td style={{ width: 36 }}>
                <RowAction icon="clipboardCheck" title={t('arr.reinspect')} onClick={() => onReinspect(data, i)} />
              </td>
            </tr>
          ))}
          {data.inspections.length === 0 && (
            <tr><td colSpan={8}><div className="empty">{t('arr.noInspections')}</div></td></tr>
          )}
        </tbody>
      </table>
    </Card>
  )
}

export default function ArribosScreen({ onToast, onAddInspection, onReinspect }) {
  const { t, lang } = useI18n()
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api('/api/arrivals').then(setList).catch((e) => setError(e.message))
  }, [])
  useEffect(load, [load])

  const remove = async () => {
    setBusy(true)
    try {
      await api(`/api/arrivals/${toDelete.id}`, { method: 'DELETE' })
      onToast({ title: t('arr.deleted') })
      setToDelete(null)
      load()
    } catch (e) {
      onToast({ title: t('arr.errSave'), sub: e.message, bad: true })
    } finally {
      setBusy(false)
    }
  }

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CL') : '—')

  return (
    <div className="content-inner fade-up">
      {openId ? (
        <DetalleArribo id={openId} onToast={onToast} onBack={() => { setOpenId(null); load() }}
          onAddInspection={onAddInspection} onReinspect={onReinspect} />
      ) : (
        <Card
          title={t('arr.listTitle')}
          action={<button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><Icon name="plus" size={14} /> {t('arr.new')}</button>}>
          <ScreenState loading={!list && !error} error={error} empty={list?.length === 0} emptyIcon="package" emptyText={t('arr.empty')}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('arr.container')}</th><th>{t('arr.warehouse')}</th><th>{t('arr.arrivalDate')}</th>
                  <th className="num">{t('arr.week')}</th><th className="num">{t('arr.pallets')}</th>
                  <th className="num">{t('tbl.score')}</th><th>{t('arr.mainProblem')}</th><th></th>
                </tr>
              </thead>
              <tbody>
                {(list || []).map((a) => (
                  <tr key={a.id} onClick={() => setOpenId(a.id)} style={{ cursor: 'pointer' }}>
                    <td><div className="cell-strong mono" style={{ fontSize: 12.5 }}>{a.container}</div><div className="cell-dim">{a.commodity_code ? commodityVisual(a.commodity_code, t).label : ''}</div></td>
                    <td>{a.warehouse || '—'}</td>
                    <td className="mono" style={{ color: 'var(--text-dim)' }}>{fmtDate(a.arrival_date)}</td>
                    <td className="num">{a.week_no ?? '—'}</td>
                    <td className="num">
                      {a.pallets}
                      {(a.rejected > 0 || a.conditional > 0) && (
                        <span style={{ fontSize: 11, color: a.rejected ? 'var(--red)' : 'var(--amber, #b45309)', marginLeft: 5, fontWeight: 700 }}>
                          {a.rejected ? `${a.rejected}✗` : ''}{a.conditional ? ` ${a.conditional}!` : ''}
                        </span>
                      )}
                    </td>
                    <td className="num">{a.avg_score != null ? Math.round(a.avg_score * 10) / 10 : '—'}</td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{a.main_problem || '—'}</td>
                    <td style={{ width: 36 }}>
                      <RowAction icon="trash" title={t('common.delete')} danger onClick={() => setToDelete(a)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScreenState>
        </Card>
      )}

      {showNew && <NuevoArribo onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load() }} onToast={onToast} />}
      {toDelete && (
        <ConfirmDialog title={t('arr.deleteTitle')} message={t('arr.deleteMsg', { c: toDelete.container })}
          confirmLabel={t('common.delete')} danger busy={busy}
          onConfirm={remove} onClose={() => setToDelete(null)} />
      )}
    </div>
  )
}
