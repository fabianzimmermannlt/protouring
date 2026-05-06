'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Search, Loader2, MapPin } from 'lucide-react'

export interface AddressResult {
  street: string
  postalCode: string
  city: string
  state: string
  country: string
  latitude?: string
  longitude?: string
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address: {
    road?: string
    house_number?: string
    postcode?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
    state?: string
    country?: string
  }
}

interface AddressAutocompleteProps {
  onSelect: (addr: Partial<AddressResult>) => void
  withLatLon?: boolean
  placeholder?: string
  className?: string
}

export function AddressAutocomplete({
  onSelect,
  withLatLon = false,
  placeholder = 'Adresse oder Ort suchen…',
  className = '',
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=6&accept-language=de`
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'de' },
      })
      const data: NominatimResult[] = await res.json()
      setResults(data)
      setOpen(data.length > 0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 400)
  }

  const handleSelect = (r: NominatimResult) => {
    const a = r.address
    const city = a.city || a.town || a.village || a.municipality || a.county || ''
    const street = [a.road, a.house_number].filter(Boolean).join(' ')
    const result: Partial<AddressResult> = {
      street,
      postalCode: a.postcode || '',
      city,
      state: a.state || '',
      country: a.country || '',
    }
    if (withLatLon) {
      result.latitude = r.lat
      result.longitude = r.lon
    }
    onSelect(result)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Search className="absolute left-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm border border-blue-200 bg-blue-50 rounded px-2 py-1 pl-7 focus:outline-none focus:border-blue-400 focus:bg-white placeholder:text-blue-300"
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && <Loader2 className="absolute right-2 w-3.5 h-3.5 text-blue-400 animate-spin" />}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto text-sm">
          {results.map(r => (
            <li
              key={r.place_id}
              className="flex items-start gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
              onMouseDown={e => { e.preventDefault(); handleSelect(r) }}
            >
              <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
              <span className="leading-snug text-gray-700">{r.display_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
