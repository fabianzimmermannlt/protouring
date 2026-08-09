'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus, X } from 'lucide-react'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'

interface SearchableDropdownProps<T extends { id: string | number }> {
  value: T | null
  placeholder?: string
  items: T[]
  filterFn: (item: T, query: string) => boolean
  renderItem: (item: T, selected: boolean) => React.ReactNode
  renderValue: (item: T) => string
  onSelect: (item: T | null) => void
  clearable?: boolean
  createLabel?: string
  /** Öffnet ein externes Modal (z.B. VehicleFormModal) statt Inline-Formular */
  onCreateClick?: () => void
  renderCreateForm?: (
    onCreated: (item: T) => void,
    onCancel: () => void
  ) => React.ReactNode
  /** Optional: Einträge, für die das true ist, werden oben in einer eigenen Gruppe angepinnt */
  isPinned?: (item: T) => boolean
  /** Überschrift der angepinnten Gruppe (Default: "Empfehlungen") */
  pinnedLabel?: string
}

export default function SearchableDropdown<T extends { id: string | number }>({
  value,
  placeholder = 'Auswählen …',
  items,
  filterFn,
  renderItem,
  renderValue,
  onSelect,
  clearable = false,
  createLabel = 'Neu anlegen',
  onCreateClick,
  renderCreateForm,
  isPinned,
  pinnedLabel = 'Empfehlungen',
}: SearchableDropdownProps<T>) {
  const { layout } = useLayout()
  const dark = true // App fest Dark-Mode
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Menü liegt als Portal am Body (position: fixed) → keine Overflow-/Nachbar-Überlagerung,
  // und klappt nach oben, wenn unten kein Platz ist.
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; up: boolean } | null>(null)

  const MENU_MAX = 320
  const computePos = useCallback(() => {
    const el = triggerRef.current
    if (!el || typeof window === 'undefined') return
    const r = el.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    const above = r.top
    const up = below < MENU_MAX && above > below
    setPos({
      left: r.left, width: r.width, up,
      top: up ? undefined : r.bottom + 2,
      bottom: up ? window.innerHeight - r.top + 2 : undefined,
    })
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setShowCreate(false)
    setPos(null)
  }, [])

  useEffect(() => {
    if (!open) return
    computePos()
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current && ref.current.contains(t)) return
      if (menuRef.current && menuRef.current.contains(t)) return
      close()
    }
    const reflow = () => computePos()
    document.addEventListener('mousedown', handler)
    window.addEventListener('resize', reflow)
    window.addEventListener('scroll', reflow, true)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('resize', reflow)
      window.removeEventListener('scroll', reflow, true)
    }
  }, [open, close, computePos])

  useEffect(() => {
    if (open && !showCreate) inputRef.current?.focus()
  }, [open, showCreate])

  const filtered = query
    ? items.filter(item => filterFn(item, query))
    : items

  const handleSelect = (item: T) => {
    onSelect(item)
    close()
  }

  const handleCreated = (item: T) => {
    onSelect(item)
    close()
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        className="form-input"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', textAlign: 'left', width: '100%',
        }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{
          fontSize: '0.85rem',
          color: value ? (dark ? 'var(--text)' : '#111827') : 'var(--text-muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          {value ? renderValue(value) : placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          {clearable && value && (
            <span
              onClick={e => { e.stopPropagation(); onSelect(null) }}
              style={{ color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={13} style={{
            color: 'var(--text-subtle)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }} />
        </div>
      </button>

      {/* Dropdown – als Portal am Body (fixed), klappt nach oben wenn unten kein Platz ist */}
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} style={{
          position: 'fixed', left: pos.left, width: pos.width, zIndex: 1000,
          ...(pos.up ? { bottom: pos.bottom } : { top: pos.top }),
          background: dark ? '#1e1e1e' : '#fff',
          border: `1px solid ${dark ? '#3c3c3c' : '#e5e7eb'}`,
          borderRadius: 0,
          boxShadow: dark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.1)',
        }}>
          {/* Inline-Schnellerfassung */}
          {showCreate && renderCreateForm ? (
            <div style={{ padding: '0.75rem' }}>
              {renderCreateForm(handleCreated, () => setShowCreate(false))}
            </div>
          ) : (
            <>
              {/* Suche */}
              <div style={{ padding: '0.5rem', borderBottom: `1px solid ${dark ? '#3c3c3c' : '#f3f4f6'}` }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Suchen …"
                  style={{
                    width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.8rem',
                    border: `1px solid ${dark ? '#3c3c3c' : '#e5e7eb'}`,
                    borderRadius: 0, outline: 'none',
                    background: dark ? 'var(--surface)' : '#fff',
                    color: dark ? 'var(--text)' : '#111827',
                  }}
                />
              </div>

              {/* Liste */}
              <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {/* Neu anlegen */}
                {(renderCreateForm || onCreateClick) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onCreateClick) { close(); onCreateClick() }
                      else setShowCreate(true)
                    }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '0.5rem 0.65rem',
                      fontSize: '0.8rem', color: '#3b82f6', background: 'none', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                      borderBottom: `1px solid ${dark ? '#3c3c3c' : '#f3f4f6'}`,
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = dark ? '#1a3a5c' : '#eff6ff')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}
                  >
                    <Plus size={12} /> {createLabel}
                  </button>
                )}

                {/* Einträge entfernen */}
                {clearable && value && (
                  <button
                    type="button"
                    onClick={() => { onSelect(null); close() }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '0.5rem 0.65rem',
                      fontSize: '0.8rem', color: '#ef4444', background: 'none', border: 'none',
                      cursor: 'pointer', borderBottom: `1px solid ${dark ? '#3c3c3c' : '#f3f4f6'}`,
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = dark ? '#3b1010' : '#fef2f2')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}
                  >
                    Auswahl entfernen
                  </button>
                )}

                {filtered.length === 0 ? (
                  <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Keine Treffer
                  </div>
                ) : (() => {
                  const itemButton = (item: T) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '0.5rem 0.65rem',
                        background: value?.id === item.id ? (dark ? '#1a3a5c' : '#eff6ff') : 'none',
                        border: 'none', cursor: 'pointer', borderBottom: `1px solid ${dark ? 'var(--surface)' : '#f9fafb'}`,
                        display: 'block',
                      }}
                      onMouseOver={e => { if (value?.id !== item.id) e.currentTarget.style.background = dark ? 'var(--surface)' : '#f9fafb' }}
                      onMouseOut={e => { if (value?.id !== item.id) e.currentTarget.style.background = 'none' }}
                    >
                      {renderItem(item, value?.id === item.id)}
                    </button>
                  )
                  const pinned = isPinned ? filtered.filter(isPinned) : []
                  const rest = isPinned ? filtered.filter(i => !isPinned(i)) : filtered
                  const groupHeader = (label: string, gold: boolean) => (
                    <div style={{
                      padding: '0.3rem 0.65rem', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                      color: gold ? '#f5c518' : 'var(--text-muted)',
                      background: gold ? (dark ? '#242015' : '#fffbea') : (dark ? 'var(--surface-2)' : '#f9fafb'),
                      borderBottom: `1px solid ${dark ? '#3c3c3c' : '#f3f4f6'}`,
                    }}>{gold ? '★ ' : ''}{label}</div>
                  )
                  return (
                    <>
                      {pinned.length > 0 && groupHeader(pinnedLabel, true)}
                      {pinned.map(itemButton)}
                      {pinned.length > 0 && rest.length > 0 && groupHeader('Alle Hotels', false)}
                      {rest.map(itemButton)}
                    </>
                  )
                })()}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
