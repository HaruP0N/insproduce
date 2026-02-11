import sql from 'mssql'

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 1433),
  options: {
    encrypt: true,
    trustServerCertificate: false
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  connectionTimeout: 30000,
  requestTimeout: 30000
}

let poolPromise

export async function getPool() {
  if (!poolPromise) poolPromise = sql.connect(config)
  return poolPromise
}

export async function query(text, params = {}) {
  const pool = await getPool()
  const request = pool.request()
  for (const [k, v] of Object.entries(params)) request.input(k, v)
  return request.query(text)
}

export { sql }
