import sql from 'mssql'

// DB-36: aceptar DB_* (preferido) o AZURE_SQL_* como fallback para que la app conecte.
const config = {
  server:   process.env.DB_SERVER   || process.env.AZURE_SQL_SERVER,
  database: process.env.DB_DATABASE || process.env.AZURE_SQL_DATABASE,
  user:     process.env.DB_USER     || process.env.AZURE_SQL_USER,
  password: process.env.DB_PASSWORD || process.env.AZURE_SQL_PASSWORD,
  port: Number(process.env.DB_PORT || process.env.AZURE_SQL_PORT || 1433),
  options: {
    encrypt: true,
    trustServerCertificate: false
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  connectionTimeout: 30000,
  requestTimeout: 30000
}

let poolPromise

export async function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config).catch(err => {
      poolPromise = undefined // permite reintentar tras un fallo de conexión
      throw err
    })
  }
  return poolPromise
}

export async function query(text, params = {}) {
  const pool = await getPool()
  const request = pool.request()
  for (const [k, v] of Object.entries(params)) request.input(k, v)
  return request.query(text)
}

/**
 * Ejecuta `fn(tx)` dentro de una transacción. Hace rollback ante cualquier error
 * y lo propaga. Si se pasa actorId, fija el contexto de sesión (para auditoría/triggers).
 */
export async function withTransaction(fn, { actorId } = {}) {
  const pool = await getPool()
  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    if (actorId != null) {
      await new sql.Request(tx)
        .input('uid', sql.Int, Number(actorId))
        .query(`EXEC sys.sp_set_session_context @key=N'app_user_id', @value=@uid`)
    }
    const result = await fn(tx)
    await tx.commit()
    return result
  } catch (e) {
    try { await tx.rollback() } catch { /* noop */ }
    throw e
  }
}

/** Crea un Request ligado a una transacción con los params ya cargados. */
export function txRequest(tx, params = {}) {
  const r = new sql.Request(tx)
  for (const [k, v] of Object.entries(params)) r.input(k, v)
  return r
}

/** Error con status HTTP para diferenciar errores de cliente (4xx) de los de servidor. */
export function appError(status, message) {
  const e = new Error(message)
  e.status = status
  return e
}

export { sql }
