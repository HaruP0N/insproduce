// src/lib/security/photoUrls.js
//
// Allowlist de dominios para las URLs de fotos. Evita SSRF: las URLs llegan
// desde el cliente y luego el servidor las descarga (generación de PDF), por
// lo que solo se permiten orígenes https de confianza (Cloudinary).
//
// Ampliar ALLOWED_HOSTS si la cuenta usa un dominio/CDN propio.
const ALLOWED_HOSTS = ['res.cloudinary.com']

export function isAllowedPhotoUrl(u) {
  try {
    const url = new URL(u)
    return url.protocol === 'https:' && ALLOWED_HOSTS.includes(url.hostname)
  } catch {
    return false
  }
}
