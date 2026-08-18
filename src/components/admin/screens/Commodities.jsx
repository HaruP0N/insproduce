'use client'
import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { useI18n } from '@/lib/i18n'
import { Modal, Field, RowAction, ScreenState } from './_ui'
import { commodityVisual } from '@/lib/inspectorData'
import { listCommoditiesAdmin, createCommodity, updateCommodity } from '@/lib/adminCrud'

function CommodityModal({ item, onClose, onSaved, onToast }) {
  const { t } = useI18n()
  const editing = !!item
  const [form, setForm] = useState({ code: item?.code || '', name: item?.name || '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const submit = async () => {
    if (!form.name.trim() || (!editing && !form.code.trim())) return onToast({ title: t('common.missingData'), sub: t('com.needData'), bad: true })
    setBusy(true)
    try {
      if (editing) await updateCommodity(item.code, { name: form.name })
      else await createCommodity({ code: form.code, name: form.name })
      onToast({ title: editing ? t('com.updated') : t('com.created'), sub: form.name })
      onSaved()
    } catch (e) { onToast({ title: t('common.error'), sub: e.message, bad: true }) }
    finally { setBusy(false) }
  }
  return (
    <Modal title={editing ? t('com.edit') : t('com.new')} icon="grape" onClose={onClose}
      footer={<><button className="btn" onClick={onClose} disabled={busy}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={submit} disabled={busy}><Icon name="check" size={15} />{busy ? t('common.saving') : t('common.save')}</button></>}>
      <Field label={t('tbl.codigo')} required help={editing ? t('com.codeHelpEdit') : t('com.codeHelpNew')}>
        <input className="input mono" value={form.code} disabled={editing} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="BLUEBERRY" />
      </Field>
      <Field label={t('tbl.nombre')} required><input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Arándano" /></Field>
    </Modal>
  )
}

export default function CommoditiesScreen({ onToast }) {
  const { t } = useI18n()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [busyCode, setBusyCode] = useState(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    listCommoditiesAdmin().then(setRows).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const toggle = async (c) => {
    setBusyCode(c.code)
    try { await updateCommodity(c.code, { active: !c.active }); setRows(l => l.map(x => x.code === c.code ? { ...x, active: !c.active } : x)) }
    catch (e) { onToast({ title: t('common.error'), sub: e.message, bad: true }) }
    finally { setBusyCode(null) }
  }

  return (
    <div className="content-inner fade-up">
      <div className="crud-toolbar">
        <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>{t('com.count', { n: rows.length })}</span>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setModal({})}><Icon name="plus" size={15} stroke={2.2} />{t('com.new')}</button>
      </div>
      <Card pad={true}>
        <ScreenState loading={loading} error={error} empty={!loading && !error && rows.length === 0} emptyIcon="grape" emptyText={t('com.empty')}>
          <table className="tbl">
            <thead><tr><th>{t('tbl.commodity')}</th><th>{t('tbl.codigo')}</th><th className="num">{t('com.templates')}</th><th className="num">{t('com.tolerances')}</th><th>{t('tbl.estado')}</th><th></th></tr></thead>
            <tbody>
              {rows.map(c => {
                const v = commodityVisual(c.code, t)
                return (
                  <tr key={c.code}>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 13 }}><span className={'commodity-ico ' + v.key} style={{ width: 28, height: 28, borderRadius: 7 }}><Icon name={v.icon} size={15} /></span><span className="cell-strong">{c.name}</span></span></td>
                    <td className="mono" style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>{c.code}</td>
                    <td className="num">{c.templates}</td>
                    <td className="num">{c.standards > 0 ? c.standards : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                        <button className={'switch' + (c.active ? ' on' : '')} disabled={busyCode === c.code} onClick={() => toggle(c)} title={c.active ? t('common.active') : t('common.inactive')} />
                        <span style={{ fontSize: 12, color: c.active ? 'var(--green)' : 'var(--text-faint)' }}>{c.active ? t('common.active') : t('common.inactive')}</span>
                      </span>
                    </td>
                    <td style={{ width: 60 }}><span className="row-actions"><RowAction icon="edit" title={t('common.edit')} onClick={() => setModal({ item: c })} /></span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScreenState>
      </Card>
      {modal && <CommodityModal item={modal.item} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} onToast={onToast} />}
    </div>
  )
}
