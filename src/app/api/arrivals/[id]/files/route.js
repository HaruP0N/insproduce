// Archivos del arribo (PDFs de lectores de temperatura, etc.) — multipart, van a Cloudinary.
import { requireAuth } from '@/lib/auth/requireAuth'
import { ok, fail, serverError } from '@/lib/http'
import { addArrivalFile, deleteArrivalFile } from '@/lib/repos/arrivals'
import { uploadPDFToCloudinary } from '@/lib/pdf'

const MAX_BYTES = 4 * 1024 * 1024 // límite de body en Vercel: ~4.5MB

export async function POST(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const { id } = await context.params
    const nid = Number(id)
    if (!Number.isInteger(nid) || nid <= 0) return fail(400, 'ID inválido')
    const form = await req.formData()
    const file = form.get('file')
    if (!file || typeof file.arrayBuffer !== 'function') return fail(400, 'file requerido (multipart)')
    if (file.size > MAX_BYTES) return fail(413, 'Archivo supera 4 MB')
    const buffer = Buffer.from(await file.arrayBuffer())
    const safe = String(file.name || 'archivo').replace(/[^\w.-]+/g, '_').slice(0, 80)
    const { url, public_id } = await uploadPDFToCloudinary(buffer, `arrival-${nid}-${Date.now()}-${safe.replace(/\.pdf$/i, '')}`)
    const fileId = await addArrivalFile(nid, {
      file_name: file.name || safe, description: form.get('description') || null, url, public_id,
    }, auth.user.id)
    return ok({ ok: true, id: fileId, url })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('arrivals/:id/files POST', e)
  }
}

export async function DELETE(req, context) {
  const auth = requireAuth(req, { role: 'admin' })
  if (auth.response) return auth.response
  try {
    const { id } = await context.params
    const nid = Number(id)
    const fileId = Number(new URL(req.url).searchParams.get('file_id'))
    if (!Number.isInteger(nid) || !Number.isInteger(fileId)) return fail(400, 'IDs inválidos')
    await deleteArrivalFile(nid, fileId)
    return ok({ ok: true })
  } catch (e) {
    if (e.status) return fail(e.status, e.message)
    return serverError('arrivals/:id/files DELETE', e)
  }
}
