// Muestreo: suma de pesos de muestra y estadísticas Baxlo (min/moda/máx)
// a partir de N lecturas — el inspector agrega cuantas quiera.

export const sumWeights = (list) => {
  const n = (list || []).map(Number).filter((v) => Number.isFinite(v) && v > 0)
  if (!n.length) return null
  return Math.round(n.reduce((a, b) => a + b, 0) * 10) / 10
}

export const baxloStats = (list) => {
  const n = (list || []).map(Number).filter((v) => Number.isFinite(v) && v > 0)
  if (!n.length) return null
  const freq = new Map()
  for (const v of n) freq.set(v, (freq.get(v) || 0) + 1)
  const maxF = Math.max(...freq.values())
  const modes = [...freq.entries()].filter(([, f]) => f === maxF).map(([v]) => v)
  const mean = n.reduce((a, b) => a + b, 0) / n.length
  // moda = valor más repetido; en empate, el más cercano al promedio
  const mode = modes.sort((a, b) => Math.abs(a - mean) - Math.abs(b - mean))[0]
  return { min: Math.min(...n), max: Math.max(...n), mode, count: n.length }
}
