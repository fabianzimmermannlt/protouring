'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createTermin, getVenues, TERMIN_ART, type Termin, type Venue } from '@/lib/api-client'
import { QuickCreateModal, QField, inputCls, selectCls } from '@/app/components/shared/QuickCreateModal'
import { MapPin, Loader2, Search } from 'lucide-react'

// Venue search with existing venues + Photon fallback
function VenueSearch({ onSelect }: { onSelect: (v: { id?: number; name: string; city?: string }) => void }) {
  const [query, setQuery] = useState('')
  const [existingVenues, setExistingVenues] = useState<Venue[]>([])
  const [suggestions, setSuggestions] = useState<{ id?: number; name: string; city?: string; source: 'db' | 'osm' }[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { getVenues().then(setExistingVenues).catch(() => {}) }, [])

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    const q_lower = q.toLowerCase()

    // Filter existing venues
    const dbMatches = existingVenues
      .filter(v => v.name?.toLowerCase().includes(q_lower) || v.city?.toLowerCase().includes(q_lower))
      .slice(0, 4)
      .map(v => ({ id: v.id ? parseInt(String(v.id)) : undefined, name: v.name, city: v.city, source: 'db' as const }))

    // Photon for new venues not yet in DB
    let osmMatches: typeof suggestions = []
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=4&lang=de`)
      const data = await res.json()
      osmMatches = (data.features ?? [])
        .filter((f: any) => f.properties?.name)
        .map((f: any) => ({
          name: f.properties.name,
          city: f.properties.city || f.properties.town || f.properties.village,
          source: 'osm' as const,
        }))
        .filter((o: any) => !dbMatches.some(d => d.name.toLowerCase() === o.name.toLowerCase()))
        .slice(0, 3)
    } catch {}

    const all = [...dbMatches, ...osmMatches]
    setSuggestions(all)
    setOpen(all.length > 0)
    setLoading(false)
  }, [existingVenues])

  const handleChange = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 350)
  }

  const handleSelect = (s: typeof suggestions[0]) => {
    setQuery(s.name)
    onSelect({ id: s.id, name: s.name, city: s.city })
    setOpen(false)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-gray-600 mb-1">Venue</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          placeholder="Venue suchen oder neu eingeben…"
          className={`${inputCls} pl-8`}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400 animate-spin" />}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto text-sm">
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={e => { e.preventDefault(); handleSelect(s) }}
              className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
            >
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="flex-1 text-gray-700">{s.name}{s.city ? `, ${s.city}` : ''}</span>
              {s.source === 'db'
                ? <span className="text-[10px] text-blue-500 font-medium">Gespeichert</span>
                : <span className="text-[10px] text-gray-400">Neu</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface Props {
  onClose: () => void
  onCreated: (termin: Termin) => void
}

export function QuickCreateEventModal({ onClose, onCreated }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [art, setArt] = useState('Konzert')
  const [title, setTitle] = useState('')
  const [venueId, setVenueId] = useState<number | undefined>()
  const [venueName, setVenueName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!date) { setError('Datum ist erforderlich'); return }
    setSaving(true); setError('')
    try {
      const termin = await createTermin({
        date,
        title: title.trim() || venueName || art,
        art,
        venue_id: venueId ?? null,
        status_booking: 'noch nicht bestätigt',
        status_public: 'nicht öffentlich',
      })
      onCreated(termin)
      onClose()
    } catch (e) {
      setError((e as Error).message || 'Fehler beim Anlegen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <QuickCreateModal
      title="Neues Event"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={saving}
      disabled={!date}
      error={error}
    >
      <div className="grid grid-cols-2 gap-3">
        <QField label="Datum *">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={inputCls}
            autoFocus
          />
        </QField>
        <QField label="Art">
          <select value={art} onChange={e => setArt(e.target.value)} className={selectCls}>
            {TERMIN_ART.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </QField>
      </div>

      <VenueSearch onSelect={v => { setVenueId(v.id); setVenueName(v.name) }} />

      <QField label="Titel (optional)">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder={venueName || 'z.B. Festival-Name, Tour-Leg…'}
          className={inputCls}
        />
      </QField>
      <p className="text-xs text-gray-400 -mt-2">
        Leer lassen → Titel wird aus Venue oder Art generiert
      </p>
    </QuickCreateModal>
  )
}
