'use client'

import { useEffect } from 'react'

// Gemeinsame Registry ungespeicherter Bereiche. Mehrere Karten (Veranstaltung,
// Venue, …) können gleichzeitig „dirty" sein, ohne sich am einen globalen Flag
// (window.__pt_isDirty / __pt_save) zu überschreiben. Der L2-Nav-Guard (Popup)
// und der beforeunload-Handler werten window.__pt_isDirty aus.
type SaveFn = () => Promise<boolean> | boolean | void | Promise<void>
type Source = { dirty: boolean; save?: SaveFn }

const sources = new Map<string, Source>()

function anyDirty(): boolean {
  let dirty = false
  sources.forEach(s => { if (s.dirty) dirty = true })
  return dirty
}

function sync() {
  if (typeof window === 'undefined') return
  const w = window as unknown as { __pt_isDirty?: boolean; __pt_save?: (() => Promise<boolean>) | null }
  w.__pt_isDirty = anyDirty()
  // Speichert alle offenen, ungespeicherten Bereiche der Reihe nach. Bricht ab,
  // wenn ein Bereich explizit false liefert (Speichern fehlgeschlagen).
  w.__pt_save = async (): Promise<boolean> => {
    const list = Array.from(sources.values())
    for (let i = 0; i < list.length; i++) {
      const s = list[i]
      if (s.dirty && s.save) {
        const ok = await s.save()
        if (ok === false) return false
      }
    }
    return true
  }
}

// Einmalig pro Tab: Browser-Schließen/Neuladen warnen, solange etwas offen ist.
if (typeof window !== 'undefined' && !(window as unknown as { __pt_beforeunloadHooked?: boolean }).__pt_beforeunloadHooked) {
  ;(window as unknown as { __pt_beforeunloadHooked?: boolean }).__pt_beforeunloadHooked = true
  window.addEventListener('beforeunload', (e: BeforeUnloadEvent) => {
    if (anyDirty()) { e.preventDefault(); e.returnValue = '' }
  })
}

export function setDirtySource(key: string, dirty: boolean, save?: SaveFn) {
  sources.set(key, { dirty, save })
  sync()
}

export function clearDirtySource(key: string) {
  sources.delete(key)
  sync()
}

/**
 * Meldet ungespeicherte Änderungen eines Bereichs an den globalen Nav-Guard
 * (Popup „Ungespeicherte Änderungen") und an beforeunload. `save` wird beim
 * „Speichern"-Klick des Popups aufgerufen (sollte true/false liefern).
 */
export function useDirtyGuard(key: string, dirty: boolean, save?: SaveFn) {
  // Jeder Render: aktuellen dirty-Stand + frische save-Closure eintragen.
  useEffect(() => { setDirtySource(key, dirty, save) })
  // Unmount: Bereich aus der Registry nehmen (sonst bliebe er „dirty").
  useEffect(() => () => clearDirtySource(key), [key])
}
