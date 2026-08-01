'use client'
import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { useI18n } from '@/lib/i18n'
import { gsConfig, gsTest, gsLastSync, gsSync } from '@/lib/adminCrud'

function StatusRow({ ok, label, okText, missingText }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: ok ? 'var(--green)' : 'var(--text-faint)' }}><Icon name={ok ? 'checkCircle' : 'xCircle'} size={16} /></span>
      <span style={{ fontSize: 13 }}>{label}</span>
      <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: ok ? 'var(--green)' : 'var(--text-faint)' }}>{ok ? okText : missingText}</span>
    </div>
  )
}

export default function IntegracionesScreen({ onToast }) {
  const { t, lang } = useI18n()
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState(null)
  const [busy, setBusy] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([gsConfig().catch(() => ({ configured: false })), gsLastSync().catch(() => ({ lastSync: null }))])
      .then(([c, s]) => { setCfg(c); setLastSync(s?.lastSync || null) })
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const test = async () => {
    setBusy('test')
    try { const r = await gsTest(); onToast({ title: t('int.testOk'), sub: r.msg || t('int.testOkSub') }) }
    catch (e) { onToast({ title: t('int.testFail'), sub: e.message, bad: true }) }
    finally { setBusy(null) }
  }
  const sync = async () => {
    setBusy('sync')
    try {
      const r = await gsSync()
      onToast({ title: t('int.syncOk'), sub: `BD→Sheet ${r.bd_to_sheet ?? 0} · Sheet→BD ${r.sheet_to_bd ?? r.nuevas ?? 0}` })
      load()
    } catch (e) { onToast({ title: t('int.syncFail'), sub: e.message, bad: true }) }
    finally { setBusy(null) }
  }

  const okText = t('int.ok'), missingText = t('int.missing')
  return (
    <div className="content-inner fade-up">
      <div className="grid cols-2-1" style={{ alignItems: 'start' }}>
        <Card title={t('int.gsTitle')} sub={t('int.gsSub')}>
          {loading ? <div className="empty" style={{ padding: 40 }}><Icon name="clock" size={18} /> {t('common.loading')}</div> : (
            <div>
              <StatusRow ok={!!cfg?.configured} label={t('int.configured')} okText={okText} missingText={missingText} />
              <StatusRow ok={!!cfg?.hasCredentials} label={t('int.credentials')} okText={okText} missingText={missingText} />
              <StatusRow ok={!!cfg?.hasSheetId} label={t('int.sheetId')} okText={okText} missingText={missingText} />
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <button className="btn" onClick={test} disabled={busy}><Icon name="plug" size={15} />{busy === 'test' ? t('int.testing') : t('int.test')}</button>
                <button className="btn btn-primary" onClick={sync} disabled={busy || !cfg?.configured}><Icon name="arrowUp" size={15} />{busy === 'sync' ? t('int.syncing') : t('int.sync')}</button>
              </div>
              {!cfg?.configured && <div className="form-help" style={{ marginTop: 12 }}>{t('int.notConfigured')}</div>}
            </div>
          )}
        </Card>
        <Card title={t('int.status')}>
          <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginBottom: 6 }}>{t('int.lastSync')}</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{lastSync ? new Date(lastSync).toLocaleString(lang === 'en' ? 'en-US' : 'es') : t('common.never')}</div>
        </Card>
      </div>
    </div>
  )
}
