'use client'

import { useState, useCallback, useRef } from 'react'

/**
 * Persists column order in localStorage.
 * New columns that appear in defaultOrder but not in storage are appended at the end.
 * Removed columns are silently dropped.
 */
export function useColumnOrder(storageKey: string, defaultOrder: string[]) {
  const key = `pt-col-order-${storageKey}`

  const [order, setOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return defaultOrder
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const saved = JSON.parse(raw) as string[]
        const valid = saved.filter(id => defaultOrder.includes(id))
        const added = defaultOrder.filter(id => !valid.includes(id))
        return [...valid, ...added]
      }
    } catch { /* ignore */ }
    return defaultOrder
  })

  const dragIndex = useRef<number | null>(null)

  const onDragStart = useCallback((index: number) => {
    dragIndex.current = index
  }, [])

  const onDrop = useCallback((toIndex: number) => {
    const from = dragIndex.current
    dragIndex.current = null
    if (from === null || from === toIndex) return
    setOrder(prev => {
      const next = [...prev]
      const [col] = next.splice(from, 1)
      next.splice(toIndex, 0, col)
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [key])

  const reset = useCallback(() => {
    setOrder(defaultOrder)
    try { localStorage.removeItem(key) } catch { /* ignore */ }
  }, [key, defaultOrder])

  return { order, onDragStart, onDrop, reset }
}
