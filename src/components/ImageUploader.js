// src/components/ImageUploader.js
'use client'

import React, { useState } from 'react'
import { uploadToCloudinary, compressImage } from '@/lib/cloudinary'

export default function ImageUploader({ 
  fieldKey, 
  images = [], 
  onChange, 
  maxImages = 3,
  disabled = false 
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return

    const remaining = maxImages - images.length
    const filesToUpload = files.slice(0, remaining)

    setUploading(true)
    setError('')

    try {
      const uploadedImages = []

      for (const file of filesToUpload) {
        // Validar tamaño (máx 5MB)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} es muy pesado (máx 5MB)`)
        }

        // Validar tipo
        if (!file.type.startsWith('image/')) {
          throw new Error(`${file.name} no es una imagen`)
        }

        // Comprimir
        const compressed = await compressImage(file, 1200, 0.8)
        const compressedFile = new File([compressed], file.name, { type: 'image/jpeg' })

        // Subir a Cloudinary
        const result = await uploadToCloudinary(compressedFile, `inspections/${fieldKey}`)
        uploadedImages.push(result.url)
      }

      onChange([...images, ...uploadedImages])
    } catch (err) {
      console.error('Upload error:', err)
      setError(err.message || 'Error al subir imagen')
    } finally {
      setUploading(false)
      e.target.value = '' // Reset input
    }
  }

  const handleRemove = (index) => {
    const newImages = images.filter((_, i) => i !== index)
    onChange(newImages)
  }

  const canUploadMore = images.length < maxImages && !disabled

  return (
    <div>
      {/* Preview de imágenes */}
      {images.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {images.map((url, idx) => (
            <div key={idx} style={{ position: 'relative', width: 80, height: 80 }}>
              <img 
                src={url} 
                alt={`Foto ${idx + 1}`}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover', 
                  borderRadius: 8,
                  border: '2px solid #e5e7eb'
                }}
              />
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                disabled={disabled}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Botón de subida */}
      {canUploadMore && (
        <label style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          borderRadius: 8,
          border: '2px dashed #d1d5db',
          background: '#f9fafb',
          color: '#374151',
          fontSize: 12,
          fontWeight: 600,
          cursor: uploading ? 'not-allowed' : 'pointer',
          opacity: uploading ? 0.6 : 1,
          transition: 'all 0.15s'
        }}
        onMouseEnter={(e) => {
          if (!uploading) {
            e.currentTarget.style.borderColor = '#16a34a'
            e.currentTarget.style.background = '#f0fdf4'
            e.currentTarget.style.color = '#15803d'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#d1d5db'
          e.currentTarget.style.background = '#f9fafb'
          e.currentTarget.style.color = '#374151'
        }}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            disabled={uploading}
            style={{ display: 'none' }}
          />
          {uploading ? '⏳ Subiendo...' : `📷 Agregar foto (${images.length}/${maxImages})`}
        </label>
      )}

      {/* Error */}
      {error && (
        <div style={{ 
          marginTop: 8, 
          padding: 8, 
          background: '#fef2f2', 
          border: '1px solid #fca5a5',
          borderRadius: 6, 
          color: '#dc2626', 
          fontSize: 12 
        }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}