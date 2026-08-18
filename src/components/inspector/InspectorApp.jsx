'use client'
// Inspector de campo — portado del prototipo (ds.css) y conectado al backend qc.
// Misma lógica de captura que el hook anterior: template dinámico por commodity +
// payload {metrics:{ "family.code": valor }, photos:{ key:[urls] }} → POST /api/inspecciones.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Icon } from '@/components/proto/Icon'
import { Donut } from '@/components/proto/charts'
import { StatusBadge, ScoreCell } from '@/components/proto/ui'
import { RES, RES_VAR, fmt1, fechaCorta } from '@/lib/proto'
import { useI18n, LangToggle } from '@/lib/i18n'
import { uploadToCloudinary, compressImage } from '@/lib/cloudinary'
import {
  getAssigned, getCompleted, getDetail, getCommodities, getTemplate,
  saveInspection, getMe, logout, commodityVisual,
} from '@/lib/inspectorData'

const TIPOS_EMBALAJE = ['Clamshell 125 g', 'Clamshell 170 g', 'Clamshell 250 g', 'Caja 2 kg', 'Bandeja 500 g']
const GROUP_ICON = { quality: 'flask', condition: 'thermometer', packaging: 'package', measurement: 'ruler', _other: 'list' }
const humanize = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const bareKey = (k) => { const i = String(k).indexOf('.'); return i === -1 ? k : k.slice(i + 1) }
const famOf = (k) => { const i = String(k).indexOf('.'); return i === -1 ? '_other' : k.slice(0, i) }

/* ───────────────── top bar ───────────────── */
function InspTopBar({ tab, onTab, assignedCount, user, theme, onTheme, onLogout }) {
  const { t } = useI18n()
  const [menu, setMenu] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const initial = (user?.name || 'I').charAt(0).toUpperCase()
  return (
    <header className="insp-top">
      <div className="insp-brand">
        <div className="brand-logo"><Icon name="grape" size={20} stroke={1.9} /></div>
        <div>
          <div className="brand-name">Insproduce</div>
          <div className="brand-sub">{t('ins.fieldInspection')}</div>
        </div>
      </div>
      <div className="insp-nav-center">
        <div className="seg">
          <button className={tab === 'asignadas' ? 'on' : ''} onClick={() => onTab('asignadas')}>
            <Icon name="clipboard" size={15} />{t('ins.tabAssigned')}{assignedCount > 0 && <span className="cnt">{assignedCount}</span>}
          </button>
          <button className={tab === 'completadas' ? 'on' : ''} onClick={() => onTab('completadas')}>
            <Icon name="clipboardCheck" size={15} />{t('ins.tabCompleted')}
          </button>
        </div>
      </div>
      <div className="insp-top-right" ref={ref}>
        <LangToggle title={t('topbar.language')} />
        <button className="btn btn-icon" title={t('topbar.theme')} onClick={onTheme}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} /></button>
        <button className="avatar" style={{ border: 0, cursor: 'pointer' }} onClick={() => setMenu(o => !o)}>{initial}</button>
        {menu && (
          <div className="menu-pop">
            <div className="menu-head">
              <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name || t('nav.user')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 1 }}>{user?.email || ''}</div>
            </div>
            {user?.role === 'admin' && <a className="menu-item" href="/admin"><Icon name="dashboard" size={16} />{t('nav.adminView')}</a>}
            <button className="menu-item danger" onClick={onLogout}><Icon name="logout" size={16} />{t('nav.logout')}</button>
          </div>
        )}
      </div>
    </header>
  )
}

/* ───────────────── cola (asignadas) ───────────────── */
function QueueScreen({ assigned, loading, onStart }) {
  const { t } = useI18n()
  if (loading) return <div className="insp-inner"><section className="card"><div className="empty" style={{ padding: 64 }}><Icon name="clock" size={22} /> {t('common.loading')}</div></section></div>
  return (
    <div className="insp-inner fade-up">
      <div className="page-h">
        <h1><Icon name="clipboard" size={22} style={{ color: 'var(--accent-strong)' }} />{t('ins.myAssigned')}</h1>
        <span className="sub">{assigned.length} {t(assigned.length === 1 ? 'ins.pendingOne' : 'ins.pendingMany')}</span>
      </div>
      {assigned.length === 0 ? (
        <section className="card">
          <div className="empty" style={{ padding: '72px 20px' }}>
            <div className="ei" style={{ width: 60, height: 60, color: 'var(--accent-strong)' }}><Icon name="inbox" size={28} /></div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t('ins.allClear')}</div>
            <div style={{ maxWidth: 340, margin: '0 auto', lineHeight: 1.55 }}>{t('ins.allClearSub')}</div>
          </div>
        </section>
      ) : (
        <div className="queue-grid stagger">
          {assigned.map(task => {
            const c = commodityVisual(task.commodity_code, t)
            return (
              <section className="card task-card" key={task.id}>
                <div className="task-top">
                  <div className={'commodity-ico ' + c.key}><Icon name={c.icon} size={22} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="task-lote">{task.lote}</div>
                    <div className="task-prod">{task.productor}</div>
                  </div>
                </div>
                <div className="task-meta">
                  <span className="m"><Icon name="grape" size={13} />{c.label} · {task.variedad}</span>
                  <span style={{ color: 'var(--border-strong)' }}>·</span>
                  <span className="m"><Icon name="calendar" size={13} />{t('ins.assignedOn', { d: task.asignada })}</span>
                </div>
                {task.notasAdmin && (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 10px', margin: '0 0 12px', lineHeight: 1.5 }}>
                    <b style={{ color: 'var(--text)' }}>{t('ins.note')}</b> {task.notasAdmin}
                  </div>
                )}
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onStart(task)}>
                  <Icon name="play" size={16} stroke={2} />{t('ins.start')}
                </button>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ───────────────── completadas ───────────────── */
function CompletedScreen({ completed, loading, onOpen }) {
  const { t } = useI18n()
  if (loading) return <div className="insp-inner"><section className="card"><div className="empty" style={{ padding: 64 }}><Icon name="clock" size={22} /> {t('common.loading')}</div></section></div>
  return (
    <div className="insp-inner fade-up">
      <div className="page-h">
        <h1><Icon name="clipboardCheck" size={22} style={{ color: 'var(--green)' }} />{t('ins.completedTitle')}</h1>
        <span className="sub">{t('ins.finished', { n: completed.length })}</span>
      </div>
      <section className="card card-pad">
        {completed.length === 0 ? (
          <div className="empty" style={{ padding: 56 }}>
            <div className="ei"><Icon name="clipboardCheck" size={26} /></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t('ins.noCompleted')}</div>
            <div>{t('ins.noCompletedSub')}</div>
          </div>
        ) : (
          <table className="tbl">
            <thead><tr>
              <th>{t('tbl.fecha')}</th><th>{t('tbl.loteProductor')}</th><th>{t('tbl.commodity')}</th><th className="num">{t('tbl.score')}</th><th>{t('tbl.resolucion')}</th><th></th>
            </tr></thead>
            <tbody>
              {completed.map(i => {
                const c = commodityVisual(i.commodity_code, t)
                return (
                  <tr key={i.id} onClick={() => onOpen(i)} style={{ cursor: 'pointer' }}>
                    <td className="mono" style={{ color: 'var(--text-dim)' }}>{i.fecha}</td>
                    <td>
                      <div className="cell-strong mono" style={{ fontSize: 12.5 }}>{i.lote}</div>
                      <div className="cell-dim">{i.productor}</div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
                        <span className={'commodity-ico ' + c.key} style={{ width: 26, height: 26, borderRadius: 7 }}><Icon name={c.icon} size={15} /></span>
                        {c.label}
                      </span>
                    </td>
                    <td className="num"><ScoreCell score={i.score} resolucion={i.resolucion} /></td>
                    <td><StatusBadge resolucion={i.resolucion} /></td>
                    <td style={{ width: 30, color: 'var(--text-faint)' }}><Icon name="chevRight" size={16} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

/* ───────────────── drawer detalle ───────────────── */
function CompletedDrawer({ item, onClose }) {
  const { t } = useI18n()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null)
    getDetail(item.id).then(d => { if (alive) setDetail(d) }).catch(e => { if (alive) setErr(e.message) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [item.id])

  const c = commodityVisual(item.commodity_code, t)
  const r = RES[item.resolucion]
  const fmtv = (m) => m.value_num != null ? String(m.value_num) : (m.option_value ?? (m.value_bool != null ? (m.value_bool ? t('cap.yes') : t('cap.no')) : (m.value_text ?? '—')))

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head" style={{ alignItems: 'center' }}>
          <div className={'commodity-ico ' + c.key}><Icon name={c.icon} size={22} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
              <StatusBadge resolucion={item.resolucion} />
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>#{item.id}</span>
            </div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em' }}>{item.lote}</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>{item.productor} · {c.label} {item.variedad}</div>
          </div>
          <button className="btn btn-icon" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="drawer-body">
          {loading && <div className="empty" style={{ padding: 48 }}><Icon name="clock" size={20} /> {t('ins.detail')}</div>}
          {err && <div className="empty" style={{ padding: 48, color: 'var(--red)' }}><Icon name="xCircle" size={20} /> {err}</div>}
          {!loading && !err && detail && (() => {
            const measurements = detail.measurements || []
            const physChem = [
              [t('ins.brixAvg'), detail.brix_avg, '°Bx'],
              [t('ins.tempPulp'), detail.temp_pulp, '°C'],
              [t('ins.tempAmbient'), detail.temp_ambient, '°C'],
              [t('ins.tempWater'), detail.temp_water, '°C'],
              [t('ins.caliber'), detail.diameter_min != null || detail.diameter_max != null ? `${detail.diameter_min ?? '—'}–${detail.diameter_max ?? '—'}` : null, 'mm'],
              [t('ins.netWeight'), detail.net_weight, 'kg'],
            ].filter(([, v]) => v != null && v !== '')
            return (
              <>
                <div className="score-hero" style={{ marginBottom: 22 }}>
                  <Donut segments={[{ value: item.score, varName: RES_VAR[item.resolucion] }, { value: 100 - item.score, varName: '--track' }]} size={104} thickness={13} centerTop={fmt1(item.score)} centerBottom="SCORE" />
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>{t('drawer.resolucion')}</div>
                    <div className={'badge ' + r.color} style={{ height: 30, fontSize: 14, padding: '0 14px' }}><Icon name={r.icon} size={17} stroke={2} />{t('res.' + item.resolucion)}</div>
                    {detail.total_defects_pct != null && (
                      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10, lineHeight: 1.5 }}>
                        {t('ins.totalDefects', { v: fmt1(detail.total_defects_pct) })}<br />
                        {t('ins.qualityCond', { q: fmt1(detail.quality_total_pct), c: fmt1(detail.condition_total_pct) })}
                      </div>
                    )}
                  </div>
                </div>

                {physChem.length > 0 && (<>
                  <div className="sec-title" style={{ marginBottom: 12 }}>{t('ins.physChem')}</div>
                  <div className="idgrid" style={{ marginBottom: 22 }}>
                    {physChem.map(([k, v, u]) => (
                      <div className="readbox" key={k}><div className="k">{k}</div><div className="v mono">{v}<span className="um">{u}</span></div></div>
                    ))}
                  </div>
                </>)}

                <div className="sec-title" style={{ marginBottom: 14 }}>{t('ins.qualityMetrics')}</div>
                {measurements.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>{t('ins.noMetrics')}</div>
                ) : measurements.map(m => (
                  <div className="defect-row" key={m.key}>
                    <span className="defect-name">{m.label || humanize(bareKey(m.key))}</span>
                    <span className="defect-val">{fmtv(m)}</span>
                    <span className="defect-meter meter"><span style={{ width: '0%' }} /></span>
                  </div>
                ))}

                {(detail.photos || []).length > 0 && (
                  <div style={{ marginTop: 22 }}>
                    <div className="sec-title" style={{ marginBottom: 12 }}>{t('cap.photos')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {detail.photos.map((p, i) => (
                        <a key={i} href={p.url} target="_blank" rel="noreferrer" style={{ width: 84, height: 84 }}>
                          <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 9, border: '1px solid var(--border)' }} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {detail.notes && (
                  <div style={{ marginTop: 22 }}>
                    <div className="sec-title" style={{ marginBottom: 10 }}>{t('ins.observations')}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>{detail.notes}</div>
                  </div>
                )}
              </>
            )
          })()}
        </div>
        <div className="drawer-foot">
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>{t('ins.close')}</button>
          {item.pdfUrl
            ? <a className="btn btn-primary" style={{ flex: 1, textAlign: 'center' }} href={item.pdfUrl} target="_blank" rel="noreferrer"><Icon name="download" size={16} />{t('ins.viewPdf')}</a>
            : <button className="btn btn-primary" style={{ flex: 1 }} disabled><Icon name="download" size={16} />{t('ins.pdfNotGen')}</button>}
        </div>
      </aside>
    </>
  )
}

/* ───────────────── inputs reutilizables ───────────────── */
function UnitField({ value, onChange, unit, placeholder }) {
  return (
    <div className="unit-field">
      <input className="input mono" inputMode="decimal" placeholder={placeholder || '0.0'} value={value} onChange={e => onChange(e.target.value)} />
      {unit && <span className="u">{unit}</span>}
    </div>
  )
}

function PhotoField({ fieldKey, urls, onChange }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const onPick = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setBusy(true); setErr('')
    try {
      const out = []
      for (const f of files.slice(0, 3 - urls.length)) {
        if (!f.type.startsWith('image/')) throw new Error(t('cap.notImage'))
        if (f.size > 5 * 1024 * 1024) throw new Error(t('cap.tooBig'))
        const c = await compressImage(f, 1200, 0.8)
        const file = new File([c], f.name, { type: 'image/jpeg' })
        const res = await uploadToCloudinary(file, `inspections/${fieldKey}`)
        out.push(res.url)
      }
      onChange([...urls, ...out])
    } catch (e2) { setErr(e2.message || t('cap.uploadErr')) }
    finally { setBusy(false) }
  }
  return (
    <div>
      {(urls.length > 0 || busy) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {urls.map((u, i) => (
            <div key={i} style={{ position: 'relative', width: 46, height: 46 }}>
              <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 7, border: '1px solid var(--border)' }} />
              <button type="button" className="rm" onClick={() => onChange(urls.filter((_, j) => j !== i))} aria-label="x" style={{ width: 16, height: 16 }}><Icon name="x" size={10} /></button>
            </div>
          ))}
        </div>
      )}
      {urls.length < 3 && (
        <label className="btn btn-sm" style={{ marginTop: 8, cursor: busy ? 'wait' : 'pointer' }}>
          <input type="file" accept="image/*" multiple onChange={onPick} disabled={busy} style={{ display: 'none' }} />
          <Icon name="camera" size={14} />{busy ? t('cap.uploading') : `${t('cap.photo')} (${urls.length}/3)`}
        </label>
      )}
      {err && <div style={{ fontSize: 11.5, color: 'var(--red)', marginTop: 6 }}>{err}</div>}
    </div>
  )
}

function SectionCard({ n, icon, title, sub, children }) {
  return (
    <section className="card card-pad">
      <div className="sec-head">
        <div className="sec-num">{n}</div>
        <div style={{ flex: 1 }}>
          <div className="sec-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Icon name={icon} size={16} style={{ color: 'var(--accent-strong)' }} />{title}</div>
          {sub && <div className="sec-sub">{sub}</div>}
        </div>
      </div>
      {children}
    </section>
  )
}

/* ───────────────── captura ───────────────── */
const EMPTY_HEADER = {
  packaging_type: '', packaging_date: '', net_weight: '',
  brix_avg: '', brix_min: '', brix_max: '',
  diameter_min: '', diameter_max: '',
  temp_water: '', temp_ambient: '', temp_pulp: '', notes: '',
}

function CaptureForm({ task, onSave, onCancel, onError }) {
  const { t } = useI18n()
  const c = commodityVisual(task.commodity_code, t)
  const [fields, setFields] = useState([])
  const [loadingTpl, setLoadingTpl] = useState(true)
  const [header, setHeader] = useState(EMPTY_HEADER)
  const [values, setValues] = useState({})
  const [photos, setPhotos] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    setLoadingTpl(true)
    getTemplate(task.commodity_code)
      .then(({ fields }) => {
        if (!alive) return
        setFields(fields)
        const iv = {}, ip = {}
        fields.forEach(f => { iv[f.key] = ''; ip[f.key] = [] })
        setValues(iv); setPhotos(ip)
      })
      .catch(e => onError(t('cap.tplFail', { c: c.label, m: e.message })))
      .finally(() => { if (alive) setLoadingTpl(false) })
    return () => { alive = false }
  }, [task.commodity_code])

  const setH = (k, v) => setHeader(s => ({ ...s, [k]: v }))
  const setV = (k, v) => setValues(s => ({ ...s, [k]: v }))
  const setP = (k, v) => setPhotos(s => ({ ...s, [k]: v }))

  const grouped = useMemo(() => {
    const g = {}
    fields.forEach(f => { const fam = famOf(f.key); (g[fam] = g[fam] || []).push(f) })
    return g
  }, [fields])

  const filled = useMemo(() => Object.values(values).filter(v => v !== '' && v != null).length, [values])
  const photoCount = useMemo(() => Object.values(photos).reduce((a, b) => a + b.length, 0), [photos])
  const progress = fields.length ? Math.round((filled / fields.length) * 100) : 0

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        commodity_code: task.commodity_code,
        producer: task.productor || null,
        lot: task.lote || null,
        variety: task.variedad || null,
        packaging_type: header.packaging_type || null,
        packaging_date: header.packaging_date || null,
        net_weight: header.net_weight === '' ? null : Number(header.net_weight),
        brix_avg: header.brix_avg === '' ? null : Number(header.brix_avg),
        brix_min: header.brix_min === '' ? null : Number(header.brix_min),
        brix_max: header.brix_max === '' ? null : Number(header.brix_max),
        diameter_min: header.diameter_min === '' ? null : Number(header.diameter_min),
        diameter_max: header.diameter_max === '' ? null : Number(header.diameter_max),
        temp_water: header.temp_water === '' ? null : Number(header.temp_water),
        temp_ambient: header.temp_ambient === '' ? null : Number(header.temp_ambient),
        temp_pulp: header.temp_pulp === '' ? null : Number(header.temp_pulp),
        notes: header.notes || null,
        metrics: values,
        photos,
        assignment_id: task.id || null,
      }
      const res = await saveInspection(payload)
      const id = res.id
      let resolucion = null
      try { const d = await getDetail(id); resolucion = d.resolution } catch {}
      onSave({ id, lote: task.lote, resolucion })
    } catch (e) {
      onError(e.message || t('cap.saveErr'))
    } finally {
      setSaving(false)
    }
  }

  const renderField = (f) => {
    const type = f.field_type || f.value_type || 'number'
    const label = humanize(bareKey(f.key)) + (f.unit ? ` (${f.unit})` : '')
    return (
      <div key={f.key}>
        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {f.is_major && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)' }} />}{label}
        </label>
        {type === 'select' ? (
          <select className="select" value={values[f.key] ?? ''} onChange={e => setV(f.key, e.target.value)}>
            <option value="">{t('cap.select')}</option>
            {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : type === 'boolean' ? (
          <div className="seg" style={{ width: '100%' }}>
            <button type="button" className={values[f.key] === 'true' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setV(f.key, 'true')}>{t('cap.yes')}</button>
            <button type="button" className={values[f.key] === 'false' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setV(f.key, 'false')}>{t('cap.no')}</button>
          </div>
        ) : type === 'text' ? (
          <input className="input" value={values[f.key] ?? ''} onChange={e => setV(f.key, e.target.value)} />
        ) : (
          <UnitField value={values[f.key] ?? ''} onChange={v => setV(f.key, v)} unit={f.unit || '%'} />
        )}
        <PhotoField fieldKey={f.key} urls={photos[f.key] || []} onChange={u => setP(f.key, u)} />
      </div>
    )
  }

  return (
    <div className="insp-inner wide fade-up">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-sm" onClick={onCancel}><Icon name="chevLeft" size={16} />{t('cap.back')}</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 4 }}>
          <div className={'commodity-ico ' + c.key} style={{ width: 40, height: 40 }}><Icon name={c.icon} size={21} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15, whiteSpace: 'nowrap' }}>{c.label} <span className="mono" style={{ color: 'var(--text-faint)', fontSize: 14.5 }}>· {task.lote}</span></div>
            <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>{task.productor} · {task.variedad}</div>
          </div>
        </div>
        <span className="badge neutral" style={{ marginLeft: 'auto' }}><Icon name="clipboardCheck" size={13} />{t('cap.inProgress')}</span>
      </div>

      <div className="capture-grid">
        <div className="capture-col">
          <SectionCard n="1" icon="package" title={t('cap.s1')} sub={t('cap.s1sub')}>
            <div className="form-grid">
              <div>
                <label className="field-label">{t('cap.pkgType')}</label>
                <select className="select" value={header.packaging_type} onChange={e => setH('packaging_type', e.target.value)}>
                  <option value="">{t('cap.select')}</option>
                  {TIPOS_EMBALAJE.map(ty => <option key={ty}>{ty}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">{t('cap.pkgDate')}</label>
                <input className="input" type="date" value={header.packaging_date} onChange={e => setH('packaging_date', e.target.value)} />
              </div>
              <div>
                <label className="field-label">{t('cap.netWeight')}</label>
                <UnitField value={header.net_weight} onChange={v => setH('net_weight', v)} unit="kg" />
              </div>
            </div>
          </SectionCard>

          <SectionCard n="2" icon="thermometer" title={t('cap.s2')} sub={t('cap.s2sub')}>
            <div className="measure-group">
              <div className="measure-group-h"><Icon name="droplet" size={15} style={{ color: 'var(--accent-strong)' }} />{t('cap.brix')}</div>
              <div className="measure-cols" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div><label className="field-label">{t('cap.average')}</label><UnitField value={header.brix_avg} onChange={v => setH('brix_avg', v)} unit="°Bx" /></div>
                <div><label className="field-label">{t('cap.min')}</label><UnitField value={header.brix_min} onChange={v => setH('brix_min', v)} unit="°Bx" /></div>
                <div><label className="field-label">{t('cap.max')}</label><UnitField value={header.brix_max} onChange={v => setH('brix_max', v)} unit="°Bx" /></div>
              </div>
            </div>
            <div className="measure-group">
              <div className="measure-group-h"><Icon name="thermometer" size={15} style={{ color: 'var(--accent-strong)' }} />{t('cap.temp')}</div>
              <div className="measure-cols" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div><label className="field-label">{t('cap.water')}</label><UnitField value={header.temp_water} onChange={v => setH('temp_water', v)} unit="°C" /></div>
                <div><label className="field-label">{t('cap.ambient')}</label><UnitField value={header.temp_ambient} onChange={v => setH('temp_ambient', v)} unit="°C" /></div>
                <div><label className="field-label">{t('cap.pulp')}</label><UnitField value={header.temp_pulp} onChange={v => setH('temp_pulp', v)} unit="°C" /></div>
              </div>
            </div>
            <div className="measure-group">
              <div className="measure-group-h"><Icon name="ruler" size={15} style={{ color: 'var(--accent-strong)' }} />{t('cap.caliber')}</div>
              <div className="measure-cols" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div><label className="field-label">{t('cap.min')}</label><UnitField value={header.diameter_min} onChange={v => setH('diameter_min', v)} unit="mm" /></div>
                <div><label className="field-label">{t('cap.max')}</label><UnitField value={header.diameter_max} onChange={v => setH('diameter_max', v)} unit="mm" /></div>
              </div>
            </div>
          </SectionCard>

          <SectionCard n="3" icon="list" title={t('cap.s3')} sub={t('cap.s3sub', { c: c.label.toLowerCase() })}>
            {loadingTpl ? (
              <div className="empty" style={{ padding: 40 }}><Icon name="clock" size={18} /> {t('cap.loadingTpl')}</div>
            ) : fields.length === 0 ? (
              <div className="empty" style={{ padding: 32 }}>{t('cap.noTpl')}</div>
            ) : (
              Object.entries(grouped).map(([fam, fs]) => (
                <div className="measure-group" key={fam}>
                  <div className="measure-group-h"><Icon name={GROUP_ICON[fam] || GROUP_ICON._other} size={15} style={{ color: 'var(--accent-strong)' }} />{t('fam.' + fam)}</div>
                  <div className="form-grid">{fs.map(renderField)}</div>
                </div>
              ))
            )}
          </SectionCard>

          <SectionCard n="4" icon="edit" title={t('cap.s4')} sub={t('cap.s4sub')}>
            <textarea className="textarea" rows={3} placeholder={t('cap.notesPh')} value={header.notes} onChange={e => setH('notes', e.target.value)} />
          </SectionCard>
        </div>

        <div className="capture-summary">
          <section className="card card-pad">
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
              <div className={'commodity-ico ' + c.key} style={{ width: 38, height: 38 }}><Icon name={c.icon} size={19} /></div>
              <div style={{ minWidth: 0 }}>
                <div className="mono" style={{ fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.lote}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.productor}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '6px 0 18px', borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
              <Donut segments={[{ value: progress, varName: '--accent' }, { value: 100 - progress, varName: '--track' }]} size={120} thickness={14} centerTop={`${filled}/${fields.length}`} centerBottom={t('cap.fields')} />
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', textAlign: 'center', lineHeight: 1.5 }}>{t('cap.scoreNote')}</div>
            </div>

            <div className="sum-stat"><span className="k"><Icon name="list" size={14} />{t('cap.metrics')}</span><span className="v">{filled}/{fields.length}</span></div>
            <div className="sum-stat"><span className="k"><Icon name="droplet" size={14} />{t('ins.brixAvg')}</span><span className="v">{header.brix_avg || '—'}</span></div>
            <div className="sum-stat"><span className="k"><Icon name="camera" size={14} />{t('cap.photos')}</span><span className="v">{photoCount}</span></div>

            <div className="capture-actions" style={{ flexDirection: 'column', marginTop: 18 }}>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={save} disabled={saving || loadingTpl}>
                <Icon name="check" size={17} stroke={2.4} />{saving ? t('common.saving') : t('cap.save')}
              </button>
              <button className="btn" style={{ width: '100%' }} onClick={onCancel} disabled={saving}>{t('common.cancel')}</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

/* ───────────────── app ───────────────── */
export default function InspectorApp() {
  const { t } = useI18n()
  const [theme, setTheme] = useState('light')
  const [tab, setTab] = useState('asignadas')
  const [user, setUser] = useState(null)
  const [assigned, setAssigned] = useState([])
  const [completed, setCompleted] = useState([])
  const [loadingA, setLoadingA] = useState(true)
  const [loadingC, setLoadingC] = useState(true)
  const [capture, setCapture] = useState(null)
  const [drawer, setDrawer] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => { setTheme(document.documentElement.dataset.theme || 'light') }, [])
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('insp-theme', theme) } catch {} }, [theme])

  const showToast = useCallback((tt) => { setToast(tt); setTimeout(() => setToast(null), 3400) }, [])

  const loadAssigned = useCallback(() => {
    setLoadingA(true)
    getAssigned().then(setAssigned).catch(e => showToast({ title: t('common.error'), sub: e.message, bad: true })).finally(() => setLoadingA(false))
  }, [showToast, t])
  const loadCompleted = useCallback(() => {
    setLoadingC(true)
    getCompleted().then(setCompleted).catch(e => showToast({ title: t('common.error'), sub: e.message, bad: true })).finally(() => setLoadingC(false))
  }, [showToast, t])

  useEffect(() => { getMe().then(setUser).catch(() => {}); loadAssigned(); loadCompleted() }, [loadAssigned, loadCompleted])

  const onSaved = (record) => {
    setCapture(null)
    setTab('completadas')
    loadAssigned(); loadCompleted()
    const key = { approved: 'aprobado', conditional: 'condicional', rejected: 'rechazado' }[record.resolucion]
    const res = key ? t('res.' + key) : null
    showToast({ title: t('cap.registered'), sub: `${record.lote}${res ? ' · ' + res : ''}` })
  }

  return (
    <div className="insp-shell">
      {!capture && <InspTopBar tab={tab} onTab={setTab} assignedCount={assigned.length} user={user} theme={theme} onTheme={() => setTheme(th => th === 'dark' ? 'light' : 'dark')} onLogout={logout} />}
      <div className="insp-content">
        {capture
          ? <CaptureForm task={capture} onSave={onSaved} onCancel={() => setCapture(null)} onError={(m) => showToast({ title: t('common.error'), sub: m, bad: true })} />
          : tab === 'asignadas'
            ? <QueueScreen assigned={assigned} loading={loadingA} onStart={setCapture} />
            : <CompletedScreen completed={completed} loading={loadingC} onOpen={setDrawer} />}
      </div>
      {drawer && <CompletedDrawer item={drawer} onClose={() => setDrawer(null)} />}
      {toast && (
        <div className="toast-wrap">
          <div className="toast">
            <span className="tcheck" style={toast.bad ? { background: 'var(--red)' } : undefined}><Icon name={toast.bad ? 'x' : 'check'} size={15} stroke={3} /></span>
            <div>
              <div style={{ fontWeight: 600 }}>{toast.title}</div>
              {toast.sub && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 1 }}>{toast.sub}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
