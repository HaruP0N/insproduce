'use client'
import { useState, useEffect, useRef, useId } from 'react'
import { fmt1 } from '@/lib/proto'

export function Donut({ segments, size = 150, thickness = 18, centerTop, centerBottom }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const r = (size - thickness) / 2
  const C = 2 * Math.PI * r
  const [grow, setGrow] = useState(0)
  useEffect(() => { const t = requestAnimationFrame(() => setGrow(1)); return () => cancelAnimationFrame(t) }, [])
  let acc = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={thickness} />
      {segments.map((s, i) => {
        const frac = (s.value / total) * grow
        const len = frac * C
        const dash = `${len} ${C - len}`
        const off = -acc * C
        acc += s.value / total
        return (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={`var(${s.varName})`} strokeWidth={thickness} strokeLinecap="round"
            strokeDasharray={dash} strokeDashoffset={off}
            style={{ transition: 'stroke-dasharray 1s var(--ease-out), stroke-dashoffset 1s var(--ease-out)' }} />
        )
      })}
      {centerTop !== undefined && (
        <g style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
          <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 600, fill: 'var(--text)', letterSpacing: '-0.02em' }}>{centerTop}</text>
          <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: 11, fill: 'var(--text-faint)', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em' }}>{centerBottom}</text>
        </g>
      )}
    </svg>
  )
}

export function AreaChart({ data, height = 200, accent = '--accent', yKey = 'v', xKey = 'wk', domainPad = 6 }) {
  const wrapRef = useRef(null)
  const [w, setW] = useState(640)
  const uid = useId().replace(/:/g, '')
  const [draw, setDraw] = useState(0)
  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el); setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  useEffect(() => { const t = setTimeout(() => setDraw(1), 60); return () => clearTimeout(t) }, [])

  const padL = 34, padR = 12, padT = 14, padB = 26
  const innerW = Math.max(w - padL - padR, 10)
  const innerH = height - padT - padB
  const vals = data.map(d => d[yKey])
  const min = Math.min(...vals) - domainPad, max = Math.max(...vals) + domainPad
  const sx = (i) => padL + (i / (data.length - 1 || 1)) * innerW
  const sy = (v) => padT + (1 - (v - min) / (max - min || 1)) * innerH
  const linePts = data.map((d, i) => `${sx(i)},${sy(d[yKey])}`)
  const linePath = 'M' + linePts.join(' L')
  const areaPath = `M${sx(0)},${sy(data[0][yKey])} L` + linePts.join(' L') + ` L${sx(data.length - 1)},${padT + innerH} L${sx(0)},${padT + innerH} Z`
  const [hover, setHover] = useState(null)

  return (
    <div ref={wrapRef} style={{ width: '100%', position: 'relative' }}>
      <svg width={w} height={height} style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={'ag' + uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`var(${accent})`} stopOpacity="0.28" />
            <stop offset="100%" stopColor={`var(${accent})`} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map(g => {
          const yy = padT + (g / 2) * innerH
          const vv = max - (g / 2) * (max - min)
          return <g key={g}>
            <line x1={padL} y1={yy} x2={w - padR} y2={yy} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={padL - 8} y={yy + 3} textAnchor="end" style={{ fontSize: 10, fill: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{Math.round(vv)}</text>
          </g>
        })}
        <path d={areaPath} fill={`url(#ag${uid})`} style={{ opacity: draw, transition: 'opacity .9s ease' }} />
        <path d={linePath} fill="none" stroke={`var(${accent})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ strokeDasharray: 2000, strokeDashoffset: draw ? 0 : 2000, transition: 'stroke-dashoffset 1.1s var(--ease-out)' }} />
        {data.map((d, i) => (
          <g key={i}>
            <text x={sx(i)} y={height - 7} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{d[xKey]}</text>
            <circle cx={sx(i)} cy={sy(d[yKey])} r={hover === i ? 5 : 3.5} fill="var(--surface)" stroke={`var(${accent})`} strokeWidth="2"
              style={{ opacity: draw, transition: 'opacity .3s ease, r .15s' }} />
            <rect x={sx(i) - innerW / (data.length * 2)} y={padT} width={innerW / data.length} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
          </g>
        ))}
        {hover !== null && <line x1={sx(hover)} y1={padT} x2={sx(hover)} y2={padT + innerH} stroke={`var(${accent})`} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />}
      </svg>
      {hover !== null && (
        <div style={{ position: 'absolute', left: sx(hover), top: sy(data[hover][yKey]) - 44, transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 9px', boxShadow: 'var(--shadow-pop)', fontSize: 12, fontWeight: 600, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}>{data[hover][xKey]} · </span>
          <span className="mono">{fmt1(data[hover][yKey])}</span>
        </div>
      )}
    </div>
  )
}

export function Sparkline({ data, w = 100, h = 30, accent = '--accent' }) {
  const min = Math.min(...data), max = Math.max(...data)
  const sx = (i) => (i / (data.length - 1 || 1)) * w
  const sy = (v) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6)
  const pts = data.map((v, i) => `${sx(i)},${sy(v)}`)
  const path = 'M' + pts.join(' L')
  const area = path + ` L${w},${h} L0,${h} Z`
  const uid = useId().replace(/:/g, '')
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs><linearGradient id={'sp' + uid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={`var(${accent})`} stopOpacity="0.22" /><stop offset="100%" stopColor={`var(${accent})`} stopOpacity="0" />
      </linearGradient></defs>
      <path d={area} fill={`url(#sp${uid})`} />
      <path d={path} fill="none" stroke={`var(${accent})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx(data.length - 1)} cy={sy(data[data.length - 1])} r="2.6" fill={`var(${accent})`} />
    </svg>
  )
}

export function CountUp({ value, decimals = 0, duration = 900, suffix = '', className }) {
  const [n, setN] = useState(0)
  const startRef = useRef(null)
  useEffect(() => {
    let raf; const from = 0, to = Number(value) || 0
    startRef.current = null
    const step = (t) => {
      if (!startRef.current) startRef.current = t
      const p = Math.min((t - startRef.current) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(from + (to - from) * eased)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <span className={className}>{n.toFixed(decimals)}{suffix}</span>
}
