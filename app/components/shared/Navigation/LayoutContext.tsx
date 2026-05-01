'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getCurrentUser } from '@/lib/api-client'

export type LayoutMode = 'L1' | 'L2' | 'L3'

const STORAGE_KEY = 'protouring_layout'

interface LayoutContextValue {
  layout: LayoutMode
  setLayout: (mode: LayoutMode) => void
}

const LayoutContext = createContext<LayoutContextValue>({
  layout: 'L1',
  setLayout: () => {},
})

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayoutState] = useState<LayoutMode>('L3')

  useEffect(() => {
    const isSuperadmin = Boolean((getCurrentUser() as any)?.isSuperadmin)
    if (!isSuperadmin) { setLayoutState('L3'); return }
    const stored = localStorage.getItem(STORAGE_KEY) as LayoutMode | null
    if (stored === 'L1' || stored === 'L2' || stored === 'L3') setLayoutState(stored)
  }, [])

  const setLayout = (mode: LayoutMode) => {
    if (!Boolean((getCurrentUser() as any)?.isSuperadmin)) return
    localStorage.setItem(STORAGE_KEY, mode)
    setLayoutState(mode)
  }

  return (
    <LayoutContext.Provider value={{ layout, setLayout }}>
      {children}
    </LayoutContext.Provider>
  )
}

export function useLayout() {
  return useContext(LayoutContext)
}
