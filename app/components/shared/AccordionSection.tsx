'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  title: string
  defaultOpen?: boolean
  headerActions?: React.ReactNode
  children: React.ReactNode
  /** Eindeutiger Key → Zustand wird in localStorage gespeichert */
  stateKey?: string
  /** Optionaler eigener Titel-Inhalt (statt Uppercase-Label), z. B. „Rolle — Name". */
  titleContent?: React.ReactNode
  className?: string
}

export function AccordionSection({ title, defaultOpen = false, headerActions, stateKey, titleContent, className = '', children }: Props) {
  const [open, setOpen] = useState(() => {
    if (stateKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`accordion_${stateKey}`)
      if (stored !== null) return stored === 'true'
    }
    return defaultOpen
  })

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (stateKey && typeof window !== 'undefined') {
      localStorage.setItem(`accordion_${stateKey}`, String(next))
    }
  }

  return (
    <div className={`rounded-xl border overflow-hidden ${className}`} style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center">
        <button
          onClick={toggle}
          aria-label={title}
          className="flex-1 flex items-center justify-between px-4 py-3 text-left min-w-0"
        >
          {titleContent
            ? <span className="min-w-0 truncate" style={{ color: 'var(--text)' }}>{titleContent}</span>
            : <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</span>}
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-muted)' }}
          />
        </button>
        {headerActions && (
          <div className="pr-3 flex items-center flex-shrink-0" onClick={e => e.stopPropagation()}>
            {headerActions}
          </div>
        )}
      </div>
      {open && <div style={{ borderTop: '1px solid var(--border)' }}>{children}</div>}
    </div>
  )
}
