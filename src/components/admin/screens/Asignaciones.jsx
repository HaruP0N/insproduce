'use client'
import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { Modal, ConfirmDialog, Field, RowAction, ScreenState } from './_ui'
import { fechaCorta } from '@/lib/proto'
import { commodityVisual } from '@/lib/inspectorData'
import { listPendientes, createAssignment, setAssignmentStatus, deleteAssignment, listInspectores, listCommodities } from '@/lib/adminCrud'

function AssignModal({ inspectores, commodities, onClose, onSaved, onToast }) {
  const [form, setForm] = useState({ inspector_email: inspectores[0]?.email || '', commodity: commodities[0]?.code || '', lot: '', producer: '', variety: '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.inspector_email) return onToast({ title: 'Falta inspector', bad: true })
    if (!form.lot.trim() || !form.producer.trim()) return onToast({ title: 'Faltan datos', sub: 'Lote y productor son obligatorios', bad: true })
    setBusy(true)
    try {
      await createAssignment(form)
      onToast({ title: 'Asignación creada', sub: `${form.lot} → ${form.inspector_email}` })
      onSaved()
    } catch (e) { onToast({ title: 'Error', sub: e.message, bad: true }) }
    finally { setBusy(false) }
  }

  return (
    <Modal title="Nueva asignación" icon="clipboard" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}><Icon name="check" size={15} />{busy ? 'Asignando…' : 'Asignar'}</button>
      </>}>
      <Field label="Inspector" required>
        <select className="select" value={form.inspector_email} onChange={e => set('inspector_email', e.target.value)}>
          {inspectores.length === 0 && <option value="">No hay inspectores</option>}
          {inspectores.map(i => <option key={i.id} value={i.email}>{i.name} ({i.email})</option>)}
        </select>
      </Field>
      <Field label="Commodity" required>
        <select className="select" value={form.commodity} onChange={e => set('commodity', e.target.value)}>
          {commodities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </Field>
      <div className="form-grid">
        <Field label="Lote" required><input className="input mono" value={form.lot} onChange={e => set('lot', e.target.value)} placeholder="LOTE-0000" /></Field>
        <Field label="Variedad"><input className="input" value={form.variety} onChange={e => set('variety', e.target.value)} placeholder="Duke, Ventura…" /></Field>
      </div>
      <Field label="Productor" required><input className="input" value={form.producer} onChange={e => set('producer', e.target.value)} placeholder="Nombre del productor" /></Field>
    </Modal>
  )
}

export default function AsignacionesScreen({ onToast }) {
  const [rows, setRows] = useState([])
  const [inspectores, setInspectores] = useState([])
  const [commodities, setCommodities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    listPendientes().then(setRows).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
    listInspectores().then(setInspectores).catch(() => {})
    listCommodities().then(setCommodities).catch(() => {})
  }, [load])

  const mark = async (a, status) => {
    setBusyId(a.id)
    try { await setAssignmentStatus(a.id, status); onToast({ title: 'Asignación actualizada', sub: status }); load() }
    catch (e) { onToast({ title: 'Error', sub: e.message, bad: true }) }
    finally { setBusyId(null) }
  }
  const doCancel = async () => {
    const a = confirm.a
    setBusyId(a.id)
    try { await deleteAssignment(a.id); onToast({ title: 'Asignación cancelada', sub: a.lot }); setConfirm(null); load() }
    catch (e) { onToast({ title: 'Error', sub: e.message, bad: true }) }
    finally { setBusyId(null) }
  }

  return (
    <div className="content-inner fade-up">
      <div className="crud-toolbar">
        <span className="sub" style={{ fontSize: 13, color: 'var(--text-faint)' }}>{rows.length} pendiente(s)</span>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setModal(true)}><Icon name="plus" size={15} stroke={2.2} />Nueva asignación</button>
      </div>

      <Card pad={true}>
        <ScreenState loading={loading} error={error} empty={!loading && !error && rows.length === 0} emptyIcon="clipboard" emptyText="No hay asignaciones pendientes.">
          <table className="tbl">
            <thead><tr><th>Fecha</th><th>Lote / productor</th><th>Commodity</th><th>Inspector</th><th></th></tr></thead>
            <tbody>
              {rows.map(a => {
                const c = commodityVisual(a.commodity_code)
                return (
                  <tr key={a.id}>
                    <td className="mono" style={{ color: 'var(--text-dim)' }}>{fechaCorta(a.created_at)}</td>
                    <td><div className="cell-strong mono" style={{ fontSize: 12.5 }}>{a.lot || '—'}</div><div className="cell-dim">{a.producer || '—'} · {a.variety || '—'}</div></td>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}><span className={'commodity-ico ' + c.key} style={{ width: 24, height: 24, borderRadius: 6 }}><Icon name={c.icon} size={13} /></span>{c.label}</span></td>
                    <td>{a.inspector_name ? <span className="pill-tag"><Icon name="user" size={12} />{a.inspector_name}</span> : <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>—</span>}</td>
                    <td style={{ width: 120 }}>
                      <span className="row-actions">
                        <RowAction icon="checkCircle" title="Marcar completada" onClick={() => mark(a, 'completada')} />
                        <RowAction icon="xCircle" title="Cancelar asignación" danger onClick={() => setConfirm({ a })} />
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScreenState>
      </Card>

      {modal && <AssignModal inspectores={inspectores} commodities={commodities} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} onToast={onToast} />}
      {confirm && <ConfirmDialog title="Cancelar asignación" danger busy={busyId === confirm.a.id}
        message={`¿Cancelar la asignación del lote ${confirm.a.lot || '—'}? Pasará a estado "cancelada".`}
        confirmLabel="Cancelar asignación" onConfirm={doCancel} onClose={() => setConfirm(null)} />}
    </div>
  )
}
