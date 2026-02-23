import { getGroupCfg } from '@/lib/admin'
import { safeStr, humanize, stripPrefix } from '@/lib/admin'

// ─── MetricGroup ──────────────────────────────────────────────────────────────
// Props:
//   groupKey → clave del grupo ('quality' | 'condition' | 'pack' | '_other')
//   entries  → array de [key, value]

export default function MetricGroup({ groupKey, entries }) {
  const cfg = getGroupCfg(groupKey)

  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${cfg.bd}`,
      overflow: 'hidden',
      marginBottom: 14,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
    }}>
      {/* Header del grupo */}
      <div style={{
        background: cfg.header,
        padding: '9px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontWeight: 900, color: cfg.color, fontSize: 13 }}>{cfg.label}</span>
        <span style={{ fontSize: 11, color: cfg.color, opacity: 0.65 }}>{entries.length} campos</span>
      </div>

      {/* Grid de métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: cfg.bd }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ background: cfg.bg, padding: '11px 14px' }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: cfg.color,
              textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3
            }}>
              {humanize(stripPrefix(k))}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
              {safeStr(v) || <span style={{ color: '#9ca3af' }}>--</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}