'use client'
import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/proto/ui'
import { Icon } from '@/components/proto/Icon'
import { gsConfig, gsTest, gsLastSync, gsSync } from '@/lib/adminCrud'

function StatusRow({ ok, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: ok ? 'var(--green)' : 'var(--text-faint)' }}><Icon name={ok ? 'checkCircle' : 'xCircle'} size={16} /></span>
      <span style={{ fontSize: 13 }}>{label}</span>
      <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: ok ? 'var(--green)' : 'var(--text-faint)' }}>{ok ? 'OK' : 'Falta'}</span>
    </div>
  )
}

export default function IntegracionesScreen({ onToast }) {
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState(null)
  const [busy, setBusy] = useState(null)   // 'test' | 'sync'

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([gsConfig().catch(() => ({ configured: false })), gsLastSync().catch(() => ({ lastSync: null }))])
      .then(([c, s]) => { setCfg(c); setLastSync(s?.lastSync || null) })
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const test = async () => {
    setBusy('test')
    try { const r = await gsTest(); onToast({ title: 'Conexión OK', sub: r.msg || 'Google Sheets responde' }) }
    catch (e) { onToast({ title: 'Falló la conexión', sub: e.message, bad: true }) }
    finally { setBusy(null) }
  }
  const sync = async () => {
    setBusy('sync')
    try {
      const r = await gsSync()
      onToast({ title: 'Sincronización completa', sub: `BD→Sheet ${r.bd_to_sheet ?? 0} · Sheet→BD ${r.sheet_to_bd ?? r.nuevas ?? 0}` })
      load()
    } catch (e) { onToast({ title: 'Falló la sincronización', sub: e.message, bad: true }) }
    finally { setBusy(null) }
  }

  return (
    <div className="content-inner fade-up">
      <div className="grid cols-2-1" style={{ alignItems: 'start' }}>
        <Card title="Google Sheets" sub="Sincronización bidireccional de asignaciones">
          {loading ? <div className="empty" style={{ padding: 40 }}><Icon name="clock" size={18} /> Cargando…</div> : (
            <div>
              <StatusRow ok={!!cfg?.configured} label="Integración configurada" />
              <StatusRow ok={!!cfg?.hasCredentials} label="Credenciales de servicio" />
              <StatusRow ok={!!cfg?.hasSheetId} label="ID de planilla (GOOGLE_SHEET_ID)" />
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <button className="btn" onClick={test} disabled={busy}><Icon name="plug" size={15} />{busy === 'test' ? 'Probando…' : 'Probar conexión'}</button>
                <button className="btn btn-primary" onClick={sync} disabled={busy || !cfg?.configured}><Icon name="arrowUp" size={15} />{busy === 'sync' ? 'Sincronizando…' : 'Sincronizar ahora'}</button>
              </div>
              {!cfg?.configured && <div className="form-help" style={{ marginTop: 12 }}>Configura <span className="mono">GOOGLE_SHEET_ID</span> y las credenciales de servicio en <span className="mono">.env.local</span> para habilitar la sincronización.</div>}
            </div>
          )}
        </Card>
        <Card title="Estado">
          <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginBottom: 6 }}>Última sincronización</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{lastSync ? new Date(lastSync).toLocaleString('es') : 'Nunca'}</div>
        </Card>
      </div>
    </div>
  )
}
