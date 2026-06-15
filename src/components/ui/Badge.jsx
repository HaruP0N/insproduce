import { cn } from '@/lib/ui/cn'

const TONES = {
  neutral: 'bg-zinc-100 text-zinc-600',
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-sky-50 text-sky-700',
}

export function Badge({ tone = 'neutral', dot = false, className, children }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
      TONES[tone], className
    )}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />}
      {children}
    </span>
  )
}

// Resolución QC -> tono + etiqueta
const RESOLUTION = {
  approved: ['success', 'Aprobado'],
  conditional: ['warning', 'Condicional'],
  rejected: ['danger', 'Rechazado'],
}
export function ResolutionBadge({ value }) {
  const [tone, label] = RESOLUTION[value] || ['neutral', '—']
  return <Badge tone={tone} dot>{label}</Badge>
}

// Estado de asignación
const STATUS = {
  pendiente: ['warning', 'Pendiente'],
  completada: ['success', 'Completada'],
  cancelada: ['neutral', 'Cancelada'],
}
export function StatusBadge({ value }) {
  const [tone, label] = STATUS[value] || ['neutral', value || '—']
  return <Badge tone={tone} dot>{label}</Badge>
}

// Estado de PDF
const PDF = {
  OK: ['success', 'Generado'],
  PENDING: ['warning', 'Pendiente'],
  ERROR: ['danger', 'Error'],
}
export function PdfBadge({ value }) {
  const [tone, label] = PDF[value] || ['neutral', 'Sin PDF']
  return <Badge tone={tone}>{label}</Badge>
}
