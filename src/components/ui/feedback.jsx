import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/ui/cn'

export function Spinner({ className }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-600', className)} aria-hidden />
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-zinc-200/70', className)} />
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 mb-3">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
      )}
      <p className="text-[15px] font-medium text-zinc-800">{title}</p>
      {description && <p className="mt-1 text-sm text-zinc-500 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ title = 'Algo salió mal', description, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      <p className="text-[15px] font-medium text-red-700">{title}</p>
      {description && <p className="mt-1 text-sm text-zinc-500 max-w-sm">{description}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-4 text-sm font-medium text-brand-700 hover:underline">
          Reintentar
        </button>
      )}
    </div>
  )
}
