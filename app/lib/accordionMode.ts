'use client'

// Öffnungsverhalten der Akkordeons: „combined" = mehrere gleichzeitig offen
// (Standard, jedes merkt sich seinen Zustand), „exclusive" = immer nur eins offen.
// Zwei Scopes: „device" nur auf diesem Gerät (localStorage), „account" für den
// angemeldeten User geräteübergreifend (über die bestehende uiPrefs-Sync-Schicht).

import { getUiPrefs } from '@/lib/api-client'
import { currentSurface, recordUiPref } from '@/app/lib/uiPrefs'
import { useEffect, useState } from 'react'

export type AccordionMode = 'combined' | 'exclusive'
export type AccordionScope = 'device' | 'account'

const MODE_KEY = 'pt_accordion_mode'      // synchron lesbarer Effektivwert (localStorage)
const SCOPE_KEY = 'pt_accordion_scope'    // Scope-Wahl dieses Geräts
const SERVER_KEY = 'accordion_mode'       // Schlüssel in den Account-uiPrefs

/** Modus hat sich geändert (detail: AccordionMode). */
export const ACCORDION_MODE_EVENT = 'pt:accordion-mode'
/** Ein Akkordeon wurde geöffnet (detail: { group, id }) – für den Exklusiv-Modus. */
export const ACCORDION_OPEN_EVENT = 'pt:accordion-open'

export function getAccordionMode(): AccordionMode {
  if (typeof window === 'undefined') return 'combined'
  try { return localStorage.getItem(MODE_KEY) === 'exclusive' ? 'exclusive' : 'combined' } catch { return 'combined' }
}

export function getAccordionScope(): AccordionScope {
  if (typeof window === 'undefined') return 'device'
  try { return localStorage.getItem(SCOPE_KEY) === 'account' ? 'account' : 'device' } catch { return 'device' }
}

export function setAccordionMode(mode: AccordionMode, scope: AccordionScope): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(MODE_KEY, mode); localStorage.setItem(SCOPE_KEY, scope) } catch { /* ignore */ }
  // Nur bei Account-Scope an den User synchronisieren (geräteübergreifend).
  if (scope === 'account') recordUiPref(SERVER_KEY, mode)
  window.dispatchEvent(new CustomEvent(ACCORDION_MODE_EVENT, { detail: mode }))
}

/** App-Start: bei Account-Scope den serverseitig gemerkten Modus übernehmen. */
export async function initAccordionMode(): Promise<void> {
  if (typeof window === 'undefined') return
  if (getAccordionScope() !== 'account') return   // Gerät-Scope: lokaler Wert gilt
  try {
    const prefs = await getUiPrefs()
    const v = prefs[currentSurface()]?.[SERVER_KEY]
    if (v === 'exclusive' || v === 'combined') {
      try { localStorage.setItem(MODE_KEY, v) } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent(ACCORDION_MODE_EVENT, { detail: v }))
    }
  } catch { /* offline/nicht eingeloggt → lokaler Wert bleibt */ }
}

/** Hook für die Einstellungs-UI. */
export function useAccordionPref() {
  const [mode, setMode] = useState<AccordionMode>('combined')
  const [scope, setScope] = useState<AccordionScope>('device')
  useEffect(() => { setMode(getAccordionMode()); setScope(getAccordionScope()) }, [])
  const update = (m: AccordionMode, s: AccordionScope) => { setAccordionMode(m, s); setMode(m); setScope(s) }
  return { mode, scope, update }
}
