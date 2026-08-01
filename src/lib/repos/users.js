// Repositorio de usuarios + auth (schema qc). Soft-delete (DB-15).
import bcrypt from 'bcryptjs'
import { query, appError } from '@/lib/db/mssql'

export async function getUserByEmail(email) {
  const r = await query(
    `SELECT TOP 1 id, name, email, password_hash, role, active
     FROM qc.users WHERE email = @email AND deleted_at IS NULL`,
    { email: String(email || '').trim().toLowerCase() })
  return r.recordset?.[0] || null
}

export async function getUserById(id) {
  const r = await query(
    `SELECT TOP 1 id, name, email, role, active FROM qc.users
     WHERE id = @id AND deleted_at IS NULL`, { id: Number(id) })
  return r.recordset?.[0] || null
}

export async function listUsers() {
  const r = await query(
    `SELECT id, name, email, role, CAST(active AS int) AS active, created_at
     FROM qc.users WHERE deleted_at IS NULL ORDER BY created_at DESC`)
  return r.recordset
}

export async function listInspectors() {
  const r = await query(
    `SELECT id, name, email, role, CAST(active AS int) AS active FROM qc.users
     WHERE role='inspector' AND active=1 AND deleted_at IS NULL ORDER BY name`)
  return r.recordset
}

export async function createUser({ name, email, password, role }) {
  if (!name || !email || !password || !role) throw appError(400, 'Todos los campos son requeridos')
  if (!['admin', 'inspector'].includes(role)) throw appError(400, 'Rol inválido')
  const mail = String(email).trim().toLowerCase()
  const dup = await query(`SELECT id FROM qc.users WHERE email=@email`, { email: mail })
  if (dup.recordset?.length) throw appError(400, 'El email ya está registrado')
  const hash = await bcrypt.hash(String(password), 10)
  const r = await query(
    `INSERT INTO qc.users (name, email, password_hash, role, active)
     OUTPUT INSERTED.id VALUES (@name, @email, @hash, @role, 1)`,
    { name: String(name), email: mail, hash, role })
  return r.recordset[0].id
}

export async function updateUser(id, { name, email, role, password }, actorId) {
  const exists = await query(`SELECT id FROM qc.users WHERE id=@id AND deleted_at IS NULL`, { id })
  if (!exists.recordset?.length) throw appError(404, 'Usuario no encontrado')
  if (email) {
    const mail = String(email).trim().toLowerCase()
    const clash = await query(`SELECT id FROM qc.users WHERE email=@email AND id<>@id`, { email: mail, id })
    if (clash.recordset?.length) throw appError(400, 'El email ya está en uso')
  }
  const sets = ['updated_at = SYSUTCDATETIME()', 'updated_by_user_id = @actor']
  const params = { id, actor: actorId ?? null }
  if (name) { sets.push('name = @name'); params.name = String(name) }
  if (email) { sets.push('email = @email'); params.email = String(email).trim().toLowerCase() }
  if (role && ['admin', 'inspector'].includes(role)) { sets.push('role = @role'); params.role = role }
  if (password) { sets.push('password_hash = @hash'); params.hash = await bcrypt.hash(String(password), 10) }
  await query(`UPDATE qc.users SET ${sets.join(', ')} WHERE id = @id`, params)
}

export async function setUserActive(id, active, actorId) {
  const r = await query(
    `UPDATE qc.users SET active=@a, updated_at=SYSUTCDATETIME(), updated_by_user_id=@actor
     WHERE id=@id AND deleted_at IS NULL`,
    { id, a: active ? 1 : 0, actor: actorId ?? null })
  if (!r.rowsAffected?.[0]) throw appError(404, 'Usuario no encontrado')
}

// DB-15: borrado lógico (no físico) para preservar autoría/historial.
export async function softDeleteUser(id, actorId) {
  if (Number(id) === Number(actorId)) throw appError(400, 'No puedes eliminarte a ti mismo')
  const r = await query(
    `UPDATE qc.users SET deleted_at=SYSUTCDATETIME(), deleted_by_user_id=@actor, active=0
     WHERE id=@id AND deleted_at IS NULL`,
    { id, actor: actorId ?? null })
  if (!r.rowsAffected?.[0]) throw appError(404, 'Usuario no encontrado')
}

export { bcrypt }
