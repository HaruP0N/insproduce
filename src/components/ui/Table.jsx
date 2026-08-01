import { cn } from '@/lib/ui/cn'

export function Table({ className, children }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)}>{children}</table>
    </div>
  )
}

export function THead({ children }) {
  return (
    <thead>
      <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-zinc-400">
        {children}
      </tr>
    </thead>
  )
}

export function TH({ className, children, ...props }) {
  return <th className={cn('font-medium px-4 py-2.5', className)} {...props}>{children}</th>
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-line">{children}</tbody>
}

export function TR({ className, children, ...props }) {
  return <tr className={cn('hover:bg-zinc-50/70 transition-colors', className)} {...props}>{children}</tr>
}

export function TD({ className, children, ...props }) {
  return <td className={cn('px-4 py-3 text-zinc-700 align-middle', className)} {...props}>{children}</td>
}
