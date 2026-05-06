'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Eye, X, ChevronDown } from 'lucide-react'
import { searchGlobal, SearchResult, SearchResultType, getRealTenantRole, getPreviewRole, setPreviewRole, ROLE_LABELS } from '@/lib/api-client'

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

const ROLE_ORDER = ['admin', 'agency', 'tourmanagement', 'artist', 'crew_plus', 'crew', 'guest']

// ── Props ─────────────────────────────────────────────────────────────────────
interface GlobalTopBarProps {
  artistName?: string
  onNavigate?: (result: SearchResult) => void
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GlobalTopBar({ artistName, onNavigate }: GlobalTopBarProps) {
  // ── Search state ────────────────────────────────────────────────────────────
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<SearchResult[]>([])
  const [loading, setLoading]     = useState(false)
  const [open, setOpen]           = useState(false)
  const [focused, setFocused]     = useState<number>(-1)
  const [searchError, setSearchError] = useState<string | null>(null)

  const inputRef      = useRef<HTMLInputElement>(null)
  const dropdownRef   = useRef<HTMLDivElement>(null)
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)

  // ── Preview state ───────────────────────────────────────────────────────────
  const [previewRole, setPreviewRoleState] = useState<string | null>(null)
  const [realRole, setRealRole]            = useState<string | null>(null)
  const [previewOpen, setPreviewOpen]      = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPreviewRoleState(getPreviewRole())
    setRealRole(getRealTenantRole())
  }, [])

  const realRoleIndex = realRole ? ROLE_ORDER.indexOf(realRole) : -1
  const canPreview = realRoleIndex >= 0 && realRoleIndex <= 2
  const availableRoles = canPreview ? ROLE_ORDER.slice(realRoleIndex) : []

  const activatePreview = (role: string) => {
    setPreviewRole(role)
    setPreviewRoleState(role)
    setPreviewOpen(false)
    window.location.reload()
  }

  const deactivatePreview = () => {
    setPreviewRole(null)
    setPreviewRoleState(null)
    window.location.reload()
  }

  // Close preview dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (previewRef.current && !previewRef.current.contains(e.target as Node)) setPreviewOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Search logic ────────────────────────────────────────────────────────────
  const updateDropdownPos = useCallback(() => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [])

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    setSearchError(null)
    try {
      const data = await searchGlobal(q)
      setResults(data)
      updateDropdownPos()
      setOpen(true)
      setFocused(-1)
    } catch (err) {
      setResults([])
      setSearchError(err instanceof Error ? err.message : 'Fehler')
      setOpen(true)
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return }
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
  }

  const handleSelect = (r: SearchResult) => {
    setOpen(false)
    setQuery('')
    setResults([])
    onNavigate?.(r)
  }

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
    <div
      className="h-10 flex-shrink-0 relative flex items-center px-3 z-50"
      style={{ backgroundColor: previewRole ? '#b45309' : '#0d1117' }}
    >
      {/* ── LEFT: Logo + Name ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-shrink-0 select-none">
        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f5c518' }}>
          <span className="text-[10px] font-bold tracking-tight leading-none" style={{ color: '#0d1117' }}>PT</span>
        </div>
        <span className="text-white text-sm font-semibold tracking-tight">ProTouring</span>
        {artistName && (
          <>
            <span className="text-sm" style={{ color: '#4b5563' }}>/</span>
            <span className="text-sm truncate max-w-[140px]" style={{ color: '#f5c518' }}>{artistName}</span>
          </>
        )}
      </div>

      {/* ── CENTER: Search (absolute centered) ────────────────────────────── */}
      <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-sm px-2">
        <form onSubmit={async e => {
          e.preventDefault()
          if (results.length > 0) {
            handleSelect(results[focused >= 0 ? focused : 0])
          } else if (query.trim().length >= 2) {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            const data = await searchGlobal(query.trim())
            if (data.length > 0) handleSelect(data[0])
          }
        }}>
          <div className="relative flex items-center">
            <MagnifyingGlassIcon className="absolute left-2.5 w-3.5 h-3.5 pointer-events-none" style={{ color: '#9ca3af' }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (results.length > 0) { updateDropdownPos(); setOpen(true) } }}
              placeholder="Suchen… (⌘K)"
              className="w-full h-7 text-gray-100 text-xs rounded-md pl-8 pr-7 outline-none transition-all"
              style={{
                backgroundColor: '#2d333b',
                border: '1px solid #444c56',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
              }}
              onFocusCapture={e => {
                e.currentTarget.style.borderColor = '#f5c518'
                e.currentTarget.style.backgroundColor = '#343d4a'
              }}
              onBlurCapture={e => {
                e.currentTarget.style.borderColor = '#444c56'
                e.currentTarget.style.backgroundColor = '#2d333b'
              }}
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
        </form>

        {/* Dropdown (fixed position) */}
        {open && (results.length > 0 || (query.length >= 2 && !loading)) && dropdownPos && (
          <div
            ref={dropdownRef}
            style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
            className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden max-h-80 overflow-y-auto"
          >
            {results.length > 0
              ? results.map((r, i) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    onMouseDown={e => { e.preventDefault(); handleSelect(r) }}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors ${focused === i ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${TYPE_COLOR[r.type]}`}>
                      {TYPE_LABEL[r.type]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-800 truncate font-medium">{r.label}</p>
                      {r.subtitle && <p className="text-xs text-gray-400 truncate">{r.subtitle}</p>}
                    </div>
                  </button>
                ))
              : <p className="px-3 py-4 text-xs text-gray-400 text-center">
                  {searchError ? 'Suche nicht verfügbar' : `Keine Treffer für „${query}"`}
                </p>
            }
          </div>
        )}
      </div>

      {/* ── RIGHT: Preview Button ──────────────────────────────────────────── */}
      <div className="ml-auto flex-shrink-0 flex items-center gap-2">
        {canPreview && (
          <div ref={previewRef} className="relative">
            {previewRole ? (
              /* Active: zeigt welche Rolle aktiv ist + Beenden-Button */
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#fde68a' }}>
                  <Eye size={12} />
                  {(ROLE_LABELS as Record<string, string>)[previewRole] ?? previewRole}
                </span>
                <button
                  onClick={deactivatePreview}
                  title="Vorschau beenden"
                  className="flex items-center gap-0.5 text-xs rounded px-1.5 py-0.5 font-medium transition-colors"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                >
                  <X size={11} /> Beenden
                </button>
              </div>
            ) : (
              /* Inactive: Vorschau-Toggle */
              <>
                <button
                  onClick={() => setPreviewOpen(v => !v)}
                  title="Seite als andere Rolle anzeigen"
                  className="flex items-center gap-1 text-xs rounded px-2 py-1 transition-colors"
                  style={{
                    color: previewOpen ? '#f5c518' : '#9ca3af',
                    background: previewOpen ? 'rgba(245,197,24,0.12)' : 'transparent',
                    border: '1px solid',
                    borderColor: previewOpen ? '#f5c518' : '#374151',
                  }}
                  onMouseEnter={e => {
                    if (!previewOpen) {
                      e.currentTarget.style.color = '#d1d5db'
                      e.currentTarget.style.borderColor = '#4b5563'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!previewOpen) {
                      e.currentTarget.style.color = '#9ca3af'
                      e.currentTarget.style.borderColor = '#374151'
                    }
                  }}
                >
                  <Eye size={12} />
                  Vorschau
                  <ChevronDown size={11} className={`transition-transform ${previewOpen ? 'rotate-180' : ''}`} />
                </button>

                {previewOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] overflow-hidden"
                    style={{ minWidth: '160px' }}
                  >
                    <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      Ansicht als…
                    </div>
                    {availableRoles.map(role => (
                      <button
                        key={role}
                        onClick={() => activatePreview(role)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        {(ROLE_LABELS as Record<string, string>)[role]}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
