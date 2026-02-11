import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'

export async function GET() {
  try {
    const r = await query('SELECT 1 as ok')
    return NextResponse.json({ ok: true, db: r.recordset?.[0] || null })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'DB error' },
      { status: 500 }
    )
  }
}
