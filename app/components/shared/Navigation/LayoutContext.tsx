'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getEffectiveRole } from '@/lib/api-client'

export type LayoutMode = 'L1' | 'L2'

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
  const [layout, setLayoutState] = useState<LayoutMode>('L1')

  useEffect(() => {
    const role = getEffectiveRole()
    if (role !== 'admin') return
    const stored = localStorage.getItem(STORAGE_KEY) as LayoutMode | null
    if (stored === 'L2') setLayoutState('L2')
  }, [])

  const setLayout = (mode: LayoutMode) => {
    const role = getEffectiveRole()
    if (role !== 'admin') return
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
