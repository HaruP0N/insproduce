import { cn } from '@/lib/ui/cn'

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

const SIZES = { sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-11 w-11 text-sm' }

export function Avatar({ name, size = 'md', className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-brand-100 text-brand-700 font-medium select-none',
        SIZES[size], className
      )}
      title={name}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
