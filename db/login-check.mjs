const BASE = 'http://localhost:3000'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
async function wait(max = 90000) { const s = Date.now(); while (Date.now() - s < max) { try { const r = await fetch(BASE + '/api/health/db'); if (r.status) return } catch {} await sleep(1500) } throw new Error('timeout') }
await wait()
for (const [email, password] of [['admin@insproduce.cl', 'Pass1234'], ['inspector@insproduce.cl', 'Pass1234'], ['admin@insproduce.cl', 'wrong']]) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const d = await r.json().catch(() => ({}))
  console.log(`${email} / ${password} -> ${r.status} ${d.role ? '(role ' + d.role + ')' : '(' + (d.msg || '') + ')'}`)
}
