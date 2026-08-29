'use client'
import { useState, useEffect, useCallback, Fragment } from 'react'
import { Card, StatusBadge } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { Modal, Field, ScreenState, RowAction, ConfirmDialog } from './_ui'
import { useI18n } from '@/lib/i18n'
import { commodityVisual } from '@/lib/inspectorData'
import { parseManifestRows, groupManifest } from '@/lib/manifest'

const api = async (path, opts = {}) => {
  const res = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.msg || 'Error')
  return data
}

const EMPTY = {
  container: '', commodity_code: 'BLUEBERRY', warehouse: '', carrier_type: 'Marítimo',
  vessel: '', airline: '', arrival_date: '', warehouse_date: '', week_no: '', cartons: '',
  atmosphere: '', o2_pct: '', co2_pct: '', upc: '', fumigation: false, notes: '',
  order_number: '', shipper: '', packaging: '', label: '', client: '', grower: '',
  destination: '', packing_date: '', inspection_date: '',
}
const EMPTY_ROW = { pallet: '', lot: '', producer: '', variety: '' }
// lee el Shipping Detail Report en el navegador (sin cellDates: las fechas seriales las convierte manifest.js)
async function readManifestFile(file) {
  const XLSX = (await import('xlsx')).default || (await import('xlsx'))
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
  return parseManifestRows(raw)
}

const NOTE_TYPES = ['Quality & Condition', 'Temperature', 'Traceability', 'Package', 'Temperature Record']
const DATE_KEYS = ['arrival_date', 'warehouse_date', 'packing_date', 'inspection_date']

// Paso 1: info general del cargo (la que llega semanas antes del contenedor).
// Paso 2 (solo al crear): precarga de pallets + asignación opcional a un inspector.
function ArriboWizard({ onClose, onSaved, onToast, edit }) {
  const { t } = useI18n()
  const [form, setForm] = useState(() => {
    if (!edit) return EMPTY
    const f = { ...EMPTY }
    for (const k of Object.keys(EMPTY)) {
      let v = edit[k]
      if (v == null || v === undefined) continue
      if (DATE_KEYS.includes(k)) v = String(v).slice(0, 10)
      f[k] = k === 'fumigation' ? !!v : String(v)
    }
    f.fumigation = !!edit.fumigation
    return f
  })
  const [step, setStep] = useState(1)
  const [rows, setRows] = useState([{ ...EMPTY_ROW }])
  const [inspEmail, setInspEmail] = useState('')
  const [inspectores, setInspectores] = useState([])
  const [manifest, setManifest] = useState(null) // { info, rows } parseado del Excel
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm((p) => {
    const next = { ...p, [k]: v }
    // semana automática desde la fecha de arribo (editable después)
    if (k === 'arrival_date' && v && !p.week_no) {
      const d = new Date(v + 'T00:00:00Z')
      const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      next.week_no = String(Math.ceil(((d - jan1) / 86400000 + jan1.getUTCDay() + 1) / 7))
    }
    return next
  })
  const setRow = (i, k, v) => setRows((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)))

  useEffect(() => {
    if (edit) return
    api('/api/users/inspectores').then((d) => setInspectores(Array.isArray(d) ? d : [])).catch(() => {})
  }, [edit])

  const filledRows = rows.filter((r) => r.lot.trim() && r.producer.trim())

  // manifiesto Excel: agrupa por pallet, llena las filas del paso 2 y precarga info del paso 1
  const importManifest = async (file) => {
    if (!file) return
    try {
      const parsed = await readManifestFile(file)
      if (parsed.errors.length) return onToast({ title: t('arr.manifestErr'), sub: parsed.errors[0], bad: true })
      const groups = groupManifest(parsed.rows)
      setManifest(parsed)
      setRows(groups.map((g) => ({
        pallet: g.pallet, lot: g.lot || '',
        producer: g.growers.join(' + '), variety: g.varieties.join(' / '),
      })))
      setForm((p) => ({
        ...p,
        container: p.container || parsed.info.container || '',
        order_number: p.order_number || parsed.info.order_number || '',
        client: p.client || parsed.info.client || '',
        warehouse: p.warehouse || parsed.info.receiver || '',
        packaging: p.packaging || [...new Set(parsed.rows.map((r) => r.packaging).filter(Boolean))].join(' / '),
        cartons: p.cartons || String(parsed.rows.reduce((a, r) => a + (r.cases || 0), 0)),
      }))
      const extras = []
      if (parsed.info.temp_recorders?.length) extras.push(`Temp recorders: ${parsed.info.temp_recorders.join(', ')}`)
      if (parsed.warnings?.length) extras.push(...parsed.warnings)
      onToast({ title: t('arr.manifestImported', { p: groups.length, n: parsed.rows.length }), sub: extras.join(' · ') || undefined })
    } catch (e) {
      onToast({ title: t('arr.manifestErr'), sub: e.message, bad: true })
    }
  }

  const submit = async () => {
    if (!form.container.trim()) return onToast({ title: t('arr.needContainer'), bad: true })
    if (!edit && filledRows.length && !inspEmail)
      return onToast({ title: t('arr.needInspectorRows'), bad: true })
    setBusy(true)
    try {
      let arrivalId = edit?.id
      if (edit) {
        await api(`/api/arrivals/${edit.id}`, { method: 'PUT', body: JSON.stringify(form) })
      } else {
        const d = await api('/api/arrivals', { method: 'POST', body: JSON.stringify(form) })
        arrivalId = d.id
        if (manifest?.rows?.length) {
          await api(`/api/arrivals/${arrivalId}/manifest`, { method: 'PUT', body: JSON.stringify({ rows: manifest.rows }) })
          // lectores de temperatura del Excel → nota "Temperature Record" del reporte
          if (manifest.info?.temp_recorders?.length) {
            await api(`/api/arrivals/${arrivalId}/notes`, {
              method: 'PUT',
              body: JSON.stringify({ notes: [{ type: 'Temperature Record', note: manifest.info.temp_recorders.map((r, i) => `Temp Recorder #${i + 1}: ${r}`).join(' · ') }] }),
            }).catch(() => {})
          }
        }
        // precarga: una asignación pendiente por pallet (el inspector la ve con todo prellenado)
        for (const r of filledRows) {
          await api('/api/inspecciones/asignar', {
            method: 'POST',
            body: JSON.stringify({
              lot: r.lot, producer: r.producer, variety: r.variety || null,
              commodity: form.commodity_code, inspector_email: inspEmail,
              pallet_number: r.pallet || null, arrival_id: arrivalId,
            }),
          })
        }
      }
      onToast({
        title: edit ? t('arr.updated') : t('arr.created'),
        sub: !edit && filledRows.length ? t('arr.palletsAssigned', { n: filledRows.length }) : undefined,
      })
      onSaved()
    } catch (e) {
      onToast({ title: t('arr.errSave'), sub: e.message, bad: true })
    } finally {
      setBusy(false)
    }
  }

  const groupTitle = (txt) => (
    <div style={{ gridColumn: '1 / -1', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-faint)', borderBottom: '1px solid var(--border)', paddingBottom: 4, margin: '8px 0 2px' }}>{txt}</div>
  )
  const inp = (k, props = {}) => <input className="input" value={form[k]} onChange={(e) => set(k, e.target.value)} {...props} />

  return (
    <Modal title={`${edit ? t('arr.edit') : t('arr.new')} — ${step === 1 ? t('arr.step1') : t('arr.step2')}`} icon="package" onClose={onClose} size="lg"
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        {!edit && step === 2 && (
          <button className="btn" onClick={() => setStep(1)} disabled={busy}><Icon name="chevLeft" size={14} />{t('arr.backStep')}</button>
        )}
        {!edit && step === 1 ? (
          <button className="btn btn-primary" onClick={() => setStep(2)} disabled={busy}>
            {t('arr.next')} <Icon name="chevRight" size={14} />
          </button>
        ) : (
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            <Icon name="check" size={15} />{busy ? t('common.saving') : t('common.save')}
          </button>
        )}
      </>}>
      {step === 1 && (
        <div className="form-grid" style={{ gap: '0 14px' }}>
          {groupTitle(t('arr.grpCargo'))}
          <Field label={t('arr.container')} required>{inp('container', { placeholder: 'CAAU4168542' })}</Field>
          <Field label={t('arr.order')}>{inp('order_number')}</Field>
          <Field label={t('arr.shipper')}>{inp('shipper', { placeholder: 'Family Tree Farms USA' })}</Field>
          <Field label={t('arr.client')}>{inp('client')}</Field>
          <Field label={t('arr.grower')}>{inp('grower')}</Field>
          <Field label={t('arr.destination')}>{inp('destination', { placeholder: 'Philadelphia' })}</Field>
          <Field label={t('arr.warehouse')}>{inp('warehouse', { placeholder: 'Four Seasons' })}</Field>
          <Field label={t('arr.packagingField')}>{inp('packaging', { placeholder: '12 X 9.8 OZ' })}</Field>
          <Field label={t('arr.cartons')}>{inp('cartons', { type: 'number' })}</Field>

          {groupTitle(t('arr.grpTransport'))}
          <Field label={t('arr.carrier')}>
            <select className="select" value={form.carrier_type} onChange={(e) => set('carrier_type', e.target.value)}>
              {['Marítimo', 'Aéreo', 'Terrestre'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={t('arr.vessel')}>{inp('vessel')}</Field>
          <Field label={t('arr.airline')}>{inp('airline')}</Field>
          <Field label={t('arr.labelField')}>{inp('label', { placeholder: 'FTF' })}</Field>
          <Field label="UPC">{inp('upc')}</Field>
          <Field label={t('arr.atmosphere')}>{inp('atmosphere', { placeholder: 'AC' })}</Field>
          <Field label="% O2">{inp('o2_pct', { type: 'number', step: '0.01' })}</Field>
          <Field label="% CO2">{inp('co2_pct', { type: 'number', step: '0.01' })}</Field>
          <Field label={t('arr.fumigation')}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer', paddingTop: 8 }}>
              <input type="checkbox" checked={form.fumigation} onChange={(e) => set('fumigation', e.target.checked)} />
              {t('arr.fumigated')}
            </label>
          </Field>

          {groupTitle(t('arr.grpDates'))}
          <Field label={t('arr.packingDate')}>{inp('packing_date', { type: 'date' })}</Field>
          <Field label={t('arr.arrivalDate')}>{inp('arrival_date', { type: 'date' })}</Field>
          <Field label={t('arr.warehouseDate')}>{inp('warehouse_date', { type: 'date' })}</Field>
          <Field label={t('arr.inspDate')}>{inp('inspection_date', { type: 'date' })}</Field>
          <Field label={t('arr.week')}>{inp('week_no', { type: 'number' })}</Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label={t('ni.notes')}>
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="form-help" style={{ marginBottom: 12 }}>{t('arr.palletsPreloadHelp')}</div>
          <label className="btn btn-sm" style={{ cursor: 'pointer', marginBottom: 12 }}>
            <Icon name="arrowUp" size={13} /> {t('arr.manifestImport')}
            <input type="file" hidden accept=".xlsx,.xlsm,.xls"
              onChange={(e) => { importManifest(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {manifest && (
            <div className="form-help" style={{ marginBottom: 12, color: 'var(--accent-strong)' }}>
              ✓ {t('arr.manifestImported', { p: groupManifest(manifest.rows).length, n: manifest.rows.length })}
              {manifest.info?.container ? ` · ${manifest.info.container}` : ''}
            </div>
          )}
          <Field label={t('arr.assignTo')}>
            <select className="select" value={inspEmail} onChange={(e) => setInspEmail(e.target.value)}>
              <option value="">{t('arr.noAssign')}</option>
              {inspectores.map((u) => <option key={u.email} value={u.email}>{u.name} · {u.email}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr 34px', gap: 6, alignItems: 'center', marginTop: 10 }}>
            {[t('ni.pallet'), t('tbl.lote'), t('tbl.productor'), t('tbl.variedad'), ''].map((h) => (
              <div key={h} style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-faint)' }}>{h}</div>
            ))}
            {rows.map((r, i) => (
              <Fragment key={i}>
                <input className="input mono" value={r.pallet} onChange={(e) => setRow(i, 'pallet', e.target.value)} placeholder={`P${i + 1}`} />
                <input className="input mono" value={r.lot} onChange={(e) => setRow(i, 'lot', e.target.value)} placeholder="2504895" />
                <input className="input" value={r.producer} onChange={(e) => setRow(i, 'producer', e.target.value)} />
                <input className="input" value={r.variety} onChange={(e) => setRow(i, 'variety', e.target.value)} />
                <button className="btn btn-icon btn-sm" title={t('common.delete')} onClick={() => setRows((p) => p.filter((_, j) => j !== i))} disabled={rows.length === 1}>
                  <Icon name="x" size={13} />
                </button>
              </Fragment>
            ))}
          </div>
          <button className="btn btn-sm" style={{ marginTop: 10 }}
            onClick={() => setRows((p) => [...p, { ...EMPTY_ROW, pallet: `P${p.length + 1}`, lot: p[p.length - 1]?.lot || '', producer: p[p.length - 1]?.producer || '', variety: p[p.length - 1]?.variety || '' }])}>
            <Icon name="plus" size={13} /> {t('arr.addPallet')}
          </button>
          <div className="form-help" style={{ marginTop: 10 }}>{t('arr.palletsSkipHelp')}</div>
        </div>
      )}
    </Modal>
  )
}

// Pallets del contenedor agrupados desde el manifiesto: dropdown por pallet con su
// composición (un pallet puede venir de varios growers/fechas — badge MIXTO).
function ManifestSection({ data, t, lang, openPallets, setOpenPallets, inspectores, assignEmail, setAssignEmail, assigning, onAssign, onUpload, onInspect }) {
  const groups = groupManifest(data.manifest || [])
  const inspByPallet = new Map((data.inspections || []).map((i) => [i.pallet_code, i]))
  const pendingByPallet = new Map((data.pending_assignments || []).map((a) => [a.pallet_number, a]))
  const fmtD = (d) => (d ? new Date(d).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CL', { timeZone: 'UTC' }) : '—')
  const toggle = (p) => setOpenPallets((prev) => {
    const next = new Set(prev)
    if (next.has(p)) next.delete(p); else next.add(p)
    return next
  })

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-faint)', margin: '18px 0 8px' }}>
        {t('arr.manifestTitle')}{groups.length ? ` (${groups.length})` : ''}
      </div>
      <div className="form-help" style={{ marginBottom: 8 }}>{t('arr.manifestHelp')}</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
          <Icon name="arrowUp" size={13} /> {t('arr.manifestUpload')}
          <input type="file" hidden accept=".xlsx,.xlsm,.xls"
            onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        {groups.length > 0 && (
          <select className="select" style={{ maxWidth: 260 }} value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)}>
            <option value="">{t('arr.noAssign')}</option>
            {inspectores.map((u) => <option key={u.email} value={u.email}>{u.name} · {u.email}</option>)}
          </select>
        )}
      </div>

      {groups.length > 0 && (
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 30 }}></th><th>{t('ni.pallet')}</th><th className="num">{t('arr.cases')}</th>
              <th>{t('arr.growersCol')}</th><th>{t('tbl.variedad')}</th><th>{t('arr.recvDate')}</th><th></th><th style={{ width: 110 }}></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const open = openPallets.has(g.pallet)
              const done = inspByPallet.get(g.pallet)
              const pend = pendingByPallet.get(g.pallet)
              return (
                <Fragment key={g.pallet}>
                  <tr onClick={() => toggle(g.pallet)} style={{ cursor: 'pointer' }}>
                    <td><Icon name={open ? 'chevDown' : 'chevRight'} size={14} /></td>
                    <td className="mono" style={{ fontWeight: 700 }}>
                      {g.pallet}
                      {g.mixed && <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 800, background: '#FDF0E0', color: '#9A5B13', border: '1px solid #EAD3AE', borderRadius: 999, padding: '1px 7px' }}>{t('arr.mixed')}</span>}
                    </td>
                    <td className="num mono">{g.cases || '—'}</td>
                    <td style={{ fontSize: 12.5 }}>{g.growers.join(', ') || '—'}</td>
                    <td style={{ fontSize: 12.5 }}>{g.varieties.join(' / ') || '—'}</td>
                    <td className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>{g.dates.length ? g.dates.map(fmtD).join(' / ') : '—'}</td>
                    <td>
                      {done
                        ? <StatusBadge resolucion={done.resolution === 'approved' ? 'aprobado' : done.resolution === 'conditional' ? 'condicional' : done.resolution === 'rejected' ? 'rechazado' : done.resolution} />
                        : pend
                          ? <span className="pill-tag"><Icon name="user" size={11} />{t('arr.assigned')} · {pend.inspector_name || ''}</span>
                          : <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>—</span>}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {!done && (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button className="btn btn-sm btn-primary" onClick={() => onInspect(g)}>
                            <Icon name="clipboardCheck" size={13} /> {t('arr.inspect')}
                          </button>
                          {!pend && (
                            <button className="btn btn-sm" disabled={assigning === g.pallet} onClick={() => onAssign(g)}>
                              {assigning === g.pallet ? '…' : t('arr.assign')}
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td></td>
                      <td colSpan={7} style={{ padding: '4px 0 10px' }}>
                        <table className="tbl" style={{ fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th>Grower</th><th className="num">{t('arr.cases')}</th><th>{t('tbl.lote')}</th>
                              <th>{t('arr.recvDate')}</th><th>{t('tbl.variedad')}</th><th>{t('arr.packagingField')}</th><th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.parts.map((p, i) => (
                              <tr key={i}>
                                <td className="mono" style={{ fontWeight: 600 }}>{p.grower_code || '—'}</td>
                                <td className="num mono">{p.cases ?? '—'}</td>
                                <td className="mono">{p.lot_code || '—'}</td>
                                <td className="mono">{fmtD(p.recv_date)}</td>
                                <td>{p.variety || '—'}</td>
                                <td style={{ color: 'var(--text-dim)' }}>{p.packaging || '—'}</td>
                                <td>{p.combined ? <span title={t('arr.combinedHint')} style={{ fontWeight: 800, color: '#9A5B13' }}>*</span> : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      )}
      {groups.length === 0 && <div className="form-help">{t('arr.manifestEmpty')}</div>}
    </div>
  )
}

function DetalleArribo({ id, onToast, onAddInspection, onReinspect, onBack }) {
  const { t, lang } = useI18n()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState({})
  const [savingNotes, setSavingNotes] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [openPallets, setOpenPallets] = useState(() => new Set())
  const [inspectores, setInspectores] = useState([])
  const [assignEmail, setAssignEmail] = useState('')
  const [assigning, setAssigning] = useState(null) // pallet en proceso de asignación

  useEffect(() => {
    api('/api/users/inspectores').then((d) => setInspectores(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const load = useCallback(() => {
    api(`/api/arrivals/${id}`).then((d) => {
      setData(d)
      const draft = {}
      for (const ty of NOTE_TYPES) draft[ty] = (d.notes_typed || []).find((n) => n.note_type === ty)?.note || ''
      setNoteDraft(draft)
    }).catch((e) => setError(e.message))
  }, [id])
  useEffect(load, [load])

  const saveNotes = async () => {
    setSavingNotes(true)
    try {
      await api(`/api/arrivals/${id}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes: NOTE_TYPES.map((ty) => ({ type: ty, note: noteDraft[ty] || '' })) }),
      })
      onToast({ title: t('arr.notesSaved') })
      load()
    } catch (e) {
      onToast({ title: t('arr.errSave'), sub: e.message, bad: true })
    } finally {
      setSavingNotes(false)
    }
  }

  const uploadFile = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/arrivals/${id}/files`, { method: 'POST', credentials: 'include', body: fd })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.msg || 'Error')
      onToast({ title: t('arr.fileUploaded'), sub: file.name })
      load()
    } catch (e) {
      onToast({ title: t('arr.errSave'), sub: e.message, bad: true })
    } finally {
      setUploading(false)
    }
  }

  const uploadManifest = async (file) => {
    if (!file) return
    try {
      const parsed = await readManifestFile(file)
      if (parsed.errors.length) return onToast({ title: t('arr.manifestErr'), sub: parsed.errors[0], bad: true })
      await api(`/api/arrivals/${id}/manifest`, { method: 'PUT', body: JSON.stringify({ rows: parsed.rows }) })
      // backfill: completa los campos del arribo que sigan vacíos con la info del Excel
      const fill = {
        order_number: data.order_number || parsed.info.order_number || null,
        client: data.client || parsed.info.client || null,
        warehouse: data.warehouse || parsed.info.receiver || null,
        packaging: data.packaging || [...new Set(parsed.rows.map((r) => r.packaging).filter(Boolean))].join(' / ') || null,
        cartons: data.cartons || parsed.rows.reduce((a, r) => a + (r.cases || 0), 0) || null,
      }
      if (Object.entries(fill).some(([k, v]) => v && !data[k])) {
        await api(`/api/arrivals/${id}`, { method: 'PUT', body: JSON.stringify({ ...data, ...fill }) })
      }
      const hasTempNote = (data.notes_typed || []).some((n) => n.note_type === 'Temperature Record' && n.note)
      if (parsed.info.temp_recorders?.length && !hasTempNote) {
        await api(`/api/arrivals/${id}/notes`, {
          method: 'PUT',
          body: JSON.stringify({ notes: [{ type: 'Temperature Record', note: parsed.info.temp_recorders.map((r, i) => `Temp Recorder #${i + 1}: ${r}`).join(' · ') }] }),
        }).catch(() => {})
      }
      onToast({ title: t('arr.manifestSaved', { n: parsed.rows.length }), sub: parsed.warnings?.join(' · ') || undefined })
      load()
    } catch (e) {
      onToast({ title: t('arr.manifestErr'), sub: e.message, bad: true })
    }
  }

  const assignPallet = async (g) => {
    if (!assignEmail) return onToast({ title: t('arr.needInspectorRows'), bad: true })
    setAssigning(g.pallet)
    try {
      await api('/api/inspecciones/asignar', {
        method: 'POST',
        body: JSON.stringify({
          lot: g.lot || data.container, producer: g.growers.join(' + ') || 'FTF',
          variety: g.varieties.join(' / ') || null, commodity: data.commodity_code || 'BLUEBERRY',
          inspector_email: assignEmail, pallet_number: g.pallet, arrival_id: data.id,
        }),
      })
      onToast({ title: t('asg.created'), sub: `${g.pallet} → ${assignEmail}` })
      load()
    } catch (e) {
      onToast({ title: t('arr.errSave'), sub: e.message, bad: true })
    } finally {
      setAssigning(null)
    }
  }

  const removeFile = async (fid) => {
    try {
      await api(`/api/arrivals/${id}/files?file_id=${fid}`, { method: 'DELETE' })
      onToast({ title: t('arr.fileDeleted') })
      load()
    } catch (e) {
      onToast({ title: t('arr.errSave'), sub: e.message, bad: true })
    }
  }

  if (error) return <div className="empty"><div className="ei"><Icon name="xCircle" size={20} /></div>{error}</div>
  if (!data) return <div className="empty" style={{ padding: 30 }}><Icon name="clock" size={16} /> {t('common.loading')}</div>

  // timeZone UTC: las DATE de SQL llegan como medianoche UTC y Chile las retrocedería un día
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CL', { timeZone: 'UTC' }) : '—')
  // los tres bloques del encabezado del reporte QC Inspec
  const meta = [
    [t('arr.shipper'), data.shipper], [t('arr.warehouse'), data.warehouse],
    [t('arr.packagingField'), data.packaging], [t('arr.cartons'), data.cartons],
    [t('arr.order'), data.order_number], [t('arr.grower'), data.grower],
    [t('arr.client'), data.client], [t('arr.destination'), data.destination],
    [t('arr.vessel'), data.vessel], [t('arr.airline'), data.airline],
    [t('arr.carrier'), data.carrier_type], [t('arr.labelField'), data.label],
    [t('arr.packingDate'), fmtDate(data.packing_date)], [t('arr.arrivalDate'), fmtDate(data.arrival_date)],
    [t('arr.inspDate'), fmtDate(data.inspection_date)], [t('arr.week'), data.week_no],
    [t('arr.atmosphere'), data.atmosphere], ['UPC', data.upc],
  ]

  return (
    <Card
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <button className="btn btn-icon btn-sm" onClick={onBack} title={t('common.back')}><Icon name="chevLeft" size={15} /></button>
        {t('arr.detail')} · {data.container}
      </span>}
      action={
        <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="btn btn-sm" href={`/api/arrivals/${data.id}/pdf`} target="_blank" rel="noreferrer">
            <Icon name="report" size={14} /> {t('arr.containerPdf')}
          </a>
          <button className="btn btn-sm" onClick={() => setEditOpen(true)}>
            <Icon name="edit" size={14} /> {t('arr.edit')}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onAddInspection(data)}>
            <Icon name="plus" size={14} /> {t('arr.addInspection')}
          </button>
        </span>
      }>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
        {meta.map(([label, v]) => (
          <div key={label}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{v ?? '—'}</div>
          </div>
        ))}
      </div>

      <ManifestSection data={data} t={t} lang={lang} openPallets={openPallets} setOpenPallets={setOpenPallets}
        inspectores={inspectores} assignEmail={assignEmail} setAssignEmail={setAssignEmail}
        assigning={assigning} onAssign={assignPallet} onUpload={uploadManifest}
        onInspect={(g) => onAddInspection(data, {
          producer: g.growers.join(' + '), lot: g.lot || '', pallet_number: g.pallet,
          variety: g.varieties.join(' / '), packaging: g.parts[0]?.packaging || '',
        })} />

      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-faint)', margin: '18px 0 8px' }}>
        {t('arr.inspectionsTitle')} ({data.inspections.length})
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

      {(data.pending_assignments || []).length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-faint)', margin: '18px 0 8px' }}>
            {t('arr.pendingTitle')} ({data.pending_assignments.length})
          </div>
          <div className="form-help" style={{ marginBottom: 8 }}>{t('arr.pendingHelp')}</div>
          <table className="tbl">
            <thead><tr><th>{t('ni.pallet')}</th><th>{t('tbl.loteProductor')}</th><th>{t('tbl.variedad')}</th><th>{t('tbl.inspector')}</th></tr></thead>
            <tbody>
              {data.pending_assignments.map((a) => (
                <tr key={a.id}>
                  <td className="mono" style={{ fontWeight: 700 }}>{a.pallet_number || '—'}</td>
                  <td><div className="cell-strong mono" style={{ fontSize: 12 }}>{a.lot}</div><div className="cell-dim">{a.producer}</div></td>
                  <td style={{ color: 'var(--text-dim)' }}>{a.variety || '—'}</td>
                  <td><span className="pill-tag"><Icon name="user" size={12} />{a.inspector_name || '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-faint)', margin: '18px 0 8px' }}>
        {t('arr.reportNotes')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 10 }}>
        {NOTE_TYPES.map((ty) => (
          <div key={ty}>
            <label className="field-label">{ty}</label>
            <textarea className="input" rows={2} value={noteDraft[ty] || ''}
              onChange={(e) => setNoteDraft((p) => ({ ...p, [ty]: e.target.value }))} />
          </div>
        ))}
      </div>
      <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={saveNotes} disabled={savingNotes}>
        <Icon name="check" size={13} /> {savingNotes ? t('common.saving') : t('arr.saveNotes')}
      </button>

      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-faint)', margin: '18px 0 8px' }}>
        {t('arr.files')}
      </div>
      <div className="form-help" style={{ marginBottom: 8 }}>{t('arr.filesHelp')}</div>
      {(data.files || []).map((f) => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
          <Icon name="report" size={14} />
          <a href={f.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, textDecoration: 'underline', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file_name}</a>
          <span style={{ marginLeft: 'auto' }}>
            <RowAction icon="trash" title={t('common.delete')} danger onClick={() => removeFile(f.id)} />
          </span>
        </div>
      ))}
      <label className="btn btn-sm" style={{ marginTop: 10, cursor: 'pointer' }}>
        <Icon name="arrowUp" size={13} /> {uploading ? t('arr.uploading') : t('arr.upload')}
        <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} disabled={uploading}
          onChange={(e) => { uploadFile(e.target.files?.[0]); e.target.value = '' }} />
      </label>

      {editOpen && (
        <ArriboWizard edit={data} onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); load() }} onToast={onToast} />
      )}
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

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CL', { timeZone: 'UTC' }) : '—')

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
                      {a.manifest_pallets > 0 ? `${a.pallets}/${a.manifest_pallets}` : a.pallets}
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

      {showNew && <ArriboWizard onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load() }} onToast={onToast} />}
      {toDelete && (
        <ConfirmDialog title={t('arr.deleteTitle')} message={t('arr.deleteMsg', { c: toDelete.container })}
          confirmLabel={t('common.delete')} danger busy={busy}
          onConfirm={remove} onClose={() => setToDelete(null)} />
      )}
    </div>
  )
}
