'use client'

import { useState, useEffect, useRef } from 'react'
import { Settings2 } from 'lucide-react'
import type { ColumnDef } from './useColumnVisibility'

interface ColumnToggleProps {
  columns: ColumnDef[]
  isVisible: (id: string) => boolean
  toggle: (id: string) => void
}

export default function ColumnToggle({ columns, isVisible, toggle }: ColumnToggleProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Click outside schließt das Dropdown
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggleable = columns.filter(c => !c.alwaysVisible)

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Spalten ein-/ausblenden"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '1.4rem', height: '1.4rem',
          color: open ? '#6366f1' : '#9ca3af',
          background: 'none', border: 'none', cursor: 'pointer',
          borderRadius: '0.2rem',
          transition: 'color 0.15s',
        }}
      >
        <Settings2 size={13} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: '0.25rem',
          background: '#ffffff', border: '1px solid #e5e7eb',
          borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 50, minWidth: '160px', padding: '0.4rem 0',
        }}>
          <div style={{
            fontSize: '0.65rem', fontWeight: 600, color: '#9ca3af',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            padding: '0.3rem 0.75rem 0.4rem',
          }}>
            Spalten
          </div>
          {toggleable.map(col => (
            <label
              key={col.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.3rem 0.75rem', cursor: 'pointer',
                fontSize: '0.8rem', color: '#374151',
                userSelect: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <input
                type="checkbox"
                checked={isVisible(col.id)}
                onChange={() => toggle(col.id)}
                style={{ accentColor: '#6366f1', cursor: 'pointer' }}
              />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
