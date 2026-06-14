// src/lib/auth/verifyToken.js
import jwt from 'jsonwebtoken'

function getSecret() {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET_MISSING')
  return s
}

export function verifyTokenFromCookies(req) {
  let secret
  try {
    secret = getSecret()
  } catch {
    return { ok: false, msg: 'Error de configuración del servidor', status: 500 }
  }

  try {
    const cookieHeader = req.headers.get('cookie')
    if (!cookieHeader) return { ok: false, msg: 'No autenticado', status: 401 }

    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(c => {
        const [key, ...v] = c.split('=')
        return [key, v.join('=')]
      })
    )

    const token = cookies.token
    if (!token) return { ok: false, msg: 'Token no encontrado', status: 401 }

    const decoded = jwt.verify(token, secret)
    return { ok: true, user: decoded }

  } catch (e) {
    if (e.name === 'TokenExpiredError') return { ok: false, msg: 'Token expirado', status: 401 }
    return { ok: false, msg: 'Token inválido', status: 401 }
  }
}

export function verifyTokenFromRequest(req) {
  let secret
  try {
    secret = getSecret()
  } catch {
    return { ok: false, msg: 'Error de configuración del servidor', status: 500 }
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { ok: false, msg: 'Token requerido', status: 401 }
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, secret)
    return { ok: true, user: decoded }

  } catch (e) {
    if (e.name === 'TokenExpiredError') return { ok: false, msg: 'Token expirado', status: 401 }
    return { ok: false, msg: 'Token inválido', status: 401 }
  }
}
