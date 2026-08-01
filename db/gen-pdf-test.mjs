import { readFileSync, writeFileSync } from 'node:fs'
import jwt from 'jsonwebtoken'
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const BASE = 'http://localhost:3000'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const id = process.argv[2] || '2'
async function wait(max = 90000) { const s = Date.now(); while (Date.now() - s < max) { try { const r = await fetch(BASE + '/api/health/db'); if (r.status) return } catch {} await sleep(1500) } throw new Error('timeout') }
await wait()
const token = jwt.sign({ id: 1, email: 'admin@insproduce.cl', role: 'admin', name: 'Administrador' }, env.JWT_SECRET, { expiresIn: '1h' })
const r = await fetch(`${BASE}/api/inspecciones/${id}/generar-pdf`, { method: 'POST', headers: { Cookie: `token=${token}` } })
const d = await r.json().catch(() => ({}))
console.log('generar-pdf:', r.status, JSON.stringify(d))
if (!d.pdf_url) process.exit(1)
const pdf = await fetch(d.pdf_url)
const buf = Buffer.from(await pdf.arrayBuffer())
writeFileSync('/tmp/insp.pdf', buf)
console.log('PDF guardado en /tmp/insp.pdf', buf.length, 'bytes')
