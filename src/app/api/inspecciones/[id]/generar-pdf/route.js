// src/app/api/inspecciones/[id]/generar-pdf/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { generateInspectionPDF, uploadPDFToCloudinary } from '@/lib/pdf'

export async function POST(req, context) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  try {
    const params = await context.params
    const id = Number(params?.id)
    
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ msg: 'ID inválido' }, { status: 400 })
    }

    console.log(`[generar-pdf] Iniciando generación para inspección #${id}`)

    // ────────────────────────────────────────────────────────
    // 1. Obtener datos completos de la inspección
    // ────────────────────────────────────────────────────────
    
    const inspectionResult = await query(
      `SELECT 
        i.id, i.created_at, i.updated_at,
        i.producer, i.lot, i.variety, i.caliber,
        i.packaging_code, i.packaging_type, i.packaging_date,
        i.net_weight, i.brix_avg, i.temp_water, i.temp_ambient, i.temp_pulp,
        i.notes, i.metrics,
        c.code AS commodity_code, c.name AS commodity_name,
        u.name as inspector_name
       FROM inspections i
       JOIN commodities c ON c.id = i.commodity_id
       LEFT JOIN users u ON u.id = i.created_by_user_id
       WHERE i.id = @id`,
      { id }
    )

    if (!inspectionResult.recordset?.length) {
      return NextResponse.json({ msg: 'Inspección no encontrada' }, { status: 404 })
    }

    const inspection = inspectionResult.recordset[0]

    // ────────────────────────────────────────────────────────
    // 2. Obtener fotos de la inspección
    // ────────────────────────────────────────────────────────
    
    const photosResult = await query(
      `SELECT metric_key, url
       FROM inspection_photos
       WHERE inspection_id = @id
       ORDER BY metric_key, created_at`,
      { id }
    )

    // Agrupar fotos por metric_key
    const photos = {}
    photosResult.recordset.forEach(photo => {
      if (!photos[photo.metric_key]) {
        photos[photo.metric_key] = []
      }
      photos[photo.metric_key].push(photo.url)
    })

    console.log(`[generar-pdf] Fotos encontradas: ${Object.keys(photos).length} grupos`)

    // ────────────────────────────────────────────────────────
    // 3. Generar el PDF
    // ────────────────────────────────────────────────────────
    
    console.log(`[generar-pdf] Generando PDF...`)
    const pdfBuffer = await generateInspectionPDF(inspection, photos)
    console.log(`[generar-pdf] PDF generado: ${pdfBuffer.length} bytes`)

    // ────────────────────────────────────────────────────────
    // 4. Subir a Cloudinary
    // ────────────────────────────────────────────────────────
    
    const filename = `inspeccion-${id}-${Date.now()}`
    console.log(`[generar-pdf] Subiendo a Cloudinary: ${filename}`)
    
    const { url: pdfUrl, public_id } = await uploadPDFToCloudinary(pdfBuffer, filename)
    console.log(`[generar-pdf] PDF subido: ${pdfUrl}`)

    // ────────────────────────────────────────────────────────
    // 5. Actualizar BD con la URL del PDF
    // ────────────────────────────────────────────────────────
    
    // Verificar si ya existe un registro en inspection_pdfs
    const existingPDF = await query(
      `SELECT inspection_id FROM inspection_pdfs WHERE inspection_id = @id`,
      { id }
    )

    if (existingPDF.recordset?.length > 0) {
      // UPDATE
      await query(
        `UPDATE inspection_pdfs 
         SET status = 'OK',
             pdf_url = @pdf_url,
             pdf_hash = @pdf_hash,
             updated_at = GETUTCDATE(),
             error_message = NULL
         WHERE inspection_id = @id`,
        { 
          id, 
          pdf_url: pdfUrl, 
          pdf_hash: public_id 
        }
      )
    } else {
      // INSERT
      await query(
        `INSERT INTO inspection_pdfs (inspection_id, status, pdf_url, pdf_hash, updated_at)
         VALUES (@id, 'OK', @pdf_url, @pdf_hash, GETUTCDATE())`,
        { 
          id, 
          pdf_url: pdfUrl, 
          pdf_hash: public_id 
        }
      )
    }

    console.log(`[generar-pdf] BD actualizada para inspección #${id}`)

    return NextResponse.json({ 
      ok: true, 
      id, 
      pdf_url: pdfUrl,
      msg: 'PDF generado exitosamente'
    })

  } catch (e) {
    console.error('[generar-pdf] Error:', e)
    
    // Guardar error en BD
    try {
      const params = await context.params
      const id = Number(params?.id)
      
      await query(
        `UPDATE inspection_pdfs 
         SET status = 'ERROR',
             error_message = @error,
             updated_at = GETUTCDATE()
         WHERE inspection_id = @id`,
        { id, error: e.message }
      )
    } catch (dbError) {
      console.error('[generar-pdf] Error guardando error en BD:', dbError)
    }

    return NextResponse.json({ 
      msg: 'Error generando PDF: ' + e.message 
    }, { status: 500 })
  }
}