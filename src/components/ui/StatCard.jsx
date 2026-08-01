import { cn } from '@/lib/ui/cn'

const TREND = {
  up: 'text-emerald-600',
  down: 'text-red-600',
  flat: 'text-zinc-400',
}

export function StatCard({ label, value, hint, icon: Icon, trend, className }) {
  return (
    <div className={cn('bg-surface border border-line rounded-xl p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] text-zinc-500">{label}</span>
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 shrink-0">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
      <div className="mt-1.5 text-2xl font-medium tabular-nums text-zinc-900">{value}</div>
      {hint && <div className={cn('mt-0.5 text-xs', TREND[trend] || 'text-zinc-400')}>{hint}</div>}
    </div>
  )
}
