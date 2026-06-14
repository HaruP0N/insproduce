'use client'
import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { Modal, Field, RowAction, ScreenState } from './_ui'
import { fechaCorta } from '@/lib/proto'
import { commodityVisual } from '@/lib/inspectorData'
import { listTemplates, getTemplate, createTemplate, updateTemplateFields, listCommodities } from '@/lib/adminCrud'

const FAMILIES = [{ v: 'quality', l: 'Calidad' }, { v: 'condition', l: 'Condición' }, { v: 'packaging', l: 'Embalaje' }, { v: 'measurement', l: 'Medición' }]
const TYPES = [{ v: 'number', l: 'Número' }, { v: 'select', l: 'Selección' }, { v: 'boolean', l: 'Sí/No' }, { v: 'text', l: 'Texto' }]

const splitKey = (k) => { const i = String(k).indexOf('.'); return i === -1 ? ['quality', k] : [k.slice(0, i), k.slice(i + 1)] }
const blankRow = () => ({ family: 'quality', code: '', label: '', field_type: 'number', unit: '%', required: false, options: '' })

function TemplateModal({ tpl, commodities, onClose, onSaved, onToast }) {
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
    }).catch(e => onToast({ title: 'Error', sub: e.message, bad: true })).finally(() => setLoading(false))
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
    if (!editing && (!name.trim() || !commodityCode)) return onToast({ title: 'Faltan datos', sub: 'Commodity y nombre obligatorios', bad: true })
    if (fields.length === 0) return onToast({ title: 'Sin campos', sub: 'Agrega al menos un campo válido (código + etiqueta)', bad: true })
    setBusy(true)
    try {
      if (editing) { await updateTemplateFields(tpl.id, fields); onToast({ title: 'Plantilla actualizada', sub: name }) }
      else { const r = await createTemplate({ commodityCode, name, fields }); onToast({ title: 'Plantilla creada', sub: `v${r.version}` }) }
      onSaved()
    } catch (e) { onToast({ title: 'Error', sub: e.message, bad: true }) }
    finally { setBusy(false) }
  }

  return (
    <Modal size="lg" title={editing ? `Editar plantilla — ${tpl.commodity_name} v${tpl.version}` : 'Nueva plantilla'} icon="template" onClose={onClose}
      footer={<><button className="btn" onClick={onClose} disabled={busy}>Cancelar</button><button className="btn btn-primary" onClick={submit} disabled={busy || loading}><Icon name="check" size={15} />{busy ? 'Guardando…' : (editing ? 'Guardar campos' : 'Crear plantilla')}</button></>}>
      {loading ? <div className="empty" style={{ padding: 40 }}><Icon name="clock" size={18} /> Cargando…</div> : (
        <>
          {!editing && (
            <div className="form-grid">
              <Field label="Commodity" required>
                <select className="select" value={commodityCode} onChange={e => setCommodityCode(e.target.value)}>
                  {commodities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Nombre" required><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Estándar de exportación" /></Field>
            </div>
          )}
          {editing && <div className="form-help" style={{ marginBottom: 12 }}>Editar reemplaza los campos de esta versión de la plantilla.</div>}

          <div className="field-label" style={{ marginBottom: 8 }}>Campos / defectos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.3fr 1fr', gap: 8, marginBottom: 8 }}>
                  <select className="select" value={r.family} onChange={e => setRow(i, 'family', e.target.value)}>{FAMILIES.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}</select>
                  <input className="input mono" value={r.code} onChange={e => setRow(i, 'code', e.target.value)} placeholder="código" />
                  <input className="input" value={r.label} onChange={e => setRow(i, 'label', e.target.value)} placeholder="Etiqueta visible" />
                  <select className="select" value={r.field_type} onChange={e => setRow(i, 'field_type', e.target.value)}>{TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {r.field_type === 'select'
                    ? <input className="input" style={{ flex: 1, minWidth: 180 }} value={r.options} onChange={e => setRow(i, 'options', e.target.value)} placeholder="Opciones separadas por coma" />
                    : <input className="input mono" style={{ width: 90 }} value={r.unit} onChange={e => setRow(i, 'unit', e.target.value)} placeholder="unidad" />}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-dim)', cursor: 'pointer' }}>
                    <button type="button" className={'switch' + (r.required ? ' on' : '')} onClick={() => setRow(i, 'required', !r.required)} />Obligatorio
                  </label>
                  <button className="btn btn-icon btn-sm" style={{ marginLeft: 'auto', color: 'var(--red)' }} title="Quitar campo" onClick={() => rmRow(i)} disabled={rows.length === 1}><Icon name="trash" size={15} /></button>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={addRow}><Icon name="plus" size={14} />Agregar campo</button>
        </>
      )}
    </Modal>
  )
}

export default function PlantillasScreen({ onToast }) {
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
        <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>{rows.length} plantilla(s)</span>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setModal({})}><Icon name="plus" size={15} stroke={2.2} />Nueva plantilla</button>
      </div>
      <Card pad={true}>
        <ScreenState loading={loading} error={error} empty={!loading && !error && rows.length === 0} emptyIcon="template" emptyText="No hay plantillas.">
          <table className="tbl">
            <thead><tr><th>Plantilla</th><th>Commodity</th><th className="num">Versión</th><th className="num">Campos</th><th>Estado</th><th>Creada</th><th></th></tr></thead>
            <tbody>
              {rows.map(t => {
                const v = commodityVisual(t.commodity_code)
                return (
                  <tr key={t.id}>
                    <td className="cell-strong">{t.name}</td>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}><span className={'commodity-ico ' + v.key} style={{ width: 24, height: 24, borderRadius: 6 }}><Icon name={v.icon} size={13} /></span>{v.label}</span></td>
                    <td className="num mono">v{t.version}</td>
                    <td className="num">{t.fields}</td>
                    <td>{t.active ? <span className="badge green" style={{ height: 22, fontSize: 11 }}>Activa</span> : <span className="pill-tag" style={{ color: 'var(--text-faint)' }}>Inactiva</span>}</td>
                    <td className="mono" style={{ color: 'var(--text-faint)', fontSize: 12 }}>{fechaCorta(t.created_at)}</td>
                    <td style={{ width: 50 }}><span className="row-actions"><RowAction icon="edit" title="Editar campos" onClick={() => setModal({ tpl: t })} /></span></td>
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
