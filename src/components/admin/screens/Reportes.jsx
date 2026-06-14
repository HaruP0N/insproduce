'use client'
import { useState, useMemo } from 'react'
import { Card, KpiCard, StatusBadge, ScoreCell } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'

const RES_FILTERS = [{ k: 'todas', l: 'Todas' }, { k: 'aprobado', l: 'Aprobado' }, { k: 'condicional', l: 'Condicional' }, { k: 'rechazado', l: 'Rechazado' }]

function toCSV(rows) {
  const head = ['Fecha', 'Lote', 'Productor', 'Commodity', 'Variedad', 'Inspector', 'Score', 'Resolucion']
  const esc = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const lines = rows.map(r => [r.fecha, r.lote, r.productor, r.commodityName || r.commodity, r.variedad, r.inspector, r.score, r.resolucion].map(esc).join(','))
  return head.join(',') + '\n' + lines.join('\n')
}

export default function ReportesScreen({ list = [], dash, onToast }) {
  const [filter, setFilter] = useState('todas')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const rows = useMemo(() => list.filter(i => {
    if (filter !== 'todas' && i.resolucion !== filter) return false
    if (from && i.createdAt && new Date(i.createdAt) < new Date(from)) return false
    if (to && i.createdAt && new Date(i.createdAt) > new Date(to + 'T23:59:59')) return false
    return true
  }), [list, filter, from, to])

  const stats = useMemo(() => {
    const n = rows.length
    const avg = n ? rows.reduce((a, r) => a + (r.score || 0), 0) / n : 0
    const rej = rows.filter(r => r.resolucion === 'rechazado').length
    const app = rows.filter(r => r.resolucion === 'aprobado').length
    return { n, avg, rej, app, rejRate: n ? Math.round(rej / n * 100) : 0 }
  }, [rows])

  const exportCSV = () => {
    if (!rows.length) return onToast?.({ title: 'Nada para exportar', bad: true })
    const blob = new Blob(['﻿' + toCSV(rows)], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `reporte-inspecciones-${rows.length}.csv`
    a.click(); URL.revokeObjectURL(a.href)
    onToast?.({ title: 'CSV exportado', sub: `${rows.length} inspecciones` })
  }

  return (
    <div className="content-inner fade-up">
      <div className="grid kpi-row" style={{ marginBottom: 16 }}>
        <KpiCard icon="clipboard" label="Inspecciones" value={stats.n} foot="en el filtro" />
        <KpiCard icon="sparkle" label="Score promedio" value={stats.avg} decimals={1} unit="/100" foot="filtrado" />
        <KpiCard icon="checkCircle" label="Aprobadas" value={stats.app} foot={`${stats.n ? Math.round(stats.app / stats.n * 100) : 0}%`} />
        <KpiCard icon="xCircle" label="Tasa de rechazo" value={stats.rejRate} suffix="%" foot={`${stats.rej} rechazadas`} footTone={stats.rejRate > 0 ? 'down' : null} />
      </div>

      <Card pad={true}>
        <div className="crud-toolbar" style={{ marginBottom: 14 }}>
          <div className="seg">
            {RES_FILTERS.map(f => <button key={f.k} className={filter === f.k ? 'on' : ''} onClick={() => setFilter(f.k)}>{f.l}</button>)}
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-faint)' }}>Desde <input className="input" type="date" style={{ width: 150 }} value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-faint)' }}>Hasta <input className="input" type="date" style={{ width: 150 }} value={to} onChange={e => setTo(e.target.value)} /></label>
          <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={exportCSV}><Icon name="download" size={15} />Exportar CSV</button>
        </div>

        <table className="tbl">
          <thead><tr><th>Fecha</th><th>Lote / productor</th><th>Inspector</th><th className="num">Score</th><th>Resolución</th><th>PDF</th></tr></thead>
          <tbody>
            {rows.map(i => (
              <tr key={i.id}>
                <td className="mono" style={{ color: 'var(--text-dim)' }}>{i.fecha}</td>
                <td><div className="cell-strong mono" style={{ fontSize: 12.5 }}>{i.lote}</div><div className="cell-dim">{i.productor}</div></td>
                <td><span className="pill-tag"><Icon name="user" size={12} />{i.inspector}</span></td>
                <td className="num"><ScoreCell score={i.score} resolucion={i.resolucion} /></td>
                <td><StatusBadge resolucion={i.resolucion} /></td>
                <td>{i.pdfUrl ? <a className="btn btn-icon btn-sm" href={i.pdfUrl} target="_blank" rel="noreferrer" title="Ver PDF"><Icon name="report" size={15} /></a> : <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty" style={{ padding: 48 }}><div className="ei"><Icon name="report" size={22} /></div>Sin inspecciones en el filtro.</div>}
      </Card>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-faint)' }}>{rows.length} de {list.length} inspecciones</div>
    </div>
  )
}
