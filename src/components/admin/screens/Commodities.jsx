'use client'
import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { Modal, Field, RowAction, ScreenState } from './_ui'
import { commodityVisual } from '@/lib/inspectorData'
import { listCommoditiesAdmin, createCommodity, updateCommodity } from '@/lib/adminCrud'

function CommodityModal({ item, onClose, onSaved, onToast }) {
  const editing = !!item
  const [form, setForm] = useState({ code: item?.code || '', name: item?.name || '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const submit = async () => {
    if (!form.name.trim() || (!editing && !form.code.trim())) return onToast({ title: 'Faltan datos', sub: 'Código y nombre obligatorios', bad: true })
    setBusy(true)
    try {
      if (editing) await updateCommodity(item.code, { name: form.name })
      else await createCommodity({ code: form.code, name: form.name })
      onToast({ title: editing ? 'Commodity actualizado' : 'Commodity creado', sub: form.name })
      onSaved()
    } catch (e) { onToast({ title: 'Error', sub: e.message, bad: true }) }
    finally { setBusy(false) }
  }
  return (
    <Modal title={editing ? 'Editar commodity' : 'Nuevo commodity'} icon="grape" onClose={onClose}
      footer={<><button className="btn" onClick={onClose} disabled={busy}>Cancelar</button><button className="btn btn-primary" onClick={submit} disabled={busy}><Icon name="check" size={15} />{busy ? 'Guardando…' : 'Guardar'}</button></>}>
      <Field label="Código" required help={editing ? 'El código no se puede cambiar.' : 'Mayúsculas, sin espacios (ej. BLUEBERRY).'}>
        <input className="input mono" value={form.code} disabled={editing} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="BLUEBERRY" />
      </Field>
      <Field label="Nombre" required><input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Arándano" /></Field>
    </Modal>
  )
}

export default function CommoditiesScreen({ onToast }) {
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
    catch (e) { onToast({ title: 'Error', sub: e.message, bad: true }) }
    finally { setBusyCode(null) }
  }

  return (
    <div className="content-inner fade-up">
      <div className="crud-toolbar">
        <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>{rows.length} commodities</span>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setModal({})}><Icon name="plus" size={15} stroke={2.2} />Nuevo commodity</button>
      </div>
      <Card pad={true}>
        <ScreenState loading={loading} error={error} empty={!loading && !error && rows.length === 0} emptyIcon="grape" emptyText="No hay commodities.">
          <table className="tbl">
            <thead><tr><th>Commodity</th><th>Código</th><th className="num">Plantillas</th><th className="num">Tolerancias</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {rows.map(c => {
                const v = commodityVisual(c.code)
                return (
                  <tr key={c.code}>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 13 }}><span className={'commodity-ico ' + v.key} style={{ width: 28, height: 28, borderRadius: 7 }}><Icon name={v.icon} size={15} /></span><span className="cell-strong">{c.name}</span></span></td>
                    <td className="mono" style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>{c.code}</td>
                    <td className="num">{c.templates}</td>
                    <td className="num">{c.standards > 0 ? c.standards : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                        <button className={'switch' + (c.active ? ' on' : '')} disabled={busyCode === c.code} onClick={() => toggle(c)} title={c.active ? 'Activo' : 'Inactivo'} />
                        <span style={{ fontSize: 12, color: c.active ? 'var(--green)' : 'var(--text-faint)' }}>{c.active ? 'Activo' : 'Inactivo'}</span>
                      </span>
                    </td>
                    <td style={{ width: 60 }}><span className="row-actions"><RowAction icon="edit" title="Editar" onClick={() => setModal({ item: c })} /></span></td>
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
