'use client'
import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/ui/cn'

const ToastCtx = createContext(null)

const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info }
const TONE = {
  success: 'text-emerald-600', error: 'text-red-600', warning: 'text-amber-600', info: 'text-sky-600',
}

let _id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback((opts) => {
    const o = typeof opts === 'string' ? { message: opts } : (opts || {})
    const id = ++_id
    const item = { id, type: o.type || 'info', title: o.title, message: o.message, duration: o.duration ?? 4000 }
    setToasts((t) => [...t, item])
    if (item.duration > 0) setTimeout(() => dismiss(id), item.duration)
    return id
  }, [dismiss])

  const api = {
    toast,
    success: (m, opts) => toast({ ...(typeof m === 'string' ? { message: m } : m), ...opts, type: 'success' }),
    error: (m, opts) => toast({ ...(typeof m === 'string' ? { message: m } : m), ...opts, type: 'error' }),
    warning: (m, opts) => toast({ ...(typeof m === 'string' ? { message: m } : m), ...opts, type: 'warning' }),
    info: (m, opts) => toast({ ...(typeof m === 'string' ? { message: m } : m), ...opts, type: 'info' }),
    dismiss,
  }

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info
          return (
            <div key={t.id} role="status"
              className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-lg animate-[fadeIn_.15s_ease-out]">
              <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', TONE[t.type])} aria-hidden />
              <div className="min-w-0 flex-1">
                {t.title && <p className="text-sm font-medium text-zinc-900">{t.title}</p>}
                {t.message && <p className="text-[13px] text-zinc-600 break-words">{t.message}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} aria-label="Cerrar"
                className="text-zinc-400 hover:text-zinc-600 shrink-0">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
