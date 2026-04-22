'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  title: string
  defaultOpen?: boolean
  headerActions?: React.ReactNode
  children: React.ReactNode
}

export function AccordionSection({ title, defaultOpen = false, headerActions, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex-1 flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {headerActions && (
          <div className="pr-3 flex items-center" onClick={e => e.stopPropagation()}>
            {headerActions}
          </div>
        )}
      </div>
      {open && <div className="border-t border-gray-100">{children}</div>}
    </div>
  )
}
