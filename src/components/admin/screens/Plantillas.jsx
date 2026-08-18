'use client'
import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { useI18n } from '@/lib/i18n'
import { Modal, Field, RowAction, ScreenState } from './_ui'
import { fechaCorta } from '@/lib/proto'
import { commodityVisual } from '@/lib/inspectorData'
import { listTemplates, getTemplate, createTemplate, updateTemplateFields, listCommodities } from '@/lib/adminCrud'

const FAMILIES = ['quality', 'condition', 'packaging', 'measurement']
const TYPES = ['number', 'select', 'boolean', 'text']

const splitKey = (k) => { const i = String(k).indexOf('.'); return i === -1 ? ['quality', k] : [k.slice(0, i), k.slice(i + 1)] }
const blankRow = () => ({ family: 'quality', code: '', label: '', field_type: 'number', unit: '%', required: false, options: '' })

function TemplateModal({ tpl, commodities, onClose, onSaved, onToast }) {
  const { t } = useI18n()
  const editing = !!tpl
  const [commodityCode, setCommodityCode] = useState(commodities[0]?.code || '')
  const [name, setName] = useState('')
  const [rows, setRows] = useState([blankRow()])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(editing)

  useEffect(() => {
    if (!editing) return
    getTemplate(tpl.id).then(d => {
      setName(d.template?.name || '')
      setCommodityCode(d.template?.commodity_code || '')
      const fr = (d.fields || []).map(f => { const [family, code] = splitKey(f.key); return { family, code, label: f.label || '', field_type: f.field_type || 'number', unit: f.unit || '', required: !!f.required, options: Array.isArray(f.options) ? f.options.map(o => o.value ?? o).join(', ') : '' } })
      setRows(fr.length ? fr : [blankRow()])
    }).catch(e => onToast({ title: t('common.error'), sub: e.message, bad: true })).finally(() => setLoading(false))
  }, [editing, tpl])

  const setRow = (i, k, v) => setRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r))
  const addRow = () => setRows(rs => [...rs, blankRow()])
  const rmRow = (i) => setRows(rs => rs.filter((_, j) => j !== i))

  const buildFields = () => rows.filter(r => r.code.trim() && r.label.trim()).map(r => ({
    key: `${r.family}.${r.code.trim().toLowerCase().replace(/\s+/g, '_')}`,
    label: r.label.trim(),
    field_type: r.field_type,
    required: !!r.required,
    unit: r.unit?.trim() || null,
    options: r.field_type === 'select' ? r.options.split(',').map(s => s.trim()).filter(Boolean) : undefined,
  }))

  const submit = async () => {
    const fields = buildFields()
    if (!editing && (!name.trim() || !commodityCode)) return onToast({ title: t('common.missingData'), sub: t('tpl.needData'), bad: true })
    if (fields.length === 0) return onToast({ title: t('tpl.noFieldsTitle'), sub: t('tpl.noFields'), bad: true })
    setBusy(true)
    try {
      if (editing) { await updateTemplateFields(tpl.id, fields); onToast({ title: t('tpl.updated'), sub: name }) }
      else { const r = await createTemplate({ commodityCode, name, fields }); onToast({ title: t('tpl.created'), sub: `v${r.version}` }) }
      onSaved()
    } catch (e) { onToast({ title: t('common.error'), sub: e.message, bad: true }) }
    finally { setBusy(false) }
  }

  return (
    <Modal size="lg" title={editing ? t('tpl.editTitle', { name: tpl.commodity_name, ver: tpl.version }) : t('tpl.new')} icon="template" onClose={onClose}
      footer={<><button className="btn" onClick={onClose} disabled={busy}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={submit} disabled={busy || loading}><Icon name="check" size={15} />{busy ? t('common.saving') : (editing ? t('tpl.editFields') : t('tpl.createTpl'))}</button></>}>
      {loading ? <div className="empty" style={{ padding: 40 }}><Icon name="clock" size={18} /> {t('common.loading')}</div> : (
        <>
          {!editing && (
            <div className="form-grid">
              <Field label={t('tbl.commodity')} required>
                <select className="select" value={commodityCode} onChange={e => setCommodityCode(e.target.value)}>
                  {commodities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </Field>
              <Field label={t('tbl.nombre')} required><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder={t('tpl.namePh')} /></Field>
            </div>
          )}
          {editing && <div className="form-help" style={{ marginBottom: 12 }}>{t('tpl.editReplaces')}</div>}

          <div className="field-label" style={{ marginBottom: 8 }}>{t('tpl.fieldsDefects')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.3fr 1fr', gap: 8, marginBottom: 8 }}>
                  <select className="select" value={r.family} onChange={e => setRow(i, 'family', e.target.value)}>{FAMILIES.map(f => <option key={f} value={f}>{t('fam.' + f)}</option>)}</select>
                  <input className="input mono" value={r.code} onChange={e => setRow(i, 'code', e.target.value)} placeholder={t('tpl.codePh')} />
                  <input className="input" value={r.label} onChange={e => setRow(i, 'label', e.target.value)} placeholder={t('tpl.labelPh')} />
                  <select className="select" value={r.field_type} onChange={e => setRow(i, 'field_type', e.target.value)}>{TYPES.map(ty => <option key={ty} value={ty}>{t('ft.' + ty)}</option>)}</select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {r.field_type === 'select'
                    ? <input className="input" style={{ flex: 1, minWidth: 180 }} value={r.options} onChange={e => setRow(i, 'options', e.target.value)} placeholder={t('tpl.optionsPh')} />
                    : <input className="input mono" style={{ width: 90 }} value={r.unit} onChange={e => setRow(i, 'unit', e.target.value)} placeholder={t('tpl.unitPh')} />}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-dim)', cursor: 'pointer' }}>
                    <button type="button" className={'switch' + (r.required ? ' on' : '')} onClick={() => setRow(i, 'required', !r.required)} />{t('tpl.required')}
                  </label>
                  <button className="btn btn-icon btn-sm" style={{ marginLeft: 'auto', color: 'var(--red)' }} title={t('common.delete')} onClick={() => rmRow(i)} disabled={rows.length === 1}><Icon name="trash" size={15} /></button>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={addRow}><Icon name="plus" size={14} />{t('tpl.addField')}</button>
        </>
      )}
    </Modal>
  )
}

export default function PlantillasScreen({ onToast }) {
  const { t } = useI18n()
  const [rows, setRows] = useState([])
  const [commodities, setCommodities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    listTemplates().then(setRows).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load(); listCommodities().then(setCommodities).catch(() => {}) }, [load])

  return (
    <div className="content-inner fade-up">
      <div className="crud-toolbar">
        <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>{t('tpl.count', { n: rows.length })}</span>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setModal({})}><Icon name="plus" size={15} stroke={2.2} />{t('tpl.new')}</button>
      </div>
      <Card pad={true}>
        <ScreenState loading={loading} error={error} empty={!loading && !error && rows.length === 0} emptyIcon="template" emptyText={t('tpl.empty')}>
          <table className="tbl">
            <thead><tr><th>{t('nav.plantillas')}</th><th>{t('tbl.commodity')}</th><th className="num">{t('tpl.version')}</th><th className="num">{t('tpl.fields')}</th><th>{t('tbl.estado')}</th><th>{t('tbl.creado')}</th><th></th></tr></thead>
            <tbody>
              {rows.map(tp => {
                const v = commodityVisual(tp.commodity_code, t)
                return (
                  <tr key={tp.id}>
                    <td className="cell-strong">{tp.name}</td>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}><span className={'commodity-ico ' + v.key} style={{ width: 24, height: 24, borderRadius: 6 }}><Icon name={v.icon} size={13} /></span>{v.label}</span></td>
                    <td className="num mono">v{tp.version}</td>
                    <td className="num">{tp.fields}</td>
                    <td>{tp.active ? <span className="badge green" style={{ height: 22, fontSize: 11 }}>{t('tpl.activeBadge')}</span> : <span className="pill-tag" style={{ color: 'var(--text-faint)' }}>{t('tpl.inactiveBadge')}</span>}</td>
                    <td className="mono" style={{ color: 'var(--text-faint)', fontSize: 12 }}>{fechaCorta(tp.created_at)}</td>
                    <td style={{ width: 50 }}><span className="row-actions"><RowAction icon="edit" title={t('tpl.editFields')} onClick={() => setModal({ tpl: tp })} /></span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScreenState>
      </Card>
      {modal && <TemplateModal tpl={modal.tpl} commodities={commodities} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} onToast={onToast} />}
    </div>
  )
}
