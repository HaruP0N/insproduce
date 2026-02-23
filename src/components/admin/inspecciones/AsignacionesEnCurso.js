import { S } from '@/lib/admin'
import { StatusDropdown } from '@/components/admin/shared'

// ─── AsignacionesEnCurso ──────────────────────────────────────────────────────
// Props:
//   asignaciones → array completo de asignaciones
//   onChanged    → fn() → refresca datos

export default function AsignacionesEnCurso({ asignaciones, onChanged }) {
  const activas = asignaciones.filter(a => a.status !== 'completada' && a.status !== 'cancelada')

  return (
    <div style={S.card}>
      <div style={S.cardHead}>📋 Asignaciones en curso</div>

      {activas.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#374151' }}>
            No hay asignaciones activas
          </div>
          <div style={{ fontSize: 13 }}>
            Las asignaciones pendientes y en proceso aparecerán aquí.
          </div>
        </div>
      ) : (
        <table style={S.tbl}>
          <thead>
            <tr>
              {['Fecha', 'Lote', 'Productor', 'Variedad', 'Inspector', 'Estado'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activas.map(a => (
              <tr key={a.id}>
                <td style={S.td}>{new Date(a.created_at).toLocaleDateString('es-CL')}</td>
                <td style={S.td}><strong>{a.lot}</strong></td>
                <td style={S.td}>{a.producer}</td>
                <td style={S.td}>{a.variety || '--'}</td>
                <td style={S.td}>{a.inspector_name || a.inspector_email || '--'}</td>
                <td style={S.td}>
                  <StatusDropdown
                    assignmentId={a.id}
                    currentStatus={a.status || 'pendiente'}
                    onChanged={onChanged}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}