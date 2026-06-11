'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

// Einklappbare pt-card: ganze Titelzeile klickt auf/zu, Header-Aktionen (z.B. +/Upload)
// liegen darüber und behalten ihre Funktion (stopPropagation).
export function CollapsibleCard({
  title,
  actions,
  defaultOpen = false,
  className = '',
  children,
}: {
  title: ReactNode
  actions?: ReactNode
  defaultOpen?: boolean
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`pt-card ${className}`}>
      <div className="pt-card-header" style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <span className="pt-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {open
            ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
            : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
          {title}
        </span>
        {actions && (
          <div style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>{actions}</div>
        )}
      </div>
      {open && <div className="pt-card-body">{children}</div>}
    </div>
  )
}
