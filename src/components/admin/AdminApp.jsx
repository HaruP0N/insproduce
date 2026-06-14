'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Sidebar, TopBar, KpiCard, Card, StatusBadge, ScoreCell } from '@/components/proto/ui'
import { Donut, AreaChart } from '@/components/proto/charts'
import { Icon } from '@/components/proto/Icon'
import { RES, RES_VAR, fmt1, mapResolution, fechaCorta } from '@/lib/proto'
import { getInspectionsList, getDashboard, getInspectionDetail, getMe, logout } from '@/lib/adminData'

const TITLES = {
  dashboard: ['Dashboard', 'Resumen de calidad'],
  inspecciones: ['Inspecciones', 'Historial completo de evaluaciones'],
  nueva: ['Nueva inspección', 'Registrar una evaluación de calidad'],
  asignaciones: ['Asignaciones', 'Carga de trabajo del equipo'],
  lotes: ['Lotes y pallets', 'Trazabilidad en bodega'],
  reportes: ['Reportes', 'Análisis y exportación'],
  commodities: ['Commodities', 'Catálogo de productos'],
  tolerancias: ['Tolerancias', 'Umbrales de defectos'],
  plantillas: ['Plantillas', 'Formatos de inspección'],
  usuarios: ['Usuarios', 'Cuentas y permisos'],
  integraciones: ['Integraciones', 'Conexiones externas'],
}

function DashSkeleton() {
  return (
    <div className="content-inner">
      <div className="grid kpi-row" style={{ marginBottom: 16 }}>
        {[0, 1, 2, 3].map(i => <div key={i} className="card kpi"><div className="skel" style={{ height: 14, width: '55%' }} /><div className="skel" style={{ height: 30, width: '40%', marginTop: 14 }} /><div className="skel" style={{ height: 34, marginTop: 16 }} /></div>)}
      </div>
      <div className="grid cols-2-1" style={{ marginBottom: 16 }}>
        <div className="card card-pad"><div className="skel" style={{ height: 18, width: '30%' }} /><div className="skel" style={{ height: 210, marginTop: 18 }} /></div>
        <div className="card card-pad"><div className="skel" style={{ height: 18, width: '40%' }} /><div className="skel" style={{ height: 150, marginTop: 18, borderRadius: 99 }} /></div>
      </div>
    </div>
  )
}

export default function AdminApp() {
  const [theme, setTheme] = useState('light')
  const [route, setRoute] = useState('dashboard')
  const [user, setUser] = useState(null)
  const [list, setList] = useState([])
  const [dash, setDash] = useState(null)
  const [drawer, setDrawer] = useState(null)
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { setTheme(document.documentElement.dataset.theme || 'light') }, [])
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('insp-theme', theme) } catch {} }, [theme])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [u, l, d] = await Promise.all([getMe().catch(() => null), getInspectionsList(), getDashboard()])
        if (!alive) return
        setUser(u); setList(l); setDash(d)
      } catch (e) {
        if (alive) setError(e.message || 'Error cargando datos')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const navigate = useCallback((r) => setRoute(r), [])
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3200) }
  const pending = dash?.summary?.conditional ?? list.filter(i => i.resolucion === 'condicional').length

  const [t, sub] = TITLES[route] || ['', '']

  let screen
  if (loading) screen = <DashSkeleton />
  else if (error) screen = <div className="content-inner"><div className="empty"><div className="ei"><Icon name="xCircle" size={22} /></div>{error}</div></div>
  else if (route === 'dashboard') screen = <DashboardScreen list={list} dash={dash} onOpen={setDrawer} onNew={navigate} />
  else if (route === 'inspecciones') screen = <InspeccionesScreen list={list} onOpen={setDrawer} />
  else screen = <PlaceholderScreen route={route} />

  return (
    <div className="app">
      <Sidebar route={route === 'nueva' ? 'inspecciones' : route} onNav={navigate} pendingCount={pending} user={user} onLogout={logout} />
      <main className="main">
        <TopBar title={t} sub={sub} theme={theme} onTheme={() => setTheme(th => th === 'dark' ? 'light' : 'dark')} onNew={() => navigate('nueva')} />
        <div className="content" key={route}>{screen}</div>
      </main>
      {drawer && <InspectionDrawer summary={drawer} onClose={() => setDrawer(null)} onToast={showToast} />}
      {toast && (
        <div className="toast-wrap"><div className="toast">
          <span className="tcheck"><Icon name="check" size={15} stroke={3} /></span>
          <div><div style={{ fontWeight: 600 }}>{toast.title}</div>{toast.sub && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 1 }}>{toast.sub}</div>}</div>
        </div></div>
      )}
    </div>
  )
}

/* ---------- DASHBOARD ---------- */
function DashboardScreen({ list, dash, onOpen, onNew }) {
  const s = dash?.summary || {}
  const total = Number(s.total) || 0
  const rejected = Number(s.rejected) || 0
  const conditional = Number(s.conditional) || 0
  const approved = Number(s.approved) || 0
  const rejectRate = total ? Math.round((rejected / total) * 100) : 0
  const weekly = dash?.weekly || []
  const trend = weekly.map(w => ({ wk: fechaCorta(w.wk), v: Math.round((Number(w.avg_score) || 0) * 10) / 10 }))
  const counts = weekly.map(w => Number(w.cnt) || 0)
  const scores = weekly.map(w => Math.round((Number(w.avg_score) || 0) * 10) / 10)
  const recent = list.slice(0, 5)
  const defs = dash?.topDefects || []
  const maxDef = defs[0]?.cnt || 1
  const defVar = (d) => d.is_major ? '--red' : (d.family === 'condition' ? '--amber' : '--accent')
  const donutSegs = [
    { value: approved, varName: '--green' }, { value: conditional, varName: '--amber' }, { value: rejected, varName: '--red' },
  ]
  const resData = [
    { k: 'aprobado', n: 'Aprobado', c: approved, v: '--green' },
    { k: 'condicional', n: 'Condicional', c: conditional, v: '--amber' },
    { k: 'rechazado', n: 'Rechazado', c: rejected, v: '--red' },
  ]

  return (
    <div className="content-inner fade-up">
      <div className="grid kpi-row stagger" style={{ marginBottom: 16 }}>
        <KpiCard icon="clipboard" label="Inspecciones" value={total} foot="acumuladas" spark={counts.length > 1 ? counts : [0, total]} sparkAccent="--accent" />
        <KpiCard icon="sparkle" label="Score promedio" value={Number(s.avg_score) || 0} decimals={1} unit="/100" foot="sobre 100" spark={scores.length > 1 ? scores : [Number(s.avg_score) || 0, Number(s.avg_score) || 0]} sparkAccent="--green" />
        <KpiCard icon="xCircle" label="Tasa de rechazo" value={rejectRate} suffix="%" foot={`${rejected} de ${total} lotes`} footTone={rejectRate > 0 ? 'down' : null} spark={[12, 18, 9, 21, 14, 20, 7, rejectRate]} sparkAccent="--red" />
        <KpiCard icon="clock" label="Pend. de revisión" value={conditional} foot="condicionales" spark={[3, 2, 4, 1, 3, 2, 3, conditional]} sparkAccent="--amber" />
      </div>

      <div className="grid cols-2-1 stagger" style={{ marginBottom: 16 }}>
        <Card title="Tendencia de score" sub="Promedio por semana">
          {trend.length > 1
            ? <AreaChart data={trend} height={210} accent="--accent" />
            : <div className="empty" style={{ padding: '60px 20px' }}>Aún no hay suficientes datos para la tendencia.</div>}
        </Card>
        <Card title="Resoluciones" sub={`${total} inspecciones`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 4 }}>
            <Donut segments={donutSegs} size={138} thickness={17} centerTop={total} centerBottom="TOTAL" />
            <div className="legend" style={{ flex: 1 }}>
              {resData.map(r => (
                <div className="legend-row" key={r.k}>
                  <span className="sw" style={{ background: `var(${r.v})` }} />
                  <span className="lname">{r.n}</span>
                  <span className="lval">{r.c}</span>
                  <span className="lpct">{total ? Math.round((r.c / total) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid cols-1-2 stagger">
        <Card title="Defectos causales" sub="Incidencias acumuladas">
          <div style={{ marginTop: 2 }}>
            {defs.length === 0 && <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>Sin defectos registrados.</div>}
            {defs.map(d => (
              <div className="defect-row" key={d.label}>
                <span className="defect-name" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {d.is_major && <span title="Defecto crítico" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)' }} />}
                  {d.label}
                </span>
                <span className="defect-val" style={{ color: `var(${defVar(d)})` }}>{d.cnt}</span>
                <span className="defect-meter meter"><span style={{ width: (d.cnt / maxDef) * 100 + '%', background: `var(${defVar(d)})` }} /></span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Inspecciones recientes" action={<button className="btn btn-ghost btn-sm" onClick={() => onNew('inspecciones')}>Ver todas <Icon name="chevRight" size={15} /></button>}>
          <table className="tbl">
            <thead><tr><th>Fecha</th><th>Lote / productor</th><th className="num">Score</th><th>Resolución</th><th></th></tr></thead>
            <tbody>
              {recent.map(i => (
                <tr key={i.id} onClick={() => onOpen(i)}>
                  <td className="mono" style={{ color: 'var(--text-dim)' }}>{i.fecha}</td>
                  <td><div className="cell-strong mono" style={{ fontSize: 12.5 }}>{i.lote}</div><div className="cell-dim">{i.productor} · {i.variedad}</div></td>
                  <td className="num"><ScoreCell score={i.score} resolucion={i.resolucion} /></td>
                  <td><StatusBadge resolucion={i.resolucion} /></td>
                  <td style={{ width: 30, color: 'var(--text-faint)' }}><Icon name="chevRight" size={16} /></td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={5}><div className="empty">Sin inspecciones todavía.</div></td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

/* ---------- INSPECCIONES ---------- */
const SORTS = {
  fecha: (a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''),
  lote: (a, b) => a.lote.localeCompare(b.lote),
  score: (a, b) => a.score - b.score,
}
function InspeccionesScreen({ list, onOpen }) {
  const [filter, setFilter] = useState('todas')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState({ key: 'fecha', dir: -1 })

  const counts = useMemo(() => {
    const c = { todas: list.length, aprobado: 0, condicional: 0, rechazado: 0 }
    list.forEach(i => { c[i.resolucion] = (c[i.resolucion] || 0) + 1 })
    return c
  }, [list])

  const rows = useMemo(() => {
    let r = list.filter(i => filter === 'todas' || i.resolucion === filter)
    if (q.trim()) { const t = q.toLowerCase(); r = r.filter(i => (i.lote + i.productor + i.variedad + i.inspector).toLowerCase().includes(t)) }
    return [...r].sort((a, b) => SORTS[sort.key](a, b) * sort.dir)
  }, [list, filter, q, sort])

  const toggleSort = (key) => setSort(s => s.key === key ? { key, dir: -s.dir } : { key, dir: key === 'score' ? -1 : 1 })
  const SortIcon = ({ k }) => sort.key === k ? <Icon name={sort.dir === 1 ? 'arrowUp' : 'arrowDown'} size={12} stroke={2.4} style={{ marginLeft: 4 }} /> : null
  const chips = [{ k: 'todas', label: 'Todas' }, { k: 'aprobado', label: 'Aprobado' }, { k: 'condicional', label: 'Condicional' }, { k: 'rechazado', label: 'Rechazado' }]

  return (
    <div className="content-inner fade-up">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="seg">
          {chips.map(c => <button key={c.k} className={filter === c.k ? 'on' : ''} onClick={() => setFilter(c.k)}>{c.label}<span className="cnt">{counts[c.k] || 0}</span></button>)}
        </div>
        <div className="search" style={{ marginLeft: 'auto' }}>
          <Icon name="search" size={16} /><input placeholder="Filtrar inspecciones…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>
      <Card pad={true}>
        <table className="tbl">
          <thead><tr>
            <th className="sortable" onClick={() => toggleSort('fecha')}>Fecha <SortIcon k="fecha" /></th>
            <th className="sortable" onClick={() => toggleSort('lote')}>Lote / productor <SortIcon k="lote" /></th>
            <th>Variedad</th><th>Inspector</th>
            <th className="num sortable" onClick={() => toggleSort('score')}>Score <SortIcon k="score" /></th>
            <th>Resolución</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map(i => (
              <tr key={i.id} onClick={() => onOpen(i)}>
                <td className="mono" style={{ color: 'var(--text-dim)' }}>{i.fecha}</td>
                <td><div className="cell-strong mono" style={{ fontSize: 12.5 }}>{i.lote}</div><div className="cell-dim">{i.productor}</div></td>
                <td style={{ color: 'var(--text-dim)' }}>{i.variedad}</td>
                <td><span className="badge neutral" style={{ height: 22, fontSize: 11.5 }}>{i.inspector}</span></td>
                <td className="num"><ScoreCell score={i.score} resolucion={i.resolucion} /></td>
                <td><StatusBadge resolucion={i.resolucion} /></td>
                <td style={{ width: 30, color: 'var(--text-faint)' }}><Icon name="chevRight" size={16} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty"><div className="ei"><Icon name="search" size={22} /></div>Sin resultados.</div>}
      </Card>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-faint)' }}>{rows.length} de {list.length} inspecciones</div>
    </div>
  )
}

/* ---------- DRAWER ---------- */
function InspectionDrawer({ summary, onClose, onToast }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    getInspectionDetail(summary.id).then(setData).catch(e => setErr(e.message))
    return () => window.removeEventListener('keydown', h)
  }, [summary.id])

  const resolucion = data ? mapResolution(data.resolution, data.score) : summary.resolucion
  const score = data ? Number(data.score) || 0 : summary.score
  const r = RES[resolucion]
  const meas = (data?.measurements || []).filter(m => m.value_num != null)
  const maxM = Math.max(1, ...meas.map(m => Number(m.value_num)))
  const ringSeg = [{ value: score, varName: RES_VAR[resolucion] }, { value: Math.max(0, 100 - score), varName: '--track' }]

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
              <StatusBadge resolucion={resolucion} />
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>#{summary.id}</span>
            </div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>{summary.lote}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 3 }}>{summary.productor} · {summary.commodity} {summary.variedad}</div>
          </div>
          <button className="btn btn-icon" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="drawer-body">
          <div className="score-hero" style={{ marginBottom: 24 }}>
            <Donut segments={ringSeg} size={104} thickness={13} centerTop={fmt1(score)} centerBottom="SCORE" />
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>Resolución</div>
              {r && <div className={'badge ' + r.color} style={{ height: 30, fontSize: 14, padding: '0 14px' }}><Icon name={r.icon} size={17} stroke={2} />{r.label}</div>}
              {data && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10, lineHeight: 1.5 }}>
                Calidad {fmt1(data.quality_total_pct)}% · Condición {fmt1(data.condition_total_pct)}%<br />Total {fmt1(data.total_defects_pct)}%
              </div>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            {[['calendar', 'Fecha', summary.fecha], ['mapPin', 'Productor', summary.productor], ['grape', 'Commodity', summary.commodity], ['layers', 'Variedad', summary.variedad]].map(([ic, l, v]) => (
              <div key={l} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-faint)', fontSize: 11, marginBottom: 5 }}><Icon name={ic} size={13} />{l}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>

          <div className="card-title" style={{ marginBottom: 14 }}>Desglose de defectos</div>
          {err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
          {!data && !err && <div className="skel" style={{ height: 120 }} />}
          {data && meas.length === 0 && <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>Sin defectos cuantitativos.</div>}
          {meas.map(m => {
            const v = m.family === 'condition' ? '--amber' : '--accent'
            const val = Number(m.value_num)
            return (
              <div className="defect-row" key={m.key}>
                <span className="defect-name">{m.label}</span>
                <span className="defect-val" style={{ color: `var(${v})` }}>{val}{m.unit === '%' ? '%' : ''}</span>
                <span className="defect-meter meter"><span style={{ width: (val / maxM) * 100 + '%', background: `var(${v})` }} /></span>
              </div>
            )
          })}
        </div>
        <div className="drawer-foot">
          <button className="btn" style={{ flex: 1 }} disabled={!summary.pdfUrl} onClick={() => summary.pdfUrl ? window.open(summary.pdfUrl, '_blank') : onToast?.({ title: 'PDF no disponible' })}>
            <Icon name="report" size={16} />Ver reporte
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onToast?.({ title: 'Edición', sub: 'Próximamente' })}><Icon name="edit" size={16} />Editar</button>
        </div>
      </aside>
    </>
  )
}

/* ---------- PLACEHOLDER ---------- */
function PlaceholderScreen({ route }) {
  const [t, sub] = TITLES[route] || ['', '']
  return (
    <div className="content-inner fade-up">
      <Card>
        <div className="empty">
          <div className="ei"><Icon name="sliders" size={22} /></div>
          <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>{t}</div>
          <div style={{ marginTop: 4 }}>{sub} — en construcción.</div>
        </div>
      </Card>
    </div>
  )
}
