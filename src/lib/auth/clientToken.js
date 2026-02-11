export function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') || ''
}

export function setToken(token) {
  if (typeof window === 'undefined') return
  localStorage.setItem('token', token)
}

export function clearToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('token')
}