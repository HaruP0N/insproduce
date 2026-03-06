// src/app/api/google-sheets/config/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'

export async function GET(req) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok || !v.user || v.user.role !== 'admin')
    return NextResponse.json({ msg: 'No autorizado' }, { status: 403 })

  try {
    const configured = !!(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      process.env.GOOGLE_SHEET_ID
    )
    return NextResponse.json({
      configured,
      sheetUrl:       '',
      hasCredentials: !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY),
      hasSheetId:     !!process.env.GOOGLE_SHEET_ID
    })
  } catch (e) {
    console.error('[google-sheets/config GET]', e)
    return NextResponse.json({ configured: false })
  }
}

export async function POST(req) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok || !v.user || v.user.role !== 'admin')
    return NextResponse.json({ msg: 'No autorizado' }, { status: 403 })

  try {
    const body = await req.json()
    if (!body.sheetUrl)
      return NextResponse.json({ msg: 'URL requerida' }, { status: 400 })

    return NextResponse.json({ msg: 'Configuración guardada' })
  } catch (e) {
    console.error('[google-sheets/config POST]', e)
    return NextResponse.json({ msg: 'Error: ' + e.message }, { status: 500 })
  }
}