'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

// pt-card, die NUR auf dem Handy einklappbar ist. Am Desktop (md+) verhält sie sich
// wie eine normale pt-card: immer offen, kein Chevron, kein Einklappen.
// Umsetzung rein per CSS (md:-Breakpoints), damit es ohne JS-Mobil-Erkennung sicher greift.
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
      <div
        className="pt-card-header cursor-pointer md:cursor-default"
        onClick={() => setOpen(o => !o)}
      >
        <span className="pt-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {/* Chevron nur mobil */}
          <span className="md:hidden inline-flex items-center">
            {open
              ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
              : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
          </span>
          {title}
        </span>
        {actions && (
          <div style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>{actions}</div>
        )}
      </div>
      {/* Body: am Desktop immer sichtbar (md:block); mobil ausgeblendet wenn zugeklappt */}
      <div className={`pt-card-body ${open ? '' : 'hidden md:block'}`}>
        {children}
      </div>
    </div>
  )
}
