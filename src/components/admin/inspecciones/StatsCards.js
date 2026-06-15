import { ClipboardList, FileX, Activity } from 'lucide-react'
import { S } from '@/lib/admin'

const CARDS = [
  { key: 'total',       label: 'Total inspecciones',  Icon: ClipboardList, color: '#15803d', bg: '#f0fdf4' },
  { key: 'pdfPend',     label: 'PDF pendientes',       Icon: FileX,         color: '#b45309', bg: '#fffbeb' },
  { key: 'asigActivas', label: 'Asignaciones activas', Icon: Activity,      color: '#1d4ed8', bg: '#eff6ff' }
]

export default function StatsCards({ total, pdfPend, asigActivas }) {
  const values = { total, pdfPend, asigActivas }

  return (
    <div style={S.statsRow}>
      {CARDS.map(({ key, label, Icon, color, bg }) => (
        <div key={key} style={{ ...S.statCard, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={22} color={color} />
          </div>
          <div>
            <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#111827' }}>{values[key]}</div>
          </div>
        </div>
      ))}
    </div>
  )
}