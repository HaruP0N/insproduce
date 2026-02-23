// src/lib/cloudinaryPDF.js
import { v2 as cloudinary } from 'cloudinary'

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

/**
 * Sube un PDF a Cloudinary
 * @param {Buffer} pdfBuffer - Buffer del PDF
 * @param {string} filename - Nombre del archivo
 * @returns {Promise<Object>} - { url, public_id }
 */
export async function uploadPDFToCloudinary(pdfBuffer, filename) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw', // Para PDFs y otros archivos no-image
        folder: 'inspections/pdfs',
        public_id: filename,
        format: 'pdf',
        invalidate: true // Invalidar cache si existe
      },
      (error, result) => {
        if (error) {
          console.error('Error uploading PDF to Cloudinary:', error)
          reject(error)
        } else {
          resolve({
            url: result.secure_url,
            public_id: result.public_id
          })
        }
      }
    )

    // Escribir el buffer al stream
    uploadStream.end(pdfBuffer)
  })
}

/**
 * Elimina un PDF de Cloudinary
 * @param {string} publicId - Public ID del archivo en Cloudinary
 */
export async function deletePDFFromCloudinary(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' })
    console.log('PDF deleted from Cloudinary:', publicId)
  } catch (error) {
    console.error('Error deleting PDF from Cloudinary:', error)
    throw error
  }
}