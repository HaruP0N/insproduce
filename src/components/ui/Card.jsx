import { cn } from '@/lib/ui/cn'

export function Card({ className, children, ...props }) {
  return (
    <div className={cn('bg-surface border border-line rounded-xl', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ className, title, subtitle, icon: Icon, action, children }) {
  return (
    <div className={cn('flex items-center gap-3 px-5 py-4 border-b border-line', className)}>
      {Icon && (
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 shrink-0">
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      )}
      {(title || subtitle) && (
        <div className="min-w-0 flex-1">
          {title && <h3 className="text-[15px] font-medium text-zinc-900 truncate">{title}</h3>}
          {subtitle && <p className="text-[13px] text-zinc-500 truncate">{subtitle}</p>}
        </div>
      )}
      {children}
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  )
}

export function CardBody({ className, children, ...props }) {
  return <div className={cn('p-5', className)} {...props}>{children}</div>
}
