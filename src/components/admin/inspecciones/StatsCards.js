import { S } from '@/lib/admin'

// ─── StatsCards ───────────────────────────────────────────────────────────────
// Props:
//   total        → número total de inspecciones
//   pdfPend      → número de inspecciones sin PDF
//   asigActivas  → número de asignaciones activas

export default function StatsCards({ total, pdfPend, asigActivas }) {
  const cards = [
    { label: 'Total inspecciones',   value: total },
    { label: 'PDF pendientes',        value: pdfPend },
    { label: 'Asignaciones activas',  value: asigActivas }
  ]

  return (
    <div style={S.statsRow}>
      {cards.map(({ label, value }) => (
        <div key={label} style={S.statCard}>
          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#111827' }}>{value}</div>
        </div>
      ))}
    </div>
  )
}