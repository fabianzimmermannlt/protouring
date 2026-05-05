'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { searchGlobal, SearchResult, SearchResultType } from '@/lib/api-client'

// ── Icons per type ────────────────────────────────────────────────────────────
const TYPE_LABEL: Record<SearchResultType, string> = {
  event:   'Event',
  contact: 'Kontakt',
  venue:   'Venue',
  partner: 'Partner',
  hotel:   'Hotel',
  vehicle: 'Fahrzeug',
}

const TYPE_COLOR: Record<SearchResultType, string> = {
  event:   'bg-blue-100 text-blue-700',
  contact: 'bg-green-100 text-green-700',
  venue:   'bg-purple-100 text-purple-700',
  partner: 'bg-orange-100 text-orange-700',
  hotel:   'bg-yellow-100 text-yellow-700',
  vehicle: 'bg-gray-100 text-gray-600',
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface GlobalTopBarProps {
  artistName?: string
  onNavigate?: (result: SearchResult) => void
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GlobalTopBar({ artistName, onNavigate }: GlobalTopBarProps) {
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<SearchResult[]>([])
  const [loading, setLoading]     = useState(false)
  const [open, setOpen]           = useState(false)
  const [focused, setFocused]     = useState<number>(-1)

  const inputRef    = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Search ─────────────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const data = await searchGlobal(q)
      setResults(data)
      setOpen(true)
      setFocused(-1)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(v), 250)
  }

  const clear = () => {
    setQuery('')
    setResults([])
    setOpen(false)
    setFocused(-1)
    inputRef.current?.focus()
  }

  // ── Keyboard navigation ────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
    if (e.key === 'Enter' && focused >= 0) { e.preventDefault(); handleSelect(results[focused]) }
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
  }

  // ── Select ─────────────────────────────────────────────────────────────────
  const handleSelect = (r: SearchResult) => {
    setOpen(false)
    setQuery('')
    setResults([])
    onNavigate?.(r)
  }

  // ── Close on outside click ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Global shortcut: Cmd/Ctrl+K ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-10 flex items-center px-3 gap-4 flex-shrink-0 z-50" style={{ backgroundColor: '#0d1117' }}>

      {/* Logo + Name */}
      <div className="flex items-center gap-2 flex-shrink-0 select-none">
        {/* Logo mark — gelb wie protouring.de */}
        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f5c518' }}>
          <span className="text-[10px] font-bold tracking-tight leading-none" style={{ color: '#0d1117' }}>PT</span>
        </div>
        <span className="text-white text-sm font-semibold tracking-tight">ProTouring</span>
        {artistName && (
          <>
            <span className="text-sm" style={{ color: '#4b5563' }}>/</span>
            <span className="text-sm truncate max-w-[160px]" style={{ color: '#f5c518' }}>{artistName}</span>
          </>
        )}
      </div>

      {/* Search */}
      <div className="flex-1 relative max-w-xl">
        <div className="relative flex items-center">
          <MagnifyingGlassIcon className="absolute left-2.5 w-3.5 h-3.5 pointer-events-none" style={{ color: '#6b7280' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (results.length > 0) setOpen(true) }}
            placeholder="Suchen… (⌘K)"
            className="w-full h-7 text-gray-100 text-xs rounded-md pl-8 pr-7 outline-none border transition-colors"
            style={{ backgroundColor: '#1c2333', borderColor: 'transparent', '--tw-placeholder-color': '#6b7280' } as React.CSSProperties}
            onFocus={e => (e.target.style.borderColor = '#f5c518')}
            onBlur={e => (e.target.style.borderColor = 'transparent')}
          />
          {loading && (
            <div className="absolute right-2.5 w-3 h-3 rounded-full animate-spin" style={{ border: '1.5px solid #f5c518', borderTopColor: 'transparent' }} />
          )}
          {!loading && query && (
            <button onClick={clear} className="absolute right-2 hover:text-white transition-colors" style={{ color: '#6b7280' }}>
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {open && results.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-[100] max-h-80 overflow-y-auto"
          >
            {results.map((r, i) => (
              <button
                key={`${r.type}-${r.id}`}
                onMouseDown={e => { e.preventDefault(); handleSelect(r) }}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors ${
                  focused === i ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${TYPE_COLOR[r.type]}`}>
                  {TYPE_LABEL[r.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 truncate font-medium">{r.label}</p>
                  {r.subtitle && (
                    <p className="text-xs text-gray-400 truncate">{r.subtitle}</p>
                  )}
                </div>
              </button>
            ))}
            {results.length === 0 && query.length >= 2 && !loading && (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">Keine Treffer für „{query}"</p>
            )}
          </div>
        )}

        {open && results.length === 0 && query.length >= 2 && !loading && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-[100]"
          >
            <p className="px-3 py-4 text-xs text-gray-400 text-center">Keine Treffer für „{query}"</p>
          </div>
        )}
      </div>
    </div>
  )
}
