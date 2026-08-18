'use client'
import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { useI18n } from '@/lib/i18n'
import { Modal, Field, RowAction, ScreenState } from './_ui'
import { commodityVisual } from '@/lib/inspectorData'
import { listStandards, createStandard, getStandard, saveDefectTolerances, listCommodities } from '@/lib/adminCrud'

const BAND_COLOR = { 1: 'var(--green)', 2: 'oklch(0.72 0.15 130)', 3: 'var(--amber)', 4: 'oklch(0.70 0.17 50)', 5: 'var(--red)' }
const fmtRange = (b) => (b.min_pct == null && b.max_pct == null) ? '—' : `${b.min_pct ?? 0}–${b.max_pct == null ? '∞' : b.max_pct}`

function NewStandardModal({ commodities, onClose, onSaved, onToast }) {
  const { t } = useI18n()
  const [form, setForm] = useState({ commodityCode: commodities[0]?.code || '', name: '' })
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!form.name.trim() || !form.commodityCode) return onToast({ title: t('common.missingData'), bad: true })
    setBusy(true)
    try { await createStandard(form); onToast({ title: t('tol.created'), sub: form.name }); onSaved() }
    catch (e) { onToast({ title: t('common.error'), sub: e.message, bad: true }) }
    finally { setBusy(false) }
  }
  return (
    <Modal title={t('tol.newTitle')} icon="tolerance" onClose={onClose}
      footer={<><button className="btn" onClick={onClose} disabled={busy}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={submit} disabled={busy}><Icon name="check" size={15} />{busy ? t('common.creating') : t('common.create')}</button></>}>
      <Field label={t('tbl.commodity')} required>
        <select className="select" value={form.commodityCode} onChange={e => setForm(f => ({ ...f, commodityCode: e.target.value }))}>
          {commodities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </Field>
      <Field label={t('tol.stdName')} required><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('tol.stdNamePh')} /></Field>
    </Modal>
  )
}

function BandsModal({ standardId, defect, onClose, onSaved, onToast }) {
  const { t } = useI18n()
  const unit = defect.unit || '%'
  const [bands, setBands] = useState(defect.bands.map(b => ({ ...b })))
  const [busy, setBusy] = useState(false)
  const setB = (i, k, v) => setBands(bs => bs.map((b, j) => j === i ? { ...b, [k]: v } : b))
  const submit = async () => {
    setBusy(true)
    try {
      const payload = bands.map(b => ({ band: b.band, band_label: b.band_label, min_pct: b.min_pct === '' ? null : b.min_pct, max_pct: b.max_pct === '' ? null : b.max_pct }))
      await saveDefectTolerances(standardId, defect.defect_id, payload)
      onToast({ title: t('tol.saved'), sub: defect.label })
      onSaved()
    } catch (e) { onToast({ title: t('common.error'), sub: e.message, bad: true }) }
    finally { setBusy(false) }
  }
  return (
    <Modal title={t('tol.bandsTitle', { label: defect.label })} icon="tolerance" onClose={onClose}
      footer={<><button className="btn" onClick={onClose} disabled={busy}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={submit} disabled={busy}><Icon name="check" size={15} />{busy ? t('common.saving') : t('common.save')}</button></>}>
      <div className="form-help" style={{ marginBottom: 12 }}>{t('tol.bandsHelp', { unit })}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: 8, alignItems: 'center' }}>
        <div className="field-label" style={{ margin: 0 }}>{t('tol.band')}</div><div className="field-label" style={{ margin: 0 }}>{t('tol.min', { unit })}</div><div className="field-label" style={{ margin: 0 }}>{t('tol.max', { unit })}</div>
        {bands.map((b, i) => (
          <FragmentRow key={b.band} b={b} i={i} setB={setB} />
        ))}
      </div>
    </Modal>
  )
}
function FragmentRow({ b, i, setB }) {
  return (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: BAND_COLOR[b.band] }} />{b.band_label}</span>
      <input className="input mono" inputMode="decimal" value={b.min_pct ?? ''} onChange={e => setB(i, 'min_pct', e.target.value)} placeholder="0" />
      <input className="input mono" inputMode="decimal" value={b.max_pct ?? ''} onChange={e => setB(i, 'max_pct', e.target.value)} placeholder="∞" />
    </>
  )
}

export default function ToleranciasScreen({ onToast }) {
  const { t } = useI18n()
  const [standards, setStandards] = useState([])
  const [commodities, setCommodities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sel, setSel] = useState(null)
  const [selLoading, setSelLoading] = useState(false)
  const [newStd, setNewStd] = useState(false)
  const [editDefect, setEditDefect] = useState(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    listStandards().then(setStandards).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load(); listCommodities().then(setCommodities).catch(() => {}) }, [load])

  const openStandard = (id) => {
    setSelLoading(true)
    getStandard(id).then(setSel).catch(e => onToast({ title: t('common.error'), sub: e.message, bad: true })).finally(() => setSelLoading(false))
  }
  const reloadSel = () => sel && openStandard(sel.standard.id)
  const unit = sel?.defects[0]?.unit || '%'

  return (
    <div className="content-inner fade-up">
      <div className="crud-toolbar">
        <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>{t('tol.count', { n: standards.length })}</span>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setNewStd(true)}><Icon name="plus" size={15} stroke={2.2} />{t('tol.new')}</button>
      </div>

      <Card pad={true}>
        <ScreenState loading={loading} error={error} empty={!loading && !error && standards.length === 0} emptyIcon="tolerance" emptyText={t('tol.empty')}>
          <table className="tbl">
            <thead><tr><th>{t('tol.standard')}</th><th>{t('tbl.commodity')}</th><th className="num">{t('tol.defectsWithTol')}</th><th></th></tr></thead>
            <tbody>
              {standards.map(s => {
                const v = commodityVisual(s.commodity_code, t)
                return (
                  <tr key={s.id} onClick={() => openStandard(s.id)} style={{ cursor: 'pointer', background: sel?.standard.id === s.id ? 'var(--accent-soft)' : undefined }}>
                    <td className="cell-strong">{s.name}</td>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}><span className={'commodity-ico ' + v.key} style={{ width: 24, height: 24, borderRadius: 6 }}><Icon name={v.icon} size={13} /></span>{v.label}</span></td>
                    <td className="num">{s.defects_with_tol}</td>
                    <td style={{ width: 30, color: 'var(--text-faint)' }}><Icon name="chevRight" size={16} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScreenState>
      </Card>

      {(sel || selLoading) && (
        <Card style={{ marginTop: 16 }} pad={true} title={sel ? t('tol.detailTitle', { name: sel.standard.name }) : t('common.loading')} sub={sel ? sel.standard.commodity_name : ''}>
          {selLoading ? <div className="empty" style={{ padding: 40 }}><Icon name="clock" size={18} /> {t('common.loading')}</div> : (
            <table className="tbl">
              <thead><tr><th>{t('tol.defect')}</th><th>{t('tol.family')}</th><th>{t('tol.bandsCol', { unit })}</th><th></th></tr></thead>
              <tbody>
                {sel.defects.map(d => (
                  <tr key={d.defect_id}>
                    <td className="cell-strong" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{d.is_major && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)' }} />}{d.label}</td>
                    <td style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>{t('fam.' + d.family)}</td>
                    <td>
                      {d.hasTol ? (
                        <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap' }}>
                          {d.bands.map(b => <span key={b.band} className="pill-tag" style={{ borderColor: BAND_COLOR[b.band] + '55' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: BAND_COLOR[b.band] }} />{fmtRange(b)}</span>)}
                        </span>
                      ) : <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>{t('tol.noTol')}</span>}
                    </td>
                    <td style={{ width: 50 }}><span className="row-actions"><RowAction icon="sliders" title={t('tol.editBands')} onClick={() => setEditDefect(d)} /></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {newStd && <NewStandardModal commodities={commodities} onClose={() => setNewStd(false)} onSaved={() => { setNewStd(false); load() }} onToast={onToast} />}
      {editDefect && sel && <BandsModal standardId={sel.standard.id} defect={editDefect} onClose={() => setEditDefect(null)} onSaved={() => { setEditDefect(null); reloadSel(); load() }} onToast={onToast} />}
    </div>
  )
}
