'use client'
import { Icon } from '@/components/proto/Icon'
import { Sparkline, CountUp } from '@/components/proto/charts'
import { RES, RES_VAR, fmt1 } from '@/lib/proto'
import { useI18n, LangToggle } from '@/lib/i18n'

export const NAV = [
  { group: null, items: [
    { id: 'dashboard', icon: 'dashboard' },
    { id: 'inspecciones', icon: 'clipboard' },
    { id: 'carga', icon: 'layers' },
    { id: 'arribos', icon: 'package' },
    { id: 'asignaciones', icon: 'users' },
    { id: 'lotes', icon: 'boxes' },
    { id: 'reportes', icon: 'report' },
  ] },
  { group: 'catalogo', items: [
    { id: 'commodities', icon: 'grape' },
    { id: 'tolerancias', icon: 'scale' },
    { id: 'plantillas', icon: 'template' },
  ] },
  { group: 'sistema', items: [
    { id: 'usuarios', icon: 'user' },
    { id: 'integraciones', icon: 'plug' },
  ] },
]

export function Sidebar({ route, onNav, pendingCount, user, onLogout }) {
  const { t } = useI18n()
  const initial = (user?.name || 'A').trim().charAt(0).toUpperCase()
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo"><Icon name="grape" size={21} stroke={1.9} /></div>
        <div>
          <div className="brand-name">Fruitbrix</div>
          <div className="brand-sub">Field</div>
        </div>
      </div>
      <nav className="nav">
        {NAV.map((sec, si) => (
          <div key={si}>
            {sec.group && <div className="nav-group-label">{t('nav.group.' + sec.group)}</div>}
            {sec.items.map(it => (
              <button key={it.id} className={'nav-item' + (route === it.id ? ' active' : '')} onClick={() => onNav(it.id)}>
                <Icon name={it.icon} size={18} className="ico" />
                <span>{t('nav.' + it.id)}</span>
                {it.id === 'inspecciones' && pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="side-foot">
        <a className="nav-item" href="/inspector" style={{ marginBottom: 6 }}>
          <Icon name="clipboardCheck" size={18} className="ico" />
          <span>{t('nav.inspectorView')}</span>
          <Icon name="chevRight" size={15} style={{ marginLeft: 'auto', color: 'var(--text-faint)' }} />
        </a>
        <div className="user-chip" onClick={onLogout} title={t('nav.logout')}>
          <div className="avatar">{initial}</div>
          <div style={{ minWidth: 0 }}>
            <div className="user-name">{user?.name || t('nav.user')}</div>
            <div className="user-mail">{user?.email || ''}</div>
          </div>
          <Icon name="logout" size={16} style={{ marginLeft: 'auto', color: 'var(--text-faint)' }} />
        </div>
      </div>
    </aside>
  )
}

export function TopBar({ title, sub, theme, onTheme, onNew, search, onSearch, children }) {
  const { t } = useI18n()
  return (
    <header className="topbar">
      <div>
        <div className="page-title">{title}</div>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      <div className="topbar-actions">
        {children}
        <div className="search">
          <Icon name="search" size={16} />
          <input placeholder={t('topbar.search')} value={search ?? ''} onChange={e => onSearch?.(e.target.value)} />
          <span className="kbd">⌘K</span>
        </div>
        <button className="btn btn-icon" title={t('topbar.notifications')}><Icon name="bell" size={18} /></button>
        <button className="btn btn-icon" title={t('topbar.theme')} onClick={onTheme}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
        <LangToggle title={t('topbar.language')} />
        <button className="btn btn-primary" onClick={onNew}><Icon name="plus" size={17} stroke={2} />{t('topbar.newInspection')}</button>
      </div>
    </header>
  )
}

export function StatusBadge({ resolucion, size }) {
  const { t } = useI18n()
  const r = RES[resolucion]
  if (!r) return null
  return <span className={'badge ' + r.color}><Icon name={r.icon} size={size || 14} stroke={2} />{t('res.' + resolucion)}</span>
}

export function ScoreCell({ score, resolucion }) {
  const v = RES_VAR[resolucion] || '--accent'
  return (
    <span className="row-bar">
      <span className="meter" aria-hidden="true"><span style={{ width: Math.max(score, 3) + '%', background: `var(${v})` }} /></span>
      <span className="mono cell-strong" style={{ width: 38, textAlign: 'right', color: score === 0 ? 'var(--red)' : 'var(--text)' }}>{fmt1(score)}</span>
    </span>
  )
}

export function KpiCard({ icon, label, value, decimals, suffix, unit, foot, footTone, spark, sparkAccent }) {
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <div className="kpi-ico" style={{ color: sparkAccent ? `var(${sparkAccent})` : 'var(--accent-strong)' }}><Icon name={icon} size={17} /></div>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-value mono">
        <CountUp value={value} decimals={decimals || 0} suffix={suffix || ''} />
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div className="kpi-foot">
        {foot && <span className={footTone ? 'chip-trend ' + footTone : ''} style={!footTone ? { color: 'var(--text-faint)' } : null}>
          {footTone === 'up' && <Icon name="arrowUp" size={13} stroke={2.2} />}
          {footTone === 'down' && <Icon name="arrowDown" size={13} stroke={2.2} />}
          {foot}
        </span>}
      </div>
      {spark && <div className="kpi-spark"><Sparkline data={spark} w={160} h={34} accent={sparkAccent || '--accent'} /></div>}
    </div>
  )
}

export function Card({ title, sub, action, children, pad = true, className = '', style }) {
  return (
    <section className={'card ' + className} style={style}>
      <div className={pad ? 'card-pad' : ''}>
        {(title || action) && (
          <div className="card-head">
            <div>
              {title && <div className="card-title">{title}</div>}
              {sub && <div className="card-title-sub">{sub}</div>}
            </div>
            {action && <div className="spacer">{action}</div>}
          </div>
        )}
        {children}
      </div>
    </section>
  )
}
