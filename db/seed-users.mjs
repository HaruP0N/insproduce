// Upsert de los 2 usuarios con password conocido (dev). No imprime el hash.
import { readFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import sql from 'mssql'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const PASSWORD = 'Pass1234'
const users = [
  { email: 'admin@insproduce.cl', role: 'admin', name: 'Administrador' },
  { email: 'inspector@insproduce.cl', role: 'inspector', name: 'Inspector Principal' },
]
const hash = await bcrypt.hash(PASSWORD, 10)

const p = await sql.connect({ server: env.AZURE_SQL_SERVER, database: 'fruticola_2026', user: env.AZURE_SQL_USER, password: env.AZURE_SQL_PASSWORD, port: 1433, options: { encrypt: true, trustServerCertificate: false } })
for (const u of users) {
  const r = await p.request()
    .input('email', u.email).input('role', u.role).input('name', u.name).input('hash', hash)
    .query(`MERGE qc.users AS t
      USING (SELECT @email AS email) s ON t.email = s.email
      WHEN MATCHED THEN UPDATE SET password_hash=@hash, role=@role, active=1, deleted_at=NULL, updated_at=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (name,email,password_hash,role,active) VALUES (@name,@email,@hash,@role,1)
      OUTPUT $action AS act;`)
  console.log(`${u.email} (${u.role}) -> ${r.recordset[0].act}`)
}
await p.close()
console.log('Listo. Password = Pass1234')
