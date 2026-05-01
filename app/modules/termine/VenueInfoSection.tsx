'use client'

import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, Loader2, ExternalLink, Download, FileIcon, Pencil } from 'lucide-react'
import { getVenue, updateVenue, getAuthToken, getCurrentTenant, type Venue, type VenueFormData } from '@/lib/api-client'
import VenueModal from '@/app/modules/venues/VenueModal'

// ─── API ──────────────────────────────────────────────────────

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

interface VenueFile {
  id: string
  category: string
  originalName: string
  mimeType: string
  size: number
}

async function fetchVenueFiles(venueId: string): Promise<VenueFile[]> {
  const res = await fetch(`${API_BASE}/api/files/venue/${venueId}`, { headers: authHeaders() })
  if (!res.ok) return []
  return ((await res.json()).files ?? []).map((f: any) => ({
    id: f.id,
    category: f.category,
    originalName: f.originalName || f.original_name,
    mimeType: f.mimeType || f.mime_type,
    size: f.size,
  }))
}

function formatSize(bytes: number) {
  if (!bytes) return ''
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`
}

// ─── AuthImage — fetches image blob with auth headers ─────────

function AuthImage({ fileId, alt, className }: { fileId: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let url: string
    fetch(`${API_BASE}/api/files/download/${fileId}`, { headers: authHeaders() })
      .then(r => r.blob())
      .then(blob => {
        url = URL.createObjectURL(blob)
        setSrc(url)
      })
      .catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [fileId])

  if (!src) return (
    <div className={`${className} bg-gray-100 flex items-center justify-center`}>
      <Loader2 size={14} className="animate-spin text-gray-300" />
    </div>
  )
  return <img src={src} alt={alt} className={className} />
}

// ─── Accordion ───────────────────────────────────────────────

function Accordion({ title, children, defaultOpen = false, onEdit, isAdmin }: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  onEdit?: () => void
  isAdmin?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center bg-white hover:bg-gray-50 transition-colors">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 px-4 py-3 flex-1 text-left"
        >
          {open
            ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
            : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
          }
          <span className="text-sm font-medium text-gray-700">{title}</span>
        </button>
        {isAdmin && onEdit && (
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="p-2 mr-2 text-gray-300 hover:text-gray-600 transition-colors rounded"
            title="Venue bearbeiten"
          >
            <Pencil size={12} />
          </button>
        )}
      </div>
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

// ─── Files accordion ─────────────────────────────────────────

function FilesAccordion({ venueId, isAdmin, onEdit }: { venueId: string; isAdmin?: boolean; onEdit?: () => void }) {
  const [files, setFiles] = useState<VenueFile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchVenueFiles(venueId).then(setFiles).finally(() => setLoading(false))
  }, [venueId])

  const images = files.filter(f => f.mimeType?.startsWith('image/'))
  const docs   = files.filter(f => !f.mimeType?.startsWith('image/'))

  const title = loading
    ? 'Dateien & Dokumente'
    : `Dateien & Dokumente${files.length > 0 ? ` (${files.length})` : ''}`

  return (
    <Accordion title={title} isAdmin={isAdmin} onEdit={onEdit}>
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
          <Loader2 size={13} className="animate-spin" /> Laden…
        </div>
      ) : files.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">Keine Dateien am Venue hinterlegt</p>
      ) : (
        <>
          {images.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 mt-1">Fotos</div>
              <div className="grid grid-cols-4 gap-2">
                {images.map(f => (
                  <button
                    key={f.id}
                    onClick={() => {
                      fetch(`${API_BASE}/api/files/download/${f.id}`, { headers: authHeaders() })
                        .then(r => r.blob())
                        .then(blob => window.open(URL.createObjectURL(blob), '_blank'))
                    }}
                    title={f.originalName}
                    className="focus:outline-none"
                  >
                    <AuthImage
                      fileId={f.id}
                      alt={f.originalName}
                      className="w-full aspect-square object-cover rounded border border-gray-200 hover:opacity-80 transition-opacity"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          {docs.length > 0 && (
            <div>
              {images.length > 0 && (
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 mt-2">Dokumente</div>
              )}
              <div className="flex flex-col gap-1">
                {docs.map(f => (
                  <button
                    key={f.id}
                    onClick={() => {
                      fetch(`${API_BASE}/api/files/download/${f.id}`, { headers: authHeaders() })
                        .then(r => r.blob())
                        .then(blob => {
                          const a = document.createElement('a')
                          a.href = URL.createObjectURL(blob)
                          a.download = f.originalName
                          a.click()
                        })
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 group w-full text-left"
                  >
                    <FileIcon size={13} className="text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700 flex-1 truncate group-hover:text-blue-600">{f.originalName}</span>
                    {f.category && f.category !== 'Allgemein' && (
                      <span className="text-xs text-gray-400 flex-shrink-0">{f.category}</span>
                    )}
                    <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(f.size)}</span>
                    <Download size={11} className="text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Accordion>
  )
}

// ─── Main ─────────────────────────────────────────────────────

interface VenueInfoSectionProps {
  venueId: number | string
  venueName?: string
  isAdmin?: boolean
}

export default function VenueInfoSection({ venueId, venueName, isAdmin }: VenueInfoSectionProps) {
  const [venue, setVenue] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  const load = () => {
    setLoading(true)
    getVenue(String(venueId))
      .then(setVenue)
      .catch(() => setVenue(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [venueId])

  const handleSaved = (updated: Venue) => {
    setVenue(updated)
    setEditOpen(false)
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
      <Loader2 size={14} className="animate-spin" /> Venue-Daten werden geladen…
    </div>
  )

  if (!venue) return (
    <div className="text-sm text-gray-400 py-4">Venue-Daten nicht verfügbar</div>
  )

  const hasArrival   = [venue.arrival, venue.arrivalStreet, venue.arrivalCity].some(Boolean)
  const hasTech      = [venue.capacity, venue.capacitySeated, venue.stageDimensions, venue.clearanceHeight].some(Boolean)
  const hasAmenities = [venue.wardrobe, venue.showers, venue.wifi, venue.parking, venue.nightlinerParking, venue.loadingPath, venue.merchandiseFee, venue.merchandiseStand].some(Boolean)

  const openEdit = () => setEditOpen(true)

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-0.5 mb-1">
        Venue: {venue.name || venueName}
      </div>

      <Accordion title="Adresse & Allgemein" defaultOpen={true} isAdmin={isAdmin} onEdit={openEdit}>
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

      {hasArrival && (
        <Accordion title="Anfahrt" isAdmin={isAdmin} onEdit={openEdit}>
          <Field label="Beschreibung"    value={venue.arrival} />
          <Field label="Straße"          value={venue.arrivalStreet} />
          <Field label="PLZ / Ort"       value={[venue.arrivalPostalCode, venue.arrivalCity].filter(Boolean).join(' ')} />
        </Accordion>
      )}

      {hasTech && (
        <Accordion title="Bühne & Kapazität" isAdmin={isAdmin} onEdit={openEdit}>
          <Field label="Kapazität stehend" value={venue.capacity} />
          <Field label="Kapazität sitzend" value={venue.capacitySeated} />
          <Field label="Bühnenmasse"       value={venue.stageDimensions} />
          <Field label="Durchfahrtshöhe"   value={venue.clearanceHeight} />
        </Accordion>
      )}

      {hasAmenities && (
        <Accordion title="Ausstattung & Logistik" isAdmin={isAdmin} onEdit={openEdit}>
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

      {venue.notes && (
        <Accordion title="Notizen" isAdmin={isAdmin} onEdit={openEdit}>
          <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{venue.notes}</p>
        </Accordion>
      )}

      <FilesAccordion venueId={String(venueId)} isAdmin={isAdmin} onEdit={openEdit} />

      {editOpen && venue && (
        <VenueModal
          venue={venue}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
