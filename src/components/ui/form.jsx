import { cn } from '@/lib/ui/cn'

const base =
  'w-full h-9 rounded-lg border border-line bg-surface px-3 text-sm text-zinc-900 placeholder:text-zinc-400 ' +
  'transition-colors hover:border-line-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none ' +
  'disabled:opacity-60 disabled:bg-zinc-50'

export function Input({ className, invalid, ...props }) {
  return <input className={cn(base, invalid && 'border-red-400 focus:border-red-500 focus:ring-red-500/30', className)} {...props} />
}

export function Textarea({ className, rows = 3, ...props }) {
  return <textarea rows={rows} className={cn(base, 'h-auto py-2 resize-y', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(base, 'pr-8 appearance-none bg-no-repeat', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: 'right 10px center' }}
      {...props}>
      {children}
    </select>
  )
}

export function Field({ label, htmlFor, hint, error, required, children, className }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-zinc-700">
          {label}{required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p>
        : hint ? <p className="text-xs text-zinc-400">{hint}</p> : null}
    </div>
  )
}

export function Label({ className, children, ...props }) {
  return <label className={cn('text-[13px] font-medium text-zinc-700', className)} {...props}>{children}</label>
}
