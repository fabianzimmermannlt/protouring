import { useState, useEffect } from 'react'
import { recordUiPref } from '@/app/lib/uiPrefs'

export interface ColumnDef {
  id: string
  label: string
  defaultVisible?: boolean  // default: true
  alwaysVisible?: boolean   // nicht togglebar (z.B. Name-Spalte)
}

export function useColumnVisibility(storageKey: string, columns: ColumnDef[]) {
  const lsKey = `col-vis:${storageKey}`

  const compute = (): Set<string> => {
    const defaults = new Set(
      columns.filter(c => c.defaultVisible !== false).map(c => c.id)
    )
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(lsKey)
        if (stored) {
          const ids = JSON.parse(stored) as string[]
          const knownIds = new Set(columns.map(c => c.id))
          // Nur übernehmen wenn mindestens eine ID zur aktuellen Definition passt
          if (ids.some(id => knownIds.has(id))) {
            const result = new Set(ids.filter(id => knownIds.has(id)))
            // alwaysVisible Spalten immer einschließen
            columns.filter(c => c.alwaysVisible).forEach(c => result.add(c.id))
            return result
          }
        }
      } catch {}
    }
    return defaults
  }

  const [visible, setVisible] = useState<Set<string>>(compute)

  // Nach dem Login/Hydrate (Server-Präferenzen → localStorage) neu einlesen,
  // damit der Account-Stand auch ohne Reload greift.
  useEffect(() => {
    const onHydrated = () => setVisible(compute())
    window.addEventListener('ui-prefs-hydrated', onHydrated)
    return () => window.removeEventListener('ui-prefs-hydrated', onHydrated)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lsKey])

  const toggle = (id: string) => {
    setVisible(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      const serialized = JSON.stringify(Array.from(next))
      try { localStorage.setItem(lsKey, serialized) } catch {}
      recordUiPref(lsKey, serialized)   // an den Account synchronisieren
      return next
    })
  }

  const isVisible = (id: string) => visible.has(id)

  return { isVisible, toggle, columns }
}
