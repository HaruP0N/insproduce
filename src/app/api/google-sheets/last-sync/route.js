// src/app/api/google-sheets/last-sync/route.js
import { NextResponse } from 'next/server'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { query } from '@/lib/db/mssql'

export async function GET(req) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok || !v.user || v.user.role !== 'admin')
    return NextResponse.json({ msg: 'No autorizado' }, { status: 403 })

  try {
    const r = await query(
      `SELECT setting_value FROM qc.app_settings WHERE setting_key='gsheets_last_sync'`)
    return NextResponse.json({ lastSync: r.recordset?.[0]?.setting_value || null })
  } catch (e) {
    console.error('[last-sync]', e)
    return NextResponse.json({ lastSync: null })
  }
}
