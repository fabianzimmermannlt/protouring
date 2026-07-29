'use client'

import { useEffect } from 'react'

// Registriert den Service Worker (für Installierbarkeit + Offline-Fallback).
// Läuft nur im Browser, nach 'load', Fehler werden bewusst geschluckt.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const register = () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) }
    if (document.readyState === 'complete') { register(); return }
    window.addEventListener('load', register)
    return () => window.removeEventListener('load', register)
  }, [])
  return null
}
