// ─── Estilos compartidos del panel admin ─────────────────────────────────────
// Uso: import { S } from '@/lib/admin/styles'  → S.card, S.th, S.td, etc.

export const S = {
  // Layout
  wrap: {
    maxWidth: 1240,
    margin: '0 auto',
    padding: 18
  },

  // Cards
  card: {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
    overflow: 'hidden',
    marginBottom: 24
  },
  cardHead: {
    padding: '12px 16px',
    borderBottom: '1px solid #e5e7eb',
    fontWeight: 900,
    color: '#15803d',
    fontSize: 14,
    background: '#f8fafc'
  },
  statCard: {
    background: '#fff',
    borderRadius: 16,
    padding: '18px 20px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)'
  },

  // Tabla
  tbl: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13
  },
  th: {
    padding: '10px 14px',
    textAlign: 'left',
    color: '#15803d',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    borderBottom: '2px solid #e5e7eb',
    background: '#f8fafc'
  },
  td: {
    padding: '11px 14px',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'middle',
    color: '#374151'
  },

  // Modal
  modalOv: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 9999
  },
  modal: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '88vh',
    background: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
    display: 'flex',
    flexDirection: 'column'
  },
  modalSm: {
    width: '100%',
    maxWidth: 500,
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 16px 48px rgba(0,0,0,0.25)'
  },
  modalHead: {
    padding: '14px 20px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#fff'
  },
  modalBody: {
    padding: 20,
    overflowY: 'auto',
    flex: 1
  },
  modalFoot: {
    padding: '12px 20px',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10
  },

  // Formularios
  field: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    fontSize: 13,
    color: '#111827',
    background: '#fff',
    boxSizing: 'border-box'
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: '#374151',
    marginBottom: 5
  },

  // Filas de layout
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))',
    gap: 12,
    marginBottom: 20
  }
}