'use client'

import { useEffect, useState } from 'react'

// Registriert den Service Worker (für Installierbarkeit + Offline-Fallback)
// und zeigt einen Hinweis, sobald ein neuer Stand deployt wurde – damit man
// nie mit einer veralteten (gecachten) Version weiterarbeitet.
export function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let reg: ServiceWorkerRegistration | null = null

    const watch = (r: ServiceWorkerRegistration) => {
      reg = r
      // Ein bereits wartender Worker (Tab war offen, als deployt wurde).
      if (r.waiting && navigator.serviceWorker.controller) setUpdateReady(true)
      r.addEventListener('updatefound', () => {
        const nw = r.installing
        if (!nw) return
        nw.addEventListener('statechange', () => {
          // 'installed' + vorhandener Controller = Update (kein Erst-Install).
          if (nw.state === 'installed' && navigator.serviceWorker.controller) setUpdateReady(true)
        })
      })
    }

    const register = () => {
      navigator.serviceWorker.register('/sw.js').then(watch).catch(() => {})
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register)

    // Regelmäßig / beim Zurückkehren auf neue Deploys prüfen.
    const check = () => { reg?.update().catch(() => {}) }
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    const interval = window.setInterval(check, 5 * 60 * 1000)

    return () => {
      window.removeEventListener('load', register)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
    }
  }, [])

  if (!updateReady) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10000, display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--surface)', color: 'var(--text)',
        border: '1px solid var(--border-strong)', borderRadius: 0,
        padding: '10px 12px 10px 16px', boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
        fontSize: 14, maxWidth: 'calc(100vw - 24px)',
      }}
    >
      <span>Neue Version verfügbar.</span>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 0,
          padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        Neu laden
      </button>
    </div>
  )
}
