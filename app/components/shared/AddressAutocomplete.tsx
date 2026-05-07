'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { buildPhotonUrl } from '@/lib/photon'
import { useLanguage } from '@/app/lib/i18n/LanguageContext'

export interface AddressResult {
  name?: string
  street: string
  postalCode: string
  city: string
  state: string
  country: string
  latitude?: string
  longitude?: string
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    city?: string
    town?: string
    village?: string
    state?: string
    country?: string
  }
}

interface NameAddressAutocompleteProps {
  label: string
  value: string
  onChange: (v: string) => void
  onAddressSelect: (result: AddressResult) => void
  placeholder?: string
  withLatLon?: boolean
  /** 'modal' = form-label / form-input classes; 'inline' = compact inline-edit style */
  variant?: 'modal' | 'inline'
  autoFocus?: boolean
}

export function NameAddressAutocomplete({
  label,
  value,
  onChange,
  onAddressSelect,
  placeholder = '',
  withLatLon = false,
  variant = 'inline',
  autoFocus = false,
}: NameAddressAutocompleteProps) {
  const { language } = useLanguage()
  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    try {
      const url = buildPhotonUrl(q, 6, language)
      const res = await fetch(url)
      const data = await res.json()
      const features: PhotonFeature[] = data.features ?? []
      setSuggestions(features)
      setOpen(features.length > 0)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (val: string) => {
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 350)
  }

  const handleSelect = (f: PhotonFeature) => {
    const p = f.properties
    const city = p.city || p.town || p.village || ''
    const street = [p.street, p.housenumber].filter(Boolean).join(' ')
    const name = p.name || ''

    if (name) onChange(name)

    onAddressSelect({
      name,
      street,
      postalCode: p.postcode || '',
      city,
      state: p.state || '',
      country: p.country || '',
      ...(withLatLon ? {
        latitude: String(f.geometry.coordinates[1]),
        longitude: String(f.geometry.coordinates[0]),
      } : {}),
    })

    setSuggestions([])
    setOpen(false)
  }

  const formatSuggestion = (f: PhotonFeature) => {
    const p = f.properties
    const parts = [
      p.name,
      p.street && p.housenumber ? `${p.street} ${p.housenumber}` : p.street,
      p.postcode,
      p.city || p.town || p.village,
      p.country,
    ].filter(Boolean)
    return parts.join(', ')
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const labelClass = variant === 'modal'
    ? 'form-label'
    : 'block text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5'

  const inputClass = variant === 'modal'
    ? 'form-input w-full'
    : 'w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 bg-white'

  return (
    <div ref={containerRef} className="relative">
      <label className={labelClass}>{label}</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={inputClass}
        />
        {loading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400 animate-spin pointer-events-none" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto text-sm">
          {suggestions.map((f, i) => (
            <li
              key={i}
              className="flex items-start gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
              onMouseDown={e => { e.preventDefault(); handleSelect(f) }}
            >
              <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
              <span className="leading-snug text-gray-700">{formatSuggestion(f)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
