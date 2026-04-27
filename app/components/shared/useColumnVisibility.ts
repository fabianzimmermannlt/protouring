import { useState } from 'react'

export interface ColumnDef {
  id: string
  label: string
  defaultVisible?: boolean  // default: true
  alwaysVisible?: boolean   // nicht togglebar (z.B. Name-Spalte)
}

export function useColumnVisibility(storageKey: string, columns: ColumnDef[]) {
  const [visible, setVisible] = useState<Set<string>>(() => {
    const defaults = new Set(
      columns.filter(c => c.defaultVisible !== false).map(c => c.id)
    )
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`col-vis:${storageKey}`)
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
  })

  const toggle = (id: string) => {
    setVisible(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(`col-vis:${storageKey}`, JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }

  const isVisible = (id: string) => visible.has(id)

  return { isVisible, toggle, columns }
}
