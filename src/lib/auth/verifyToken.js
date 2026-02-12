// src/lib/auth/verifyToken.js
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro-cambiar-en-produccion'

export function verifyTokenFromCookies(req) {
  console.log('\n🔍 [verifyTokenFromCookies] Iniciando verificación...')
  
  try {
    // 1. Obtener el header de cookies
    const cookieHeader = req.headers.get('cookie')
    console.log('🍪 Cookie header existe:', !!cookieHeader)
    
    if (!cookieHeader) {
      console.log('❌ No hay cookie header')
      return { ok: false, msg: 'No autenticado', status: 401 }
    }

    // 2. Parsear las cookies
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(c => {
        const [key, ...v] = c.split('=')
        return [key, v.join('=')]
      })
    )
    
    console.log('🍪 Cookies encontradas:', Object.keys(cookies))

    // 3. Obtener el token
    const token = cookies.token
    console.log('🎫 Token encontrado:', !!token)
    
    if (!token) {
      console.log('❌ Token no encontrado en cookies')
      return { ok: false, msg: 'Token no encontrado', status: 401 }
    }

    // 4. Verificar y decodificar el token
    console.log('🔓 Decodificando token con JWT_SECRET...')
    console.log('🔑 JWT_SECRET existe:', !!JWT_SECRET)
    
    const decoded = jwt.verify(token, JWT_SECRET)
    
    console.log('✅ Token decodificado exitosamente')
    console.log('📦 Contenido completo del token:')
    console.log(JSON.stringify(decoded, null, 2))
    console.log('📊 Propiedades del token:')
    console.log('   - decoded.id:', decoded.id)
    console.log('   - decoded.email:', decoded.email)
    console.log('   - decoded.role:', decoded.role)
    console.log('   - decoded.name:', decoded.name)
    console.log('   - typeof decoded:', typeof decoded)
    console.log('   - decoded es objeto:', typeof decoded === 'object')
    
    // 5. CRÍTICO: Retornar el objeto completo decodificado como user
    const result = { 
      ok: true, 
      user: decoded  // ← decoded YA contiene id, email, role, name
    }
    
    console.log('✅ Retornando:')
    console.log(JSON.stringify(result, null, 2))
    console.log('   - result.ok:', result.ok)
    console.log('   - result.user:', result.user)
    console.log('   - result.user.role:', result.user?.role)
    
    return result
    
  } catch (e) {
    console.error('❌ [verifyTokenFromCookies] Error:', e.message)
    console.error('   Tipo de error:', e.name)
    console.error('   Stack:', e.stack)
    
    if (e.name === 'TokenExpiredError') {
      return { ok: false, msg: 'Token expirado', status: 401 }
    }
    
    return { ok: false, msg: 'Token inválido', status: 401 }
  }
}

export function verifyTokenFromRequest(req) {
  console.log('\n🔍 [verifyTokenFromRequest] Iniciando verificación...')
  
  try {
    const authHeader = req.headers.get('authorization')
    console.log('🔑 Authorization header existe:', !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No hay Bearer token en Authorization header')
      return { ok: false, msg: 'Token requerido', status: 401 }
    }

    const token = authHeader.substring(7)
    console.log('🎫 Token extraído:', !!token)
    
    console.log('🔓 Decodificando token...')
    const decoded = jwt.verify(token, JWT_SECRET)
    
    console.log('✅ Token decodificado exitosamente')
    console.log('📦 Contenido del token:', JSON.stringify(decoded, null, 2))
    
    const result = { 
      ok: true, 
      user: decoded
    }
    
    console.log('✅ Retornando:', JSON.stringify(result, null, 2))
    
    return result
    
  } catch (e) {
    console.error('❌ [verifyTokenFromRequest] Error:', e.message)
    console.error('   Stack:', e.stack)
    
    if (e.name === 'TokenExpiredError') {
      return { ok: false, msg: 'Token expirado', status: 401 }
    }
    
    return { ok: false, msg: 'Token inválido', status: 401 }
  }
}