// PDF del contenedor (estilo QC Inspec destino): se genera al vuelo y se descarga.
import { requireAuth } from '@/lib/auth/requireAuth'
import { fail, serverError } from '@/lib/http'
import { getArrival, getArrivalDefectSummary, getArrivalMeasurements } from '@/lib/repos/arrivals'
import { generateArrivalPDF } from '@/lib/pdf/arrivalReport'

export async function GET(req, context) {
  const auth = requireAuth(req)
  if (auth.response) return auth.response
  try {
    const { id } = await context.params
    const nid = Number(id)
    if (!Number.isInteger(nid) || nid <= 0) return fail(400, 'ID inválido')
    const [arrival, defects, measurements] = await Promise.all([
      getArrival(nid), getArrivalDefectSummary(nid), getArrivalMeasurements(nid),
    ])
    const buffer = generateArrivalPDF({ arrival, defects, measurements })
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Reporte_Contenedor_${String(arrival.container).replace(/[^\w-]+/g, '_')}.pdf"`,
      },
    })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('arrivals/:id/pdf', e)
  }
}
