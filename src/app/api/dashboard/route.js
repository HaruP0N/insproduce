// src/app/api/dashboard/route.js — agregados para el panel admin (modelo qc)
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { query } from '@/lib/db/mssql'

export async function GET(req) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const summary = (await query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN r.resolution='approved' THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN r.resolution='conditional' THEN 1 ELSE 0 END) AS conditional,
         SUM(CASE WHEN r.resolution='rejected' THEN 1 ELSE 0 END) AS rejected,
         AVG(CAST(r.score AS float)) AS avg_score
       FROM qc.inspections i
       LEFT JOIN qc.inspection_results r ON r.inspection_id = i.id
       WHERE i.deleted_at IS NULL`)).recordset[0]

    const topDefects = (await query(
      `SELECT TOP 6 d.label, d.family, d.is_major, COUNT(*) AS cnt
       FROM qc.inspection_measurements m
       JOIN qc.inspections i ON i.id = m.inspection_id AND i.deleted_at IS NULL
       JOIN qc.defects d ON d.id = m.defect_id
       WHERE m.value_num > 0
       GROUP BY d.label, d.family, d.is_major
       ORDER BY cnt DESC`)).recordset

    const weekly = (await query(
      `SELECT DATEADD(week, DATEDIFF(week, 0, i.created_at), 0) AS wk,
              AVG(CAST(r.score AS float)) AS avg_score, COUNT(*) AS cnt
       FROM qc.inspections i
       LEFT JOIN qc.inspection_results r ON r.inspection_id = i.id
       WHERE i.deleted_at IS NULL
       GROUP BY DATEADD(week, DATEDIFF(week, 0, i.created_at), 0)
       ORDER BY wk`)).recordset

    return ok({ summary, topDefects, weekly })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('dashboard', e)
  }
}
