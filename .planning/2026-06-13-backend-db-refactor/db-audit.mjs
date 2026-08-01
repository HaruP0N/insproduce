// Introspección de esquema de la BD real (Azure SQL). Lee .env.local, no imprime la contraseña.
// Uso: node .planning/2026-06-13-backend-db-refactor/db-audit.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sql from 'mssql'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../../')
const env = {}
for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const pick = (...keys) => keys.map(k => env[k]).find(Boolean)

const config = {
  server: pick('AZURE_SQL_SERVER', 'DB_SERVER'),
  database: process.argv[2] || pick('AZURE_SQL_DATABASE', 'DB_DATABASE'),
  user: pick('AZURE_SQL_USER', 'DB_USER'),
  password: pick('AZURE_SQL_PASSWORD', 'DB_PASSWORD'),
  port: Number(pick('AZURE_SQL_PORT', 'DB_PORT') || 1433),
  options: { encrypt: true, trustServerCertificate: false },
  connectionTimeout: 30000,
  requestTimeout: 60000,
}

const Q = {
  version: `SELECT @@VERSION AS version`,
  dbinfo: `SELECT DB_NAME() AS db, DATABASEPROPERTYEX(DB_NAME(),'Collation') AS collation`,
  tables: `
    SELECT s.name AS [schema], t.name AS [table], SUM(p.rows) AS [rows]
    FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id=t.schema_id
    JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
    GROUP BY s.name, t.name ORDER BY t.name`,
  columns: `
    SELECT TABLE_NAME AS [table], COLUMN_NAME AS [column], ORDINAL_POSITION AS pos,
      DATA_TYPE AS type, CHARACTER_MAXIMUM_LENGTH AS len,
      NUMERIC_PRECISION AS prec, NUMERIC_SCALE AS scale, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS [default]
    FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_NAME, ORDINAL_POSITION`,
  pks: `
    SELECT tc.TABLE_NAME AS [table], tc.CONSTRAINT_NAME AS pk, kcu.COLUMN_NAME AS [column], kcu.ORDINAL_POSITION AS pos
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON tc.CONSTRAINT_NAME=kcu.CONSTRAINT_NAME
    WHERE tc.CONSTRAINT_TYPE='PRIMARY KEY' ORDER BY tc.TABLE_NAME, kcu.ORDINAL_POSITION`,
  fks: `
    SELECT fk.name AS fk, OBJECT_NAME(fk.parent_object_id) AS parent_table, cpa.name AS parent_col,
      OBJECT_NAME(fk.referenced_object_id) AS ref_table, cre.name AS ref_col,
      fk.delete_referential_action_desc AS on_delete, fk.update_referential_action_desc AS on_update
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id=fk.object_id
    JOIN sys.columns cpa ON cpa.object_id=fkc.parent_object_id AND cpa.column_id=fkc.parent_column_id
    JOIN sys.columns cre ON cre.object_id=fkc.referenced_object_id AND cre.column_id=fkc.referenced_column_id
    ORDER BY parent_table`,
  indexes: `
    SELECT OBJECT_NAME(i.object_id) AS [table], i.name AS [index], i.type_desc AS type,
      i.is_unique AS is_unique, i.is_primary_key AS is_pk,
      STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS cols
    FROM sys.indexes i
    JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.is_included_column=0
    JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
    WHERE i.object_id IN (SELECT object_id FROM sys.tables) AND i.type<>0
    GROUP BY i.object_id, i.name, i.type_desc, i.is_unique, i.is_primary_key
    ORDER BY [table]`,
  checks: `SELECT OBJECT_NAME(parent_object_id) AS [table], name, definition FROM sys.check_constraints ORDER BY [table]`,
  defaults: `SELECT OBJECT_NAME(parent_object_id) AS [table], COL_NAME(parent_object_id, parent_column_id) AS [column], name, definition FROM sys.default_constraints ORDER BY [table]`,
  uniques: `
    SELECT tc.TABLE_NAME AS [table], tc.CONSTRAINT_NAME AS uq, kcu.COLUMN_NAME AS [column]
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON tc.CONSTRAINT_NAME=kcu.CONSTRAINT_NAME
    WHERE tc.CONSTRAINT_TYPE='UNIQUE' ORDER BY tc.TABLE_NAME`,
  identities: `SELECT OBJECT_NAME(object_id) AS [table], name AS [column], seed_value, increment_value FROM sys.identity_columns ORDER BY [table]`,
  triggers: `SELECT t.name AS [trigger], OBJECT_NAME(t.parent_id) AS [table], t.is_disabled, m.definition
    FROM sys.triggers t LEFT JOIN sys.sql_modules m ON m.object_id=t.object_id WHERE t.parent_class=1 ORDER BY [table]`,
  modules: `SELECT o.type_desc AS type, o.name, m.definition
    FROM sys.objects o LEFT JOIN sys.sql_modules m ON m.object_id=o.object_id
    WHERE o.type IN ('P','FN','IF','TF','V') AND o.is_ms_shipped=0 ORDER BY o.type_desc, o.name`,
}

const main = async () => {
  const pool = await sql.connect(config)
  const out = {}
  for (const [k, q] of Object.entries(Q)) {
    try { out[k] = (await pool.request().query(q)).recordset }
    catch (e) { out[k] = { error: e.message } }
  }
  await pool.close()

  writeFileSync(resolve(__dirname, 'db-introspection.json'), JSON.stringify(out, null, 2))

  // Resumen legible (sin secretos)
  const L = []
  L.push(`DB: ${out.dbinfo?.[0]?.db} | collation: ${out.dbinfo?.[0]?.collation}`)
  L.push(`Version: ${(out.version?.[0]?.version || '').split('\n')[0]}`)
  L.push(`\n== TABLAS (${out.tables?.length}) ==`)
  for (const t of out.tables || []) L.push(`  ${t.table.padEnd(28)} rows=${t.rows}`)
  L.push(`\n== PRIMARY KEYS ==`)
  const pkTables = new Set((out.pks || []).map(r => r.table))
  for (const t of out.tables || []) L.push(`  ${t.table.padEnd(28)} ${pkTables.has(t.table) ? 'PK ✓' : 'PK ✗ (sin PK)'}`)
  L.push(`\n== FOREIGN KEYS (${out.fks?.length || 0}) ==`)
  for (const f of out.fks || []) L.push(`  ${f.parent_table}.${f.parent_col} -> ${f.ref_table}.${f.ref_col} [del:${f.on_delete}]`)
  if (!out.fks?.length) L.push('  (ninguna)')
  L.push(`\n== ÍNDICES (${out.indexes?.length || 0}) ==`)
  for (const i of out.indexes || []) L.push(`  ${i.table.padEnd(24)} ${i.index} [${i.type}${i.is_unique?' unique':''}${i.is_pk?' pk':''}] (${i.cols})`)
  L.push(`\n== TRIGGERS (${out.triggers?.length || 0}) ==`)
  for (const t of out.triggers || []) L.push(`  ${t.table}.${t.trigger}${t.is_disabled?' (disabled)':''}`)
  if (!out.triggers?.length) L.push('  (ninguno)')
  L.push(`\n== VIEWS / FUNCS / PROCS (${out.modules?.length || 0}) ==`)
  for (const m of out.modules || []) L.push(`  [${m.type}] ${m.name}`)
  if (!out.modules?.length) L.push('  (ninguno)')
  L.push(`\n== CHECK CONSTRAINTS (${out.checks?.length || 0}) | DEFAULTS (${out.defaults?.length || 0}) | UNIQUES (${out.uniques?.length || 0}) ==`)
  console.log(L.join('\n'))
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
