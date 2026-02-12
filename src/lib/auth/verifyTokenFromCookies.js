// src/lib/auth/verifyToken.js
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro-cambiar-en-produccion'

export function verifyTokenFromCookies(req) {
  try {
    const cookieHeader = req.headers.get('cookie')
    if (!cookieHeader) {
      return { ok: false, msg: 'No autenticado', status: 401 }
    }

    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(c => {
        const [key, ...v] = c.split('=')
        return [key, v.join('=')]
      })
    )

    const token = cookies.token
    if (!token) {
      return { ok: false, msg: 'Token no encontrado', status: 401 }
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    
    // 🔧 CRÍTICO: Retornar el usuario decodificado
    return { 
      ok: true, 
      user: decoded  // ← ESTO ES LO IMPORTANTE
    }
  } catch (e) {
    console.error('[verifyTokenFromCookies]', e.message)
    return { ok: false, msg: 'Token inválido', status: 401 }
  }
}

export function verifyTokenFromRequest(req) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { ok: false, msg: 'Token requerido', status: 401 }
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET)
    
    // 🔧 CRÍTICO: Retornar el usuario decodificado
    return { 
      ok: true, 
      user: decoded  // ← ESTO ES LO IMPORTANTE
    }
  } catch (e) {
    console.error('[verifyTokenFromRequest]', e.message)
    return { ok: false, msg: 'Token inválido', status: 401 }
  }
}