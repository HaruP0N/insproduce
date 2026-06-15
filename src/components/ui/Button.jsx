import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/ui/cn'

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 border border-transparent',
  secondary: 'bg-surface text-zinc-700 border border-line hover:bg-zinc-50 active:bg-zinc-100',
  ghost: 'bg-transparent text-zinc-600 border border-transparent hover:bg-zinc-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border border-transparent',
  subtle: 'bg-brand-50 text-brand-700 border border-transparent hover:bg-brand-100',
}
const SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-9 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-lg',
}

export function Button({
  variant = 'secondary', size = 'md', loading = false, disabled,
  className, children, type = 'button', ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors select-none',
        'focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant], SIZES[size], className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}
