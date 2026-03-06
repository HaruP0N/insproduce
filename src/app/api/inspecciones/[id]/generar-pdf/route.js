// src/app/api/inspecciones/[id]/generar-pdf/route.js
import { NextResponse } from 'next/server'
import { query } from '@/lib/db/mssql'
import { verifyTokenFromCookies } from '@/lib/auth/verifyToken'
import { generateInspectionPDF, uploadPDFToCloudinary } from '@/lib/pdf'

function safeJson(v) {
  if (!v) return {}
  try { return typeof v === 'string' ? JSON.parse(v) : v }
  catch { return {} }
}

export async function POST(req, context) {
  const v = verifyTokenFromCookies(req)
  if (!v.ok) return NextResponse.json({ msg: v.msg }, { status: v.status })

  try {
    const params = await context.params
    const id = Number(params?.id)

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ msg: 'ID inválido' }, { status: 400 })
    }


    // ────────────────────────────────────────────────────────
    // 1. Obtener datos completos de la inspección
    // ────────────────────────────────────────────────────────
    const inspectionResult = await query(
      `SELECT
        i.id, i.created_at, i.updated_at,
        i.producer, i.lot, i.variety, i.caliber,
        i.packaging_code, i.packaging_type, i.packaging_date,
        i.net_weight,
        i.brix_avg, i.brix_min, i.brix_max, i.brix_moda,
        i.temp_water, i.temp_ambient, i.temp_pulp,
        i.diameter_min, i.diameter_max,
        i.notes, i.metrics,
        i.header_photos,
        c.code AS commodity_code, c.name AS commodity_name,
        u.name AS inspector_name
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
    // 2. Fotos de métricas (inspection_photos)
    // ────────────────────────────────────────────────────────
    const photosResult = await query(
      `SELECT metric_key, url
       FROM inspection_photos
       WHERE inspection_id = @id
       ORDER BY metric_key, created_at`,
      { id }
    )

    const metricPhotos = {}
    photosResult.recordset.forEach(photo => {
      if (!metricPhotos[photo.metric_key]) metricPhotos[photo.metric_key] = []
      metricPhotos[photo.metric_key].push(photo.url)
    })

    // ────────────────────────────────────────────────────────
    // 3. Fotos de cabecera (header_photos JSON)
    // ────────────────────────────────────────────────────────
    const headerPhotosRaw = safeJson(inspection.header_photos)

    // Combinar: prefijo "header." para distinguirlas en el PDF
    const photos = { ...metricPhotos }
    Object.entries(headerPhotosRaw).forEach(([key, urls]) => {
      if (urls?.length) photos[`header.${key}`] = urls
    })


    // ────────────────────────────────────────────────────────
    // 4. Generar el PDF
    // ────────────────────────────────────────────────────────
    const pdfBuffer = await generateInspectionPDF(inspection, photos)

    // ────────────────────────────────────────────────────────
    // 5. Subir a Cloudinary
    // ────────────────────────────────────────────────────────
    const filename = `inspeccion-${id}-${Date.now()}`
    const { url: pdfUrl, public_id } = await uploadPDFToCloudinary(pdfBuffer, filename)

    // ────────────────────────────────────────────────────────
    // 6. Actualizar BD
    // ────────────────────────────────────────────────────────
    const existingPDF = await query(
      `SELECT inspection_id FROM inspection_pdfs WHERE inspection_id = @id`,
      { id }
    )

    if (existingPDF.recordset?.length > 0) {
      await query(
        `UPDATE inspection_pdfs
         SET status = 'OK', pdf_url = @pdf_url, pdf_hash = @pdf_hash,
             updated_at = GETUTCDATE(), error_message = NULL
         WHERE inspection_id = @id`,
        { id, pdf_url: pdfUrl, pdf_hash: public_id }
      )
    } else {
      await query(
        `INSERT INTO inspection_pdfs (inspection_id, status, pdf_url, pdf_hash, updated_at)
         VALUES (@id, 'OK', @pdf_url, @pdf_hash, GETUTCDATE())`,
        { id, pdf_url: pdfUrl, pdf_hash: public_id }
      )
    }


    return NextResponse.json({ ok: true, id, pdf_url: pdfUrl, msg: 'PDF generado exitosamente' })

  } catch (e) {
    console.error('[generar-pdf] Error:', e)
    try {
      const params = await context.params
      const id = Number(params?.id)
      await query(
        `UPDATE inspection_pdfs
         SET status = 'ERROR', error_message = @error, updated_at = GETUTCDATE()
         WHERE inspection_id = @id`,
        { id, error: e.message }
      )
    } catch (dbError) {
      console.error('[generar-pdf] Error guardando error en BD:', dbError)
    }
    return NextResponse.json({ msg: 'Error generando PDF: ' + e.message }, { status: 500 })
  }
}