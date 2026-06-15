// Verificación end-to-end del flujo de inspección contra el server local.
// Crea una inspección con los campos nuevos, la lee, la edita y confirma persistencia.
import { readFileSync } from 'node:fs'
import jwt from 'jsonwebtoken'
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const BASE = 'http://localhost:3000'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const token = jwt.sign({ id: 1, email: 'admin@insproduce.cl', role: 'admin', name: 'Admin' }, env.JWT_SECRET, { expiresIn: '10m' })
const H = { 'Content-Type': 'application/json', Cookie: `token=${token}` }
const ok = (b) => `\x1b[32m✓\x1b[0m ${b}`, bad = (b) => `\x1b[31m✗ ${b}\x1b[0m`

async function wait() { const s = Date.now(); while (Date.now() - s < 90000) { try { const r = await fetch(BASE + '/api/health/db'); if (r.status) return } catch {} await sleep(1500) } throw new Error('server timeout') }

await wait()
// 1) template BLUEBERRY → primera métrica numérica
const tpl = await (await fetch(`${BASE}/api/metric-templates/code/BLUEBERRY`, { headers: H })).json()
const numField = (tpl.fields || []).find(f => (f.field_type || 'number') === 'number')
console.log('template fields:', (tpl.fields || []).length, '| métrica de prueba:', numField?.key)

// 2) POST inspección con campos nuevos
const payload = {
  commodity_code: 'BLUEBERRY', producer: 'VERIFY Farms', lot: 'VERIFY-' + Math.floor(Date.now() / 1000 % 100000),
  variety: 'Ventura', packaging_type: 'Clamshell 125 g', packaging_date: '2026-06-14',
  net_weight: 0.125, brix_avg: 13.5, brix_min: 12.0, brix_max: 15.2,
  diameter_min: 12, diameter_max: 18, temp_water: 3.5, temp_ambient: 18, temp_pulp: 4.2,
  notes: 'verify flow', metrics: numField ? { [numField.key]: 3 } : {}, photos: {},
}
const post = await fetch(`${BASE}/api/inspecciones`, { method: 'POST', headers: H, body: JSON.stringify(payload) })
const pres = await post.json()
console.log('POST /inspecciones:', post.status, JSON.stringify(pres.warnings || pres))
const id = pres.id
if (!id) { console.log(bad('no se creó la inspección')); process.exit(1) }

// 3) GET detalle → ¿persistieron los campos nuevos?
const det = await (await fetch(`${BASE}/api/inspecciones/${id}`, { headers: H })).json()
const checks = [
  ['brix_avg', det.brix_avg, 13.5], ['brix_min', det.brix_min, 12], ['brix_max', det.brix_max, 15.2],
  ['diameter_min', det.diameter_min, 12], ['diameter_max', det.diameter_max, 18],
  ['temp_pulp', det.temp_pulp, 4.2], ['net_weight', det.net_weight, 0.125],
]
console.log('\n--- persistencia de cabecera (#' + id + ') ---')
for (const [k, got, exp] of checks) console.log(Number(got) === Number(exp) ? ok(`${k} = ${got}`) : bad(`${k} = ${got} (esperaba ${exp})`))
console.log('score:', det.score, '| resolución:', det.resolution, '| mediciones:', (det.measurements || []).length)

// 4) PUT edición de cabecera → recalcula
const put = await fetch(`${BASE}/api/inspecciones/${id}`, { method: 'PUT', headers: H, body: JSON.stringify({ brix_avg: 9.9, notes: 'edited by verify' }) })
console.log('\nPUT /inspecciones/:id:', put.status)
const det2 = await (await fetch(`${BASE}/api/inspecciones/${id}`, { headers: H })).json()
console.log(Number(det2.brix_avg) === 9.9 ? ok('edición persistió: brix_avg = 9.9') : bad(`edición falló: brix_avg = ${det2.brix_avg}`))
console.log(det2.notes === 'edited by verify' ? ok('notes actualizado') : bad('notes no cambió'))
