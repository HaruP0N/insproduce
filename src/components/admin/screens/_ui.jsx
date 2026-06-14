'use client'
// Primitivas reutilizables para las pantallas CRUD del admin.
import { useEffect } from 'react'
import { Icon } from '@/components/proto/Icon'

export function Modal({ title, icon, onClose, children, footer, size }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className={'modal' + (size === 'lg' ? ' lg' : '')}>
          <div className="modal-head">
            {icon && <span style={{ color: 'var(--accent-strong)' }}><Icon name={icon} size={18} /></span>}
            <span className="mt">{title}</span>
            <button className="btn btn-icon" onClick={onClose}><Icon name="x" size={17} /></button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </div>
      </div>
    </>
  )
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', danger, busy, onConfirm, onClose }) {
  return (
    <Modal title={title} icon={danger ? 'warnCircle' : 'checkCircle'} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className={'btn ' + (danger ? 'btn-danger' : 'btn-primary')} onClick={onConfirm} disabled={busy}>
          {busy ? 'Procesando…' : confirmLabel}
        </button>
      </>}>
      <div style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>{message}</div>
    </Modal>
  )
}

export function Field({ label, help, required, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label className="field-label">{label}{required && <span style={{ color: 'var(--red)' }}> *</span>}</label>}
      {children}
      {help && <div className="form-help">{help}</div>}
    </div>
  )
}

// Botón de icono para acciones de fila (editar/eliminar/etc.)
export function RowAction({ icon, title, danger, onClick }) {
  return (
    <button className="btn btn-icon btn-sm" title={title} onClick={(e) => { e.stopPropagation(); onClick() }}
      style={danger ? { color: 'var(--red)' } : undefined}>
      <Icon name={icon} size={15} />
    </button>
  )
}

export function ScreenState({ loading, error, empty, emptyIcon = 'inbox', emptyText, children }) {
  if (loading) return <div className="empty" style={{ padding: 64 }}><Icon name="clock" size={22} /> Cargando…</div>
  if (error) return <div className="empty" style={{ padding: 64, color: 'var(--red)' }}><div className="ei"><Icon name="xCircle" size={22} /></div>{error}</div>
  if (empty) return <div className="empty" style={{ padding: 56 }}><div className="ei"><Icon name={emptyIcon} size={22} /></div>{emptyText || 'Sin registros.'}</div>
  return children
}
