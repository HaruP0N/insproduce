// src/app/api/google-sheets/last-sync/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'

export async function GET(req) {
  const v = verifyTokenFromCookies(req)
  
  if (!v.ok || !v.user || v.user.role !== 'admin') {
    return NextResponse.json({ msg: 'No autorizado' }, { status: 403 })
  }

  try {
    // Por ahora retornamos null, puedes guardar esto en BD después
    return NextResponse.json({ lastSync: null })
  } catch (e) {
    console.error('[last-sync]', e)
    return NextResponse.json({ lastSync: null })
  }
}