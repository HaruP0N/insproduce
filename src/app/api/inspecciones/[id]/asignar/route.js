// src/app/api/inspecciones/[id]/asignar/route.js
// DEPRECADO: el modelo dual (inspections.assigned_to_user_id) se eliminó en el refactor.
// La asignación de trabajo se gestiona vía la tabla qc.assignments (POST /api/inspecciones/asignar).
import { requireAuth } from '@/lib/auth/requireAuth'
import { fail } from '@/lib/http'

export async function PUT(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  return fail(410, 'Endpoint deprecado. Use POST /api/inspecciones/asignar (modelo de asignaciones).')
}
