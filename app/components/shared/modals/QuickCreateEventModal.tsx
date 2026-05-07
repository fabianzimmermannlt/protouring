'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createTermin, createVenue, getVenues, TERMIN_ART, type Termin, type Venue } from '@/lib/api-client'
import { QuickCreateModal, QField, inputCls, selectCls } from '@/app/components/shared/QuickCreateModal'
import { MapPin, Loader2, Search } from 'lucide-react'
import { buildPhotonUrl } from '@/lib/photon'

interface VenueSuggestion {
  id?: number
  name: string
  city?: string
  street?: string
  postalCode?: string
  state?: string
  country?: string
  lat?: string
  lon?: string
  source: 'db' | 'osm'
}

// Venue search with existing venues + Photon fallback
function VenueSearch({ onSelect }: { onSelect: (v: VenueSuggestion) => void }) {
  const [query, setQuery] = useState('')
  const [existingVenues, setExistingVenues] = useState<Venue[]>([])
  const [suggestions, setSuggestions] = useState<VenueSuggestion[]>([])
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
    let osmMatches: VenueSuggestion[] = []
    try {
      const res = await fetch(buildPhotonUrl(q, 4))
      const data = await res.json()
      osmMatches = (data.features ?? [])
        .filter((f: any) => f.properties?.name)
        .map((f: any) => {
          const p = f.properties
          const housenumber = p.housenumber ? ` ${p.housenumber}` : ''
          return {
            name: p.name,
            city: p.city || p.town || p.village || '',
            street: p.street ? `${p.street}${housenumber}` : '',
            postalCode: p.postcode || '',
            state: p.state || '',
            country: p.country || '',
            lat: f.geometry?.coordinates?.[1] != null ? String(f.geometry.coordinates[1]) : '',
            lon: f.geometry?.coordinates?.[0] != null ? String(f.geometry.coordinates[0]) : '',
            source: 'osm' as const,
          }
        })
        .filter((o: VenueSuggestion) => !dbMatches.some(d => d.name.toLowerCase() === o.name.toLowerCase()))
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
    onSelect(s)
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
  const [venueData, setVenueData] = useState<VenueSuggestion | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!date) { setError('Datum ist erforderlich'); return }
    setSaving(true); setError('')
    try {
      // OSM-Venue ausgewählt aber noch nicht in DB → erst anlegen
      let resolvedVenueId = venueId
      const venueName = venueData?.name ?? ''
      if (!resolvedVenueId && venueName.trim()) {
        const empty = ''
        const newVenue = await createVenue({
          name: venueName.trim(),
          city: venueData?.city ?? empty,
          street: venueData?.street ?? empty,
          postalCode: venueData?.postalCode ?? empty,
          state: venueData?.state ?? empty,
          country: venueData?.country ?? empty,
          latitude: venueData?.lat ?? empty,
          longitude: venueData?.lon ?? empty,
          website: empty, arrival: empty, arrivalStreet: empty,
          arrivalPostalCode: empty, arrivalCity: empty,
          capacity: empty, capacitySeated: empty, stageDimensions: empty,
          clearanceHeight: empty, merchandiseFee: empty, merchandiseStand: empty,
          wardrobe: empty, showers: empty, wifi: empty, parking: empty,
          nightlinerParking: empty, loadingPath: empty, notes: empty,
        })
        resolvedVenueId = parseInt(String(newVenue.id))
      }

      const termin = await createTermin({
        date,
        title: title.trim() || venueName || art,
        art,
        venue_id: resolvedVenueId ?? null,
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

      <VenueSearch onSelect={v => { setVenueId(v.id); setVenueData(v) }} />

      <QField label="Titel (optional)">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder={venueData?.name || 'z.B. Festival-Name, Tour-Leg…'}
          className={inputCls}
        />
      </QField>
      <p className="text-xs text-gray-400 -mt-2">
        Leer lassen → Titel wird aus Venue oder Art generiert
      </p>
    </QuickCreateModal>
  )
}
