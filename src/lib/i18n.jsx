'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { DICT } from '@/lib/i18nDict'

const I18nCtx = createContext(null)

export function detectLang() {
  try { const s = localStorage.getItem('insp-lang'); if (s === 'es' || s === 'en') return s } catch {}
  try { return (navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es' } catch {}
  return 'es'
}

function interpolate(str, vars) {
  if (!vars) return str
  return str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m))
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState('es') // estable para SSR; se ajusta al montar
  useEffect(() => {
    const l = detectLang()
    setLangState(l)
    try { document.documentElement.lang = l } catch {}
  }, [])
  const setLang = useCallback((l) => {
    setLangState(l)
    try { localStorage.setItem('insp-lang', l) } catch {}
    try { document.documentElement.lang = l } catch {}
  }, [])
  const t = useCallback((key, vars) => {
    const entry = DICT[key]
    if (!entry) return key
    return interpolate(entry[lang] ?? entry.es ?? key, vars)
  }, [lang])
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>
}

export function useI18n() {
  const c = useContext(I18nCtx)
  if (!c) return { lang: 'es', setLang: () => {}, t: (k) => (DICT[k]?.es ?? k) }
  return c
}

// Botón compacto para alternar idioma (muestra el idioma al que cambia).
export function LangToggle({ className = 'btn btn-icon', title }) {
  const { lang, setLang } = useI18n()
  return (
    <button className={className} title={title || 'ES / EN'} onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
      style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.03em' }}>
      {lang === 'es' ? 'EN' : 'ES'}
    </button>
  )
}
