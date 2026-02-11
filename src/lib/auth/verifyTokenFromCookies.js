// src/lib/auth/verifyTokenFromCookies.js
import { jwtVerify } from 'jose'

export async function verifyTokenFromCookies(req) {
  try {
    const token = req.cookies?.get('token')?.value

    if (!token) {
      return { ok: false, status: 401, msg: 'No hay token en cookies' }
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      return { ok: false, status: 500, msg: 'Falta JWT_SECRET en env' }
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    return { ok: true, status: 200, payload }
  } catch (e) {
    return { ok: false, status: 401, msg: 'Token inválido o expirado' }
  }
}
