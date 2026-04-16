import { useState, useMemo } from 'react'

export type SortDir = 'asc' | 'desc'

export function useSortable<T extends Record<string, unknown>>(
  items: T[],
  initialKey: keyof T,
  initialDir: SortDir = 'asc',
) {
  const [sortKey, setSortKey] = useState<keyof T>(initialKey)
  const [sortDir, setSortDir] = useState<SortDir>(initialDir)

  const toggleSort = (key: keyof T) => {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const aStr = (av == null ? '' : String(av)).toLowerCase()
      const bStr = (bv == null ? '' : String(bv)).toLowerCase()
      const cmp = aStr.localeCompare(bStr, 'de')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [items, sortKey, sortDir])

  return { sortKey, sortDir, sorted, toggleSort }
}
