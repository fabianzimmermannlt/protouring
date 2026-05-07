'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import de, { TranslationKey } from './translations/de'
import en from './translations/en'
import { getCurrentUser, getUiLanguage, setUiLanguage, isAuthenticated, updateCurrentUserLanguage } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Language = 'de' | 'en'

interface LanguageContextValue {
  language: Language
  setLanguage: (lang: Language) => Promise<void>
  t: (key: TranslationKey) => string
}

// ─── Context ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'protouring_lang'

const translations: Record<Language, Record<string, string>> = { de, en }

const LanguageContext = createContext<LanguageContextValue>({
  language: 'de',
  setLanguage: async () => {},
  t: (key) => de[key] ?? key,
})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('de')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    async function initLanguage() {
      // 1. Sofort localStorage lesen → kein Flash
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null
      if (stored === 'de' || stored === 'en') {
        setLanguageState(stored)
      }

      // 2. Login-Response hat uiLanguage bereits → kein extra API-Call nötig
      const currentUser = getCurrentUser() as any
      if (currentUser?.uiLanguage === 'de' || currentUser?.uiLanguage === 'en') {
        const lang = currentUser.uiLanguage as Language
        setLanguageState(lang)
        localStorage.setItem(STORAGE_KEY, lang)
        setMounted(true)
        return
      }

      // 3. Fallback: API abfragen (z.B. nach Page-Reload ohne Re-Login)
      if (isAuthenticated()) {
        try {
          const lang = await getUiLanguage()
          setLanguageState(lang)
          localStorage.setItem(STORAGE_KEY, lang)
        } catch {
          // localStorage-Wert bleibt aktiv
        }
      }

      setMounted(true)
    }

    initLanguage()
  }, [])

  // Sprache ändern: localStorage + DB synchron halten
  const setLanguage = async (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem(STORAGE_KEY, lang)
    updateCurrentUserLanguage(lang)   // User-Cache in localStorage aktuell halten
    if (isAuthenticated()) {
      try {
        await setUiLanguage(lang)
      } catch {
        // UI aktualisiert sich trotzdem — DB-Sync im Hintergrund
      }
    }
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
