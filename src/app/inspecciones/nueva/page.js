import { Suspense } from 'react'
import FormularioInspeccion from '@/components/FormularioInspeccion'

export default function NuevaInspeccionPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        color: '#6b7280'
      }}>
        ⏳ Cargando formulario...
      </div>
    }>
      <FormularioInspeccion />
    </Suspense>
  )
}