'use client'

import { useState } from 'react'
import { STATUS_OPTIONS, statusCfg } from '@/lib/admin'

// ─── StatusDropdown ───────────────────────────────────────────────────────────
// Props:
//   assignmentId  → id de la asignación a actualizar
//   currentStatus → valor actual ('pendiente' | 'completada' | 'cancelada')
//   onChanged     → callback sin args, se llama al guardar correctamente

export default function StatusDropdown({ assignmentId, currentStatus, onChanged }) {
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const cfg = statusCfg(currentStatus)

  const handleSelect = async (newStatus) => {
    if (newStatus === currentStatus) { setOpen(false); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.msg || 'Error al actualizar')
      onChanged()
    } catch (err) {
      alert('❌ ' + err.message)
    } finally {
      setSaving(false)
      setOpen(false)
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          border: `1px solid ${cfg.bd}`,
          background: cfg.bg,
          color: cfg.color
        }}
      >
        {saving ? '…' : `${cfg.emoji} ${cfg.label}`}
        <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '110%', left: 0, zIndex: 999,
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
            boxShadow: '0 8px 28px rgba(0,0,0,0.12)', padding: 6, minWidth: 170
          }}>
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', textAlign: 'left', padding: '9px 12px',
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: opt.value === currentStatus ? opt.bg : 'transparent',
                  color: opt.value === currentStatus ? opt.color : '#374151',
                  fontWeight: opt.value === currentStatus ? 700 : 500, fontSize: 13
                }}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}