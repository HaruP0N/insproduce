// src/lib/auth/verifyToken.js
import jwt from 'jsonwebtoken'

// Lee token desde Authorization: Bearer xxx
export function getAuthTokenFromHeader(req) {
  const auth = req.headers.get('authorization') || ''
  const [type, token] = auth.split(' ')
  if (type !== 'Bearer' || !token) return null
  return token
}

// Lee token desde cookie httpOnly "token"
export function getAuthTokenFromCookies(req) {
  // En Route Handlers de Next (App Router), req.cookies existe
  return req.cookies?.get('token')?.value || null
}

function verifyTokenString(token) {
  if (!token) return { ok: false, status: 401, msg: 'Token requerido' }

  const secret = process.env.JWT_SECRET
  if (!secret) return { ok: false, status: 500, msg: 'Falta JWT_SECRET en env' }

  try {
    const payload = jwt.verify(token, secret)
    return { ok: true, payload }
  } catch {
    return { ok: false, status: 401, msg: 'Token inválido o expirado' }
  }
}

// ✅ Para endpoints que usaban Authorization header (si aún los tienes)
export function verifyTokenFromRequest(req) {
  const token = getAuthTokenFromHeader(req)
  return verifyTokenString(token)
}

// ✅ Ideal: para endpoints internos protegidos por cookie (tu caso nuevo)
export function verifyTokenFromCookies(req) {
  const token = getAuthTokenFromCookies(req)
  return verifyTokenString(token)
}

// (Opcional) alias por si algún archivo importaba verifyToken
export const verifyToken = verifyTokenFromCookies
