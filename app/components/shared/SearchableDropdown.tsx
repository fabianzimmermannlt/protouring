'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'

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
}: SearchableDropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setShowCreate(false)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, close])

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
          color: value ? '#111827' : '#9ca3af',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          {value ? renderValue(value) : placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          {clearable && value && (
            <span
              onClick={e => { e.stopPropagation(); onSelect(null) }}
              style={{ color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={13} style={{
            color: '#6b7280',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 100,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        }}>
          {/* Inline-Schnellerfassung */}
          {showCreate && renderCreateForm ? (
            <div style={{ padding: '0.75rem' }}>
              {renderCreateForm(handleCreated, () => setShowCreate(false))}
            </div>
          ) : (
            <>
              {/* Suche */}
              <div style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Suchen …"
                  style={{
                    width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.8rem',
                    border: '1px solid #e5e7eb', borderRadius: '4px', outline: 'none',
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
                      fontSize: '0.8rem', color: '#2563eb', background: 'none', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = '#eff6ff')}
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
                      fontSize: '0.8rem', color: '#dc2626', background: 'none', border: 'none',
                      cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = '#fef2f2')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}
                  >
                    Auswahl entfernen
                  </button>
                )}

                {filtered.length === 0 ? (
                  <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center' }}>
                    Keine Treffer
                  </div>
                ) : filtered.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '0.5rem 0.65rem',
                      background: value?.id === item.id ? '#eff6ff' : 'none',
                      border: 'none', cursor: 'pointer', borderBottom: '1px solid #f9fafb',
                      display: 'block',
                    }}
                    onMouseOver={e => { if (value?.id !== item.id) e.currentTarget.style.background = '#f9fafb' }}
                    onMouseOut={e => { if (value?.id !== item.id) e.currentTarget.style.background = 'none' }}
                  >
                    {renderItem(item, value?.id === item.id)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
