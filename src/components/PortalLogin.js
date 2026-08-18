'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { setToken } from '@/lib/auth/clientToken'
import { useI18n, LangToggle } from '@/lib/i18n'
import { Icon } from '@/components/proto/Icon'

// state: 'idle' | 'admin' | 'ops'  (ops = inspector)
export default function PortalLogin() {
  const router = useRouter()
  const { t } = useI18n()
  const [state, setState] = useState('idle')
  const [theme, setTheme] = useState('light')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setTheme(document.documentElement.dataset.theme || 'light') }, [])
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('insp-theme', theme) } catch {} }, [theme])
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setState('idle') }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const open = (which) => { setError(''); setState(which) }
  const close = () => { setError(''); setState('idle') }
  const onPanelClick = (which) => { if (state !== 'idle' && state !== which) open(which) }

  const handleLogin = async (e) => {
    e.preventDefault()
    const expectedRole = state === 'admin' ? 'admin' : 'inspector'
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.msg || t('portal.loginErr'))
      if (data.role !== expectedRole) {
        throw new Error(expectedRole === 'admin' ? t('portal.roleErrAdmin') : t('portal.roleErrOps'))
      }
      setToken(data.token)
      router.push(data.role === 'admin' ? '/admin' : '/inspector')
    } catch (err) {
      setError(err?.message || t('portal.loginErr'))
    } finally {
      setLoading(false)
    }
  }

  const renderPanel = (which, dom, icoName) => {
    const isOpen = state === which
    return (
      <section className={'panel ' + (which === 'admin' ? 'admin' : 'ops')} onClick={() => onPanelClick(which)}>
        <div className="bg" style={{ backgroundImage: `url('/bg-${which === 'admin' ? 'admin' : 'ops'}.jpg')` }} />
        <div className="tint" />
        <div className="pcontent">
          <span className={'badge ' + (which === 'admin' ? 'amber' : 'green') + ' domain-badge'}><span className="dot" />{t(dom + '.badge')}</span>
          <h1 className="p-title">{t(dom + '.title')}</h1>
          <p className="p-blurb">{t(dom + '.blurb')}</p>
          <button className="p-cta" type="button" onClick={(e) => { e.stopPropagation(); open(which) }}>
            {t(dom + '.cta')}<Icon name="chevRight" size={17} stroke={2.2} />
          </button>
          <div className="meta-row"><span>{t(dom + '.m1')}</span><span className="dotsep" /><span>{t(dom + '.m2')}</span><span className="dotsep" /><span>{t(dom + '.m3')}</span></div>
        </div>

        <form className={'login ' + (which === 'admin' ? 'admin' : 'ops')} onSubmit={handleLogin} onClick={(e) => e.stopPropagation()} autoComplete="on" noValidate>
          <div className="login-head">
            <div className="lh-left">
              <div className="lh-ico"><Icon name={icoName} size={18} /></div>
              <div>
                <h2>{t(dom + '.badge')}</h2>
                <div className="h-sub">{t(dom + '.loginSub')}</div>
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); close() }}>
              <Icon name="chevLeft" size={14} stroke={2.2} />{t('portal.back')}
            </button>
          </div>
          <div className="field">
            <label className="field-label">{t('login.email')}</label>
            <input className="input" type="email" name="email" placeholder={which === 'admin' ? 'nombre@insproduce.cl' : 'inspector@insproduce.cl'}
              autoComplete="username" value={isOpen ? email : ''} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">{t('login.password')}</label>
            <input className="input" type="password" name="password" placeholder="••••••••"
              autoComplete="current-password" value={isOpen ? password : ''} onChange={e => setPassword(e.target.value)} />
          </div>
          {isOpen && error && <div style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 10 }}>{error}</div>}
          <button className="btn btn-primary btn-submit" type="submit" disabled={loading}>{loading ? t('login.signingIn') : t('login.signIn')}</button>
          <div className="login-foot">
            <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>{t('portal.sso')}</span>
            <a className="forgot" href="#" onClick={(e) => e.preventDefault()}>{t('portal.forgot')}</a>
          </div>
        </form>
      </section>
    )
  }

  return (
    <div className="portal">
      <header className="portal-top">
        <div className="portal-brand">
          <div className="mark"><img src="/logo-mark.png" alt="Insproduce" /></div>
          <div>
            <div className="brand-name">Insproduce</div>
            <div className="brand-sub">Quality Control</div>
          </div>
        </div>
        <div className="right">
          <LangToggle title={t('topbar.language')} />
          <button className="btn btn-icon" type="button" title={t('topbar.theme')} onClick={() => setTheme(th => th === 'dark' ? 'light' : 'dark')}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
          <a className="help-link" href="#" onClick={(e) => e.preventDefault()}>
            <Icon name="warnCircle" size={16} />{t('portal.help')}
          </a>
        </div>
      </header>

      <main className="stage" data-state={state}>
        {renderPanel('admin', 'portal.admin', 'dashboard')}
        {renderPanel('ops', 'portal.ops', 'clipboardCheck')}
      </main>

      {/* Móvil/tablet: una sola tarjeta con switch Admin/Inspector (inspector por defecto:
          es quien trabaja desde el celular en terreno). Visible solo ≤860px vía CSS. */}
      <main className="portal-mobile">
        {/* Fondo según el rol elegido (crossfade entre las dos fotos del portal) */}
        <div className="pm-bg" style={{ backgroundImage: "url('/bg-ops.jpg')", opacity: state === 'admin' ? 0 : 0.5 }} />
        <div className="pm-bg" style={{ backgroundImage: "url('/bg-admin.jpg')", opacity: state === 'admin' ? 0.5 : 0 }} />
        <div className="pm-tint" />
        <div className="pm-card">
          <div className="pm-seg" role="tablist">
            <button type="button" className={state !== 'admin' ? 'on' : ''} onClick={() => open('ops')}>
              <Icon name="clipboardCheck" size={15} /> {t('portal.ops.badge')}
            </button>
            <button type="button" className={state === 'admin' ? 'on' : ''} onClick={() => open('admin')}>
              <Icon name="dashboard" size={15} /> {t('portal.admin.badge')}
            </button>
          </div>
          <form onSubmit={handleLogin} autoComplete="on" noValidate>
            <div className="field">
              <label className="field-label">{t('login.email')}</label>
              <input className="input" type="email" name="email"
                placeholder={state === 'admin' ? 'nombre@insproduce.cl' : 'inspector@insproduce.cl'}
                autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">{t('login.password')}</label>
              <input className="input" type="password" name="password" placeholder="••••••••"
                autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {error && <div style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 10 }}>{error}</div>}
            <button className="btn btn-primary btn-submit" type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
