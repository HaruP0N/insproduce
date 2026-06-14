// Smoke test del backend qc. Acuña un JWT con JWT_SECRET y ejerce los endpoints clave.
// Limpia (soft-delete) la inspección de prueba al final. Uso: node db/smoke-test.mjs
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import jwt from 'jsonwebtoken'
import sql from 'mssql'

const env = {}
for (const l of readFileSync(resolve('.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const BASE = 'http://localhost:3000'
const secret = env.JWT_SECRET
if (!secret) { console.error('No JWT_SECRET'); process.exit(1) }
const tok = (u) => jwt.sign(u, secret, { expiresIn: '1h' })
const inspector = tok({ id: 2, email: 'inspector@insproduce.cl', role: 'inspector', name: 'Inspector Principal' })
const admin = tok({ id: 1, email: 'admin@insproduce.cl', role: 'admin', name: 'Administrador' })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
async function waitForServer(maxMs = 90000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try { const r = await fetch(BASE + '/api/health/db'); if (r.status) return true } catch {}
    await sleep(1500)
  }
  throw new Error('dev server no respondió a tiempo')
}
await waitForServer()

let pass = 0, fail = 0
const check = (name, cond, extra = '') => { console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`); cond ? pass++ : fail++ }
const call = async (path, { method = 'GET', token, body } = {}) => {
  const r = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
    body: body ? JSON.stringify(body) : undefined
  })
  let data = null; try { data = await r.json() } catch {}
  return { status: r.status, data }
}

let createdId = null
try {
  let r = await call('/api/auth/me', { token: inspector })
  check('auth/me inspector', r.status === 200 && r.data?.user?.role === 'inspector', `status ${r.status}`)

  r = await call('/api/commodities', { token: inspector })
  check('commodities lista', r.status === 200 && Array.isArray(r.data) && r.data.length > 0, `${r.data?.length} items`)

  r = await call('/api/metric-templates/code/BLUEBERRY', { token: inspector })
  check('template BLUEBERRY (fields desde defects)', r.status === 200 && r.data?.fields?.length > 0, `${r.data?.fields?.length} fields`)

  r = await call('/api/inspecciones', { method: 'POST', token: inspector, body: {
    commodity_code: 'BLUEBERRY', producer: 'Smoke Test Productor', lot: 'SMOKE-LOT-001', variety: 'Duke',
    net_weight: 0.5, brix_avg: 12.5, temp_pulp: 2,
    metrics: { 'quality.dust': '0.5', 'condition.decay': '0.5', 'condition.mold_type': 'None', 'quality.size_note': '2', 'condition.crushed': '3', 'unknown.key': '9' },
    photos: { 'condition.decay': ['http://169.254.169.254/evil', 'https://res.cloudinary.com/x/image/upload/ok.jpg'] }
  }})
  createdId = r.data?.id
  check('crear inspección (transaccional)', r.status === 200 && createdId, `id ${createdId}, unknownKeys ${JSON.stringify(r.data?.warnings?.unknownKeys)}, skippedPhotos ${r.data?.warnings?.skippedPhotos}`)
  check('  -> ignoró key desconocida', r.data?.warnings?.unknownKeys?.includes('unknown.key'))
  check('  -> bloqueó foto SSRF (169.254)', r.data?.warnings?.skippedPhotos === 1)

  if (createdId) {
    r = await call(`/api/inspecciones/${createdId}`, { token: inspector })
    check('detalle inspección + resultado', r.status === 200 && r.data?.resolution != null,
      `resolution=${r.data?.resolution} score=${r.data?.score} total=${r.data?.total_defects_pct}`)
    check('  -> métricas reconstruidas', r.data?.metrics?.values?.['quality.dust'] === '0.5')
    check('  -> 1 foto guardada (Cloudinary)', (r.data?.photos?.length ?? 0) === 1)

    // IDOR: admin puede; otro inspector no aplica (solo 2 users). Probar 404 inexistente:
    r = await call('/api/inspecciones/999999', { token: inspector })
    check('detalle inexistente -> 404', r.status === 404)
  }

  r = await call('/api/inspecciones/completadas', { token: inspector })
  check('completadas (inspector)', r.status === 200 && Array.isArray(r.data?.inspecciones))

  r = await call('/api/inspecciones/historial', { token: admin })
  check('historial (admin)', r.status === 200 && Array.isArray(r.data), `${r.data?.length} rows`)

  r = await call('/api/inspecciones/historial', { token: inspector })
  check('historial con rol inspector -> 403', r.status === 403)

  r = await call('/api/users', { token: admin })
  check('users (admin)', r.status === 200 && Array.isArray(r.data), `${r.data?.length} users`)

  r = await call('/api/assignments/pendientes', { token: admin })
  check('assignments/pendientes (admin)', r.status === 200 && Array.isArray(r.data?.asignaciones))
} catch (e) {
  console.error('ERROR en smoke test:', e.message); fail++
}

// Cleanup: soft-delete inspección de prueba
if (createdId) {
  try {
    const p = await sql.connect({ server: env.AZURE_SQL_SERVER, database: 'fruticola_2026', user: env.AZURE_SQL_USER, password: env.AZURE_SQL_PASSWORD, port: 1433, options: { encrypt: true, trustServerCertificate: false } })
    await p.request().input('id', createdId).query(`UPDATE qc.inspections SET deleted_at=SYSUTCDATETIME() WHERE id=@id`)
    await p.close()
    console.log(`\n(limpieza: inspección ${createdId} marcada deleted_at)`)
  } catch (e) { console.log('cleanup falló:', e.message) }
}

console.log(`\nRESULTADO: ${pass} OK, ${fail} fallos`)
process.exit(fail ? 1 : 0)
