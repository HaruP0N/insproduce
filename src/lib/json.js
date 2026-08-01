// src/lib/json.js
// Parseo tolerante de JSON guardado en columnas NVARCHAR. Centraliza lo que
// estaba duplicado como safeJson/safeJsonParse/safeJsonArray en varias rutas.

export function safeJson(value, fallback = {}) {
  try {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'object') return value
    return JSON.parse(String(value))
  } catch {
    return fallback
  }
}

// Alias para call-sites que pasan el fallback explícito.
export const safeJsonParse = safeJson

export function safeJsonArray(value) {
  const parsed = safeJson(value, [])
  return Array.isArray(parsed) ? parsed : []
}
