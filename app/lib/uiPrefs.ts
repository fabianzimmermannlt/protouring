'use client'

// Anzeige-Einstellungen (Spalten ein/aus, Name/Spezifikation-Häkchen …) pro Nutzer
// serverseitig speichern – getrennt nach Surface: Desktop-Geräte teilen sich einen
// Satz, Mobilgeräte einen eigenen. localStorage bleibt der schnelle, synchrone
// Zwischenspeicher; der Server ist die Sync-Schicht über Geräte hinweg.

import { getUiPrefs, saveUiPrefs, type UiSurface } from '@/lib/api-client'

const MOBILE_MAX = 767 // gleiche Grenze wie Tailwinds `md`

export function currentSurface(): UiSurface {
  if (typeof window === 'undefined') return 'desktop'
  return window.innerWidth <= MOBILE_MAX ? 'mobile' : 'desktop'
}

// Nur die Keys, die tatsächlich über recordUiPref geschrieben wurden, werden
// synchronisiert. mem hält den aktuellen Stand der zu speichernden Keys.
let mem: Record<string, string> = {}
let saveTimer: ReturnType<typeof setTimeout> | null = null
let hydrated = false

/** Beim Login/App-Start: Server-Präferenzen des aktuellen Surface in localStorage spiegeln. */
export async function hydrateUiPrefs(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const prefs = await getUiPrefs()
    const serverData = prefs[currentSurface()] || {}
    // Bestehende Spalten-Konfiguration dieses Geräts einsammeln (Basis, falls der
    // Server sie noch nicht kennt – z.B. beim allerersten Sync).
    const local: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('col-vis:')) { const v = localStorage.getItem(k); if (v != null) local[k] = v }
    }
    // Server gewinnt bei Konflikt; lokale Keys ergänzen nur fehlende.
    mem = { ...local, ...serverData }
    for (const [k, v] of Object.entries(serverData)) {
      try { localStorage.setItem(k, v) } catch { /* ignore */ }
    }
    hydrated = true
    window.dispatchEvent(new Event('ui-prefs-hydrated'))
    // War der Server unvollständig (neue lokale Keys)? Einmal vollständig hochsichern.
    if (Object.keys(mem).length > Object.keys(serverData).length) {
      saveUiPrefs(currentSurface(), mem).catch(() => { /* später erneut */ })
    }
  } catch { /* offline/nicht eingeloggt → localStorage-Standard bleibt */ }
}

/** Eine Anzeige-Einstellung merken + (debounced) an den Account synchronisieren. */
export function recordUiPref(key: string, value: string): void {
  if (typeof window === 'undefined') return
  mem[key] = value
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    // Vor dem ersten Hydrate nicht speichern (sonst überschreiben wir Server-Daten
    // mit dem lokalen Ausgangszustand, bevor wir sie geladen haben).
    if (!hydrated) return
    saveUiPrefs(currentSurface(), mem).catch(() => { /* später erneut beim nächsten Change */ })
  }, 800)
}
