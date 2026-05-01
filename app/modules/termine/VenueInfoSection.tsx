'use client'

import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, Loader2, ExternalLink, Download, FileIcon, ImageIcon } from 'lucide-react'
import { getVenue, getAuthToken, getCurrentTenant, type Venue } from '@/lib/api-client'

// ─── File types ───────────────────────────────────────────────

interface VenueFile {
  id: string
  category: string
  originalName: string
  mimeType: string
  size: number
  url: string
}

// ─── API helpers ─────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || (
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3002`
    : 'http://localhost:3002'
)

function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  const tenant = getCurrentTenant()
  const h: Record<string, string> = {}
  if (token) h['Authorization'] = `Bearer ${token}`
  if (tenant) h['X-Tenant-Slug'] = tenant.slug
  return h
}

async function fetchVenueFiles(venueId: string): Promise<VenueFile[]> {
  const res = await fetch(`${API_BASE}/api/files/venue/${venueId}`, { headers: authHeaders() })
  if (!res.ok) return []
  const data = await res.json()
  return (data.files ?? []).map((f: any) => ({
    id: f.id,
    category: f.category,
    originalName: f.originalName || f.original_name,
    mimeType: f.mimeType || f.mime_type,
    size: f.size,
    url: `${API_BASE}/api/files/download/${f.id}`,
  }))
}

function formatSize(bytes: number) {
  if (!bytes) return ''
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`
}

// ─── Accordion ───────────────────────────────────────────────

function Accordion({ title, children, defaultOpen = false }: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-white hover:bg-gray-50 text-left transition-colors"
      >
        {open
          ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
          : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
        }
        <span className="text-sm font-medium text-gray-700">{title}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 bg-white border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Field row ───────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 flex-1">{value}</span>
    </div>
  )
}

// ─── Files section ───────────────────────────────────────────

function FilesAccordion({ venueId }: { venueId: string }) {
  const [files, setFiles] = useState<VenueFile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchVenueFiles(venueId)
      .then(setFiles)
      .finally(() => setLoading(false))
  }, [venueId])

  const grouped = files.reduce<Record<string, VenueFile[]>>((acc, f) => {
    const cat = f.category || 'Allgemein'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(f)
    return acc
  }, {})

  const images = files.filter(f => f.mimeType?.startsWith('image/'))
  const docs   = files.filter(f => !f.mimeType?.startsWith('image/'))

  if (loading) return (
    <div className="border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-2 text-gray-400 text-sm bg-white">
      <Loader2 size={13} className="animate-spin" /> Dateien werden geladen…
    </div>
  )

  if (files.length === 0) return (
    <div className="border border-gray-200 rounded-lg px-4 py-3 text-gray-400 text-sm bg-white">
      Keine Dateien am Venue hinterlegt
    </div>
  )

  return (
    <Accordion title={`Dateien & Dokumente (${files.length})`} defaultOpen={false}>
      {/* Photos grid */}
      {images.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 mt-1">Fotos</div>
          <div className="grid grid-cols-4 gap-2">
            {images.map(f => (
              <a
                key={f.id}
                href={f.url + `?token=${getAuthToken()}&tenant=${getCurrentTenant()?.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                title={f.originalName}
              >
                <img
                  src={f.url + `?token=${getAuthToken()}&tenant=${getCurrentTenant()?.slug}`}
                  alt={f.originalName}
                  className="w-full aspect-square object-cover rounded border border-gray-200 hover:opacity-80 transition-opacity"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Documents list */}
      {docs.length > 0 && (
        <div>
          {images.length > 0 && (
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 mt-2">Dokumente</div>
          )}
          <div className="flex flex-col gap-1">
            {docs.map(f => (
              <a
                key={f.id}
                href={f.url + `?token=${getAuthToken()}&tenant=${getCurrentTenant()?.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 group"
              >
                <FileIcon size={13} className="text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 flex-1 truncate group-hover:text-blue-600">{f.originalName}</span>
                {f.category && f.category !== 'Allgemein' && (
                  <span className="text-xs text-gray-400 flex-shrink-0">{f.category}</span>
                )}
                <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(f.size)}</span>
                <Download size={11} className="text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </Accordion>
  )
}

// ─── Main component ───────────────────────────────────────────

interface VenueInfoSectionProps {
  venueId: number | string
  venueName?: string
}

export default function VenueInfoSection({ venueId, venueName }: VenueInfoSectionProps) {
  const [venue, setVenue] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getVenue(String(venueId))
      .then(setVenue)
      .catch(() => setVenue(null))
      .finally(() => setLoading(false))
  }, [venueId])

  const hasArrival   = venue && [venue.arrival, venue.arrivalStreet, venue.arrivalCity].some(Boolean)
  const hasTech      = venue && [venue.capacity, venue.capacitySeated, venue.stageDimensions, venue.clearanceHeight].some(Boolean)
  const hasAmenities = venue && [venue.wardrobe, venue.showers, venue.wifi, venue.parking, venue.nightlinerParking, venue.loadingPath, venue.merchandiseFee, venue.merchandiseStand].some(Boolean)

  if (loading) return (
    <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
      <Loader2 size={14} className="animate-spin" /> Venue-Daten werden geladen…
    </div>
  )

  if (!venue) return (
    <div className="text-sm text-gray-400 py-4">Venue-Daten nicht verfügbar</div>
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-0.5 mb-1">
        Venue: {venue.name || venueName}
      </div>

      {/* Adresse */}
      <Accordion title="Adresse & Allgemein" defaultOpen={true}>
        <Field label="Name"       value={venue.name} />
        <Field label="Straße"     value={venue.street} />
        <Field label="PLZ / Ort"  value={[venue.postalCode, venue.city].filter(Boolean).join(' ')} />
        <Field label="Bundesland" value={venue.state} />
        <Field label="Land"       value={venue.country} />
        {venue.website && (
          <div className="flex gap-3 py-1.5">
            <span className="text-xs text-gray-400 w-36 flex-shrink-0 pt-0.5">Website</span>
            <a href={venue.website} target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              {venue.website} <ExternalLink size={11} />
            </a>
          </div>
        )}
      </Accordion>

      {/* Anfahrt */}
      {hasArrival && (
        <Accordion title="Anfahrt">
          <Field label="Anfahrtsbeschreibung" value={venue.arrival} />
          <Field label="Straße (Anfahrt)"     value={venue.arrivalStreet} />
          <Field label="PLZ / Ort"            value={[venue.arrivalPostalCode, venue.arrivalCity].filter(Boolean).join(' ')} />
        </Accordion>
      )}

      {/* Bühne & Technik */}
      {hasTech && (
        <Accordion title="Bühne & Kapazität">
          <Field label="Kapazität stehend" value={venue.capacity} />
          <Field label="Kapazität sitzend" value={venue.capacitySeated} />
          <Field label="Bühnenmasse"       value={venue.stageDimensions} />
          <Field label="Durchfahrtshöhe"   value={venue.clearanceHeight} />
        </Accordion>
      )}

      {/* Ausstattung */}
      {hasAmenities && (
        <Accordion title="Ausstattung & Logistik">
          <Field label="Garderobe"         value={venue.wardrobe} />
          <Field label="Duschen"           value={venue.showers} />
          <Field label="WLAN"              value={venue.wifi} />
          <Field label="Parkplätze"        value={venue.parking} />
          <Field label="Nightliner Parken" value={venue.nightlinerParking} />
          <Field label="Ladeweg"           value={venue.loadingPath} />
          <Field label="Merch-Gebühr"      value={venue.merchandiseFee} />
          <Field label="Merch-Stand"       value={venue.merchandiseStand} />
        </Accordion>
      )}

      {/* Notizen */}
      {venue.notes && (
        <Accordion title="Notizen">
          <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{venue.notes}</p>
        </Accordion>
      )}

      {/* Dateien */}
      <FilesAccordion venueId={String(venueId)} />
    </div>
  )
}
