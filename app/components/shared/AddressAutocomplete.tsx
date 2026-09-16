'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Loader2 } from 'lucide-react'
import { buildPhotonUrl } from '@/lib/photon'
import { buildGeoapifyUrl, parseGeoapifyFeature, type GeoapifyFeature } from '@/lib/geoapify'
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

const USE_GEOAPIFY = true // Geoapify als primärer Geocoding-Dienst

interface NameAddressAutocompleteProps {
  label: string
  required?: boolean
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
  required,
  value,
  onChange,
  onAddressSelect,
  placeholder = '',
  withLatLon = false,
  variant = 'inline',
  autoFocus = false,
}: NameAddressAutocompleteProps) {
  const { language } = useLanguage()
  const [suggestions, setSuggestions] = useState<(PhotonFeature | GeoapifyFeature)[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)   // Input-Wrapper: Ankerpunkt für den Dropdown
  const menuRef = useRef<HTMLUListElement>(null)    // Dropdown im Portal (außerhalb containerRef)
  // Der Dropdown wird per Portal an <body> gerendert (position: fixed), damit ihn der
  // scrollende .modal-body (overflow:auto) nicht abschneidet / hinter die Buttonzeile schiebt.
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const updateMenuPos = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    try {
      if (USE_GEOAPIFY) {
        const url = buildGeoapifyUrl(q, 6, language)
        const res = await fetch(url)
        const data = await res.json()
        const features: GeoapifyFeature[] = data.features ?? []
        setSuggestions(features)
        setOpen(features.length > 0)
      } else {
        const url = buildPhotonUrl(q, 6, language)
        const res = await fetch(url)
        const data = await res.json()
        const features: PhotonFeature[] = data.features ?? []
        setSuggestions(features)
        setOpen(features.length > 0)
      }
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [language])

  const handleChange = (val: string) => {
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 350)
  }

  const handleSelect = (f: PhotonFeature | GeoapifyFeature) => {
    if (USE_GEOAPIFY) {
      const geo = f as GeoapifyFeature
      const parsed = parseGeoapifyFeature(geo)
      onChange(parsed.name || geo.properties.formatted?.split(',')[0] || '')
      onAddressSelect({
        name: parsed.name,
        street: parsed.street,
        postalCode: parsed.postalCode,
        city: parsed.city,
        state: parsed.state,
        country: parsed.country,
        ...(withLatLon ? { latitude: parsed.latitude, longitude: parsed.longitude } : {}),
      })
    } else {
      const ph = f as PhotonFeature
      const p = ph.properties
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
          latitude: String(ph.geometry.coordinates[1]),
          longitude: String(ph.geometry.coordinates[0]),
        } : {}),
      })
    }
    setSuggestions([])
    setOpen(false)
  }

  const formatSuggestion = (f: PhotonFeature | GeoapifyFeature): string => {
    if (USE_GEOAPIFY) {
      const p = (f as GeoapifyFeature).properties
      return p.formatted || p.address_line1 || ''
    }
    const p = (f as PhotonFeature).properties
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
      const target = e.target as Node
      // Klicks im Input-Container ODER im Portal-Dropdown zählen als „innen".
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Position des Portal-Dropdowns aktuell halten (Öffnen, neue Treffer, Scrollen, Resize).
  useEffect(() => {
    if (!open || suggestions.length === 0) return
    updateMenuPos()
    const onMove = () => updateMenuPos()
    window.addEventListener('scroll', onMove, true)   // capture: auch der scrollende Modal-Body
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, suggestions.length, updateMenuPos])

  const labelClass = variant === 'modal'
    ? 'form-label'
    : 'block text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5'

  const inputClass = variant === 'modal'
    ? 'form-input w-full'
    : 'w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 bg-white'

  return (
    <div ref={containerRef} className="relative">
      <label className={labelClass}>{label}{required && <span className="req-star" style={{ marginLeft: '2px' }}>*</span>}</label>
      <div className="relative" ref={anchorRef}>
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

      {open && suggestions.length > 0 && menuPos && typeof document !== 'undefined' && createPortal(
        <ul
          ref={menuRef}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-56 overflow-y-auto text-sm"
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: menuPos.width, zIndex: 1000 }}
        >
          {suggestions.map((f, i) => (
            <li
              key={i}
              className="flex items-start gap-2 px-3 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
              onMouseDown={e => { e.preventDefault(); handleSelect(f) }}
            >
              <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
              <span className="leading-snug text-gray-700 dark:text-gray-200">{formatSuggestion(f)}</span>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  )
}
