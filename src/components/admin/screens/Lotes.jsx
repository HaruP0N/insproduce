'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { Modal, Field, RowAction, ScreenState } from './_ui'
import { fechaCorta } from '@/lib/proto'
import { commodityVisual } from '@/lib/inspectorData'
import { listLots, updateLot } from '@/lib/adminCrud'

function LotModal({ lot, onClose, onSaved, onToast }) {
  const [form, setForm] = useState({ variety: lot.variety || '', producer: lot.producer || '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const submit = async () => {
    setBusy(true)
    try { await updateLot(lot.id, form); onToast({ title: 'Lote actualizado', sub: lot.lot_code }); onSaved() }
    catch (e) { onToast({ title: 'Error', sub: e.message, bad: true }) }
    finally { setBusy(false) }
  }
  return (
    <Modal title={`Lote ${lot.lot_code}`} icon="boxes" onClose={onClose}
      footer={<><button className="btn" onClick={onClose} disabled={busy}>Cancelar</button><button className="btn btn-primary" onClick={submit} disabled={busy}><Icon name="check" size={15} />{busy ? 'Guardando…' : 'Guardar'}</button></>}>
      <Field label="Variedad"><input className="input" value={form.variety} onChange={e => set('variety', e.target.value)} placeholder="Duke, Ventura…" /></Field>
      <Field label="Productor"><input className="input" value={form.producer} onChange={e => set('producer', e.target.value)} placeholder="Nombre del productor" /></Field>
    </Modal>
  )
}

export default function LotesScreen({ onToast }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    listLots().then(setRows).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? rows.filter(l => (l.lot_code + (l.producer || '') + (l.variety || '')).toLowerCase().includes(t)) : rows
  }, [rows, q])

  return (
    <div className="content-inner fade-up">
      <div className="crud-toolbar">
        <div className="search"><Icon name="search" size={16} /><input placeholder="Buscar lote, productor…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-faint)' }}>{filtered.length} lote(s)</span>
      </div>
      <Card pad={true}>
        <ScreenState loading={loading} error={error} empty={!loading && !error && filtered.length === 0} emptyIcon="boxes" emptyText="No hay lotes registrados.">
          <table className="tbl">
            <thead><tr><th>Lote</th><th>Commodity</th><th>Productor</th><th>Variedad</th><th className="num">Pallets</th><th className="num">Inspecciones</th><th>Creado</th><th></th></tr></thead>
            <tbody>
              {filtered.map(l => {
                const v = commodityVisual(l.commodity_code)
                return (
                  <tr key={l.id}>
                    <td className="cell-strong mono" style={{ fontSize: 12.5 }}>{l.lot_code}</td>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}><span className={'commodity-ico ' + v.key} style={{ width: 24, height: 24, borderRadius: 6 }}><Icon name={v.icon} size={13} /></span>{v.label}</span></td>
                    <td style={{ color: 'var(--text-dim)' }}>{l.producer || '—'}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{l.variety || '—'}</td>
                    <td className="num">{l.pallets}</td>
                    <td className="num">{l.inspections}</td>
                    <td className="mono" style={{ color: 'var(--text-faint)', fontSize: 12 }}>{fechaCorta(l.created_at)}</td>
                    <td style={{ width: 50 }}><span className="row-actions"><RowAction icon="edit" title="Editar lote" onClick={() => setModal(l)} /></span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScreenState>
      </Card>
      {modal && <LotModal lot={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} onToast={onToast} />}
    </div>
  )
}
