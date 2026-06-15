import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import FormularioInspeccion from '@/components/FormularioInspeccion'

export default function NuevaInspeccionPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        fontFamily: 'system-ui, sans-serif',
        color: '#6b7280'
      }}>
        <Loader2 size={18} />
        Cargando formulario...
      </div>
    }>
      <FormularioInspeccion />
    </Suspense>
  )
}