import { useState } from 'react'

export interface ColumnDef {
  id: string
  label: string
  defaultVisible?: boolean  // default: true
  alwaysVisible?: boolean   // nicht togglebar (z.B. Name-Spalte)
}

export function useColumnVisibility(storageKey: string, columns: ColumnDef[]) {
  const [visible, setVisible] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`col-vis:${storageKey}`)
        if (stored) return new Set(JSON.parse(stored) as string[])
      } catch {}
    }
    return new Set(
      columns
        .filter(c => c.defaultVisible !== false)
        .map(c => c.id)
    )
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
