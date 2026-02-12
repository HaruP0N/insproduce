import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'

export async function POST(req, context) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  try {
    // 🔧 await params
    const params = await context.params
    const id = Number(params?.id)
    
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ msg: 'ID inválido' }, { status: 400 })
    }

    // Validar que exista
    const r = await query(`SELECT TOP 1 id FROM inspections WHERE id=@id`, { id })
    if (!r.recordset?.length) {
      return NextResponse.json({ msg: 'Inspección no encontrada' }, { status: 404 })
    }

    // 🔧 SIMULAR generación de PDF
    // En producción aquí generarías el PDF real con puppeteer, PDFKit, etc.
    // y subirías a Azure Blob Storage o similar
    
    const pdfUrl = `/pdfs/inspeccion-${id}.pdf` // URL ficticia
    const pdfHash = `hash-${Date.now()}` // Hash ficticio

    await query(
      `UPDATE inspections 
       SET pdf_url = @pdf_url,
           pdf_hash = @pdf_hash,
           updated_at = GETDATE()
       WHERE id = @id`,
      { id, pdf_url: pdfUrl, pdf_hash: pdfHash }
    )

    return NextResponse.json({ ok: true, id, pdf_url: pdfUrl })
  } catch (e) {
    console.error('[generar-pdf]', e)
    return NextResponse.json({ msg: 'Error generando PDF' }, { status: 500 })
  }
}