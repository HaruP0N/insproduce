// ─── Button compartido ────────────────────────────────────────────────────────

const VARIANTS = {
  primary: { background: '#16a34a', color: '#fff',     borderColor: '#15803d' },
  outline:  { background: '#fff',    color: '#16a34a',  borderColor: '#86efac' },
  blue:     { background: '#2563eb', color: '#fff',     borderColor: '#1d4ed8' },
  gray:     { background: '#6b7280', color: '#fff',     borderColor: '#4b5563' },
  danger:   { background: '#dc2626', color: '#fff',     borderColor: '#b91c1c' }
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  small = false,
  style: extra = {},
  type = 'button'
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: small ? '6px 12px' : '9px 16px',
    borderRadius: 10,
    fontSize: small ? 12 : 13,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    border: '1px solid transparent'
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...VARIANTS[variant], ...extra }}
    >
      {children}
    </button>
  )
}