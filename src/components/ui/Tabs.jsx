'use client'
import { cn } from '@/lib/ui/cn'

// items: [{ key, label, icon }]  value/onChange controlados
export function Tabs({ items = [], value, onChange, className }) {
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-xl border border-line bg-surface p-1', className)} role="tablist">
      {items.map((it) => {
        const active = it.key === value
        const Icon = it.icon
        return (
          <button key={it.key} role="tab" aria-selected={active} onClick={() => onChange?.(it.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 h-8 text-[13px] font-medium transition-colors',
              active ? 'bg-brand-50 text-brand-700' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
            )}>
            {Icon && <Icon className="h-4 w-4" aria-hidden />}
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
