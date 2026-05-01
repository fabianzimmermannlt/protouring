'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import de, { TranslationKey } from './translations/de'
import en from './translations/en'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Language = 'de' | 'en'

interface LanguageContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
}

// ─── Context ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'protouring_lang'

const translations: Record<Language, Record<string, string>> = { de, en }

const LanguageContext = createContext<LanguageContextValue>({
  language: 'de',
  setLanguage: () => {},
  t: (key) => de[key] ?? key,
})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('de')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null
    if (stored === 'de' || stored === 'en') {
      setLanguageState(stored)
    }
    setMounted(true)
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem(STORAGE_KEY, lang)
  }

  const t = (key: TranslationKey): string => {
    const dict = translations[language]
    return (dict as Record<string, string>)[key] ?? (de as Record<string, string>)[key] ?? key
  }

  // Render with 'de' on server / before hydration to avoid mismatch
  const value: LanguageContextValue = {
    language: mounted ? language : 'de',
    setLanguage,
    t,
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLanguage() {
  return useContext(LanguageContext)
}

// Convenience: just the translator
export function useT() {
  return useContext(LanguageContext).t
}
