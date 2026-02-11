import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PROTECTED_PREFIXES = ['/admin', '/ops']

function isProtected(pathname) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(req) {
  const { pathname } = req.nextUrl
  if (!isProtected(pathname)) return NextResponse.next()

  const token = req.cookies.get('token')?.value
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    return NextResponse.json({ msg: 'Falta JWT_SECRET en env' }, { status: 500 })
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    const role = payload?.role

    // ✅ reglas por rol
    if (pathname.startsWith('/admin') && role !== 'admin') {
      const url = req.nextUrl.clone()
      url.pathname = '/ops'
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/ops') && role !== 'inspector') {
      const url = req.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  } catch {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: ['/admin/:path*', '/ops/:path*']
}
