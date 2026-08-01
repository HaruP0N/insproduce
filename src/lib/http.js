// src/lib/http.js
import { NextResponse } from 'next/server'

export const fail = (status, msg) => NextResponse.json({ msg }, { status })

export const ok = (data, status = 200) => NextResponse.json(data, { status })

// Para usar en catch: loguea el detalle en el servidor, no lo expone al cliente.
export function serverError(scope, e) {
  console.error(`[${scope}]`, e)
  return fail(500, 'Error interno')
}
