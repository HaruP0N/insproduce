// src/lib/auth/requireAuth.js
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { fail } from '@/lib/http'

/**
 * Autentica por cookie y, opcionalmente, exige un rol.
 * Uso:
 *   const auth = requireAuth(req, { role: 'admin' })
 *   if (auth.response) return auth.response
 *   const { user } = auth
 *
 * @returns {{ user: object } | { response: Response }}
 */
export function requireAuth(req, { role } = {}) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok || !v.user) return { response: fail(v.status || 401, v.msg || 'No autenticado') }
  if (role && v.user.role !== role) return { response: fail(403, `Requiere rol ${role}`) }
  return { user: v.user }
}

/**
 * Autoriza acceso a un recurso: admin siempre; en caso contrario, el usuario
 * debe ser uno de los dueños del recurso (created_by / assigned_to / user_id).
 *
 * @param {object} user   - usuario autenticado (de requireAuth)
 * @param {Array}  ownerIds - ids de usuario que "poseen" el recurso
 * @returns {boolean}
 */
export function authorizeOwnership(user, ownerIds = []) {
  if (user?.role === 'admin') return true
  return ownerIds.filter(Boolean).map(Number).includes(Number(user?.id))
}
