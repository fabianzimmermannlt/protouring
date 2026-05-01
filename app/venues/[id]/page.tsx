'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/app/components/shared/AppShell'
import {
  ArrowLeft, ChevronLeft, ChevronRight as ChevronRightIcon, Pencil, Upload, Trash2, X, AlertCircle,
  File, Globe, MapPin, Users, Ruler, ChevronDown, ChevronRight,
  Image as ImageIcon, ExternalLink, Loader2,
} from 'lucide-react'
import {
  getAuthToken, getCurrentTenant, getCurrentUser, isAuthenticated,
  isEditorRole, getEffectiveRole, type Venue,
} from '@/lib/api-client'
import VenueModal from '@/app/modules/venues/VenueModal'
import { useIsMobile } from '@/app/hooks/useIsMobile'

// ─── API Base ─────────────────────────────────────────────────────────────────
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

// ─── Venue File Categories ────────────────────────────────────────────────────
const VENUE_FILE_CATEGORIES = [
  'Stage Plan',
  'Groundplan / Hallenplan',
  'Rigging Plot',
  'Technische Daten',
  'Anfahrt & Parken',
  'Verträge',
  'Sonstiges',
] as const

interface FileItem {
  id: string
  category: string
  originalName: string
  storedName: string
  mimeType: string
  size: number
  createdAt: string
  url: string
}

interface Show {
  id: number
  date: string
  title: string
  city: string
  status_booking: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`
}

function fmtDate(d: string) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return d }
}

function fileIcon(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️'
  if (mime.includes('pdf')) return '📄'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  if (mime.includes('excel') || mime.includes('spreadsheet')) return '📊'
  if (mime.includes('zip') || mime.includes('rar')) return '📦'
  return '📎'
}

function KV({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-400 font-medium text-xs uppercase tracking-wide leading-5">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VenueDetailPage() {
  const params = useParams()
  const router = useRouter()
  const isMobile = useIsMobile()
  const venueId = String(params.id)

  const [authChecked, setAuthChecked] = useState(false)
  const isEditor = isEditorRole(getEffectiveRole())
  const currentUser = getCurrentUser()
  const isSuperadmin = Boolean((currentUser as any)?.isSuperadmin)

  const [venue, setVenue] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editModalOpen, setEditModalOpen] = useState(false)

  const [files, setFiles] = useState<FileItem[]>([])
  const [filesLoading, setFilesLoading] = useState(true)

  const [shows, setShows] = useState<Show[]>([])
  const [showsLoading, setShowsLoading] = useState(true)

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [lightboxBlobUrl, setLightboxBlobUrl] = useState<string | null>(null)
  const [lightboxLoading, setLightboxLoading] = useState(false)
  const lightboxIndexRef = useRef<number | null>(null)

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadType, setUploadType] = useState<'files' | 'photos'>('files')
  const [selectedCategory, setSelectedCategory] = useState<string>(VENUE_FILE_CATEGORIES[0])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Auth ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
    } else {
      setAuthChecked(true)
    }
  }, [router])

  // ─── Navigation tab change ────────────────────────────────────────────────
  function handleTabChange(tab: string) {
    window.location.href = `/?tab=${tab}`
  }

  // ─── Load data ────────────────────────────────────────────────────────────
  const loadVenue = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/venues/${venueId}`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Venue nicht gefunden')
      const data = await res.json()
      setVenue(data.venue)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [venueId])

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/files/venue/${venueId}`, { headers: authHeaders() })
      if (!res.ok) return
      const data = await res.json()
      setFiles(data.files ?? [])
    } catch { /* silent */ } finally {
      setFilesLoading(false)
    }
  }, [venueId])

  const loadShows = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/venues/${venueId}/shows`, { headers: authHeaders() })
      if (!res.ok) return
      const data = await res.json()
      setShows(data.shows ?? [])
    } catch { /* silent */ } finally {
      setShowsLoading(false)
    }
  }, [venueId])

  useEffect(() => {
    if (!authChecked) return
    loadVenue()
    loadFiles()
    loadShows()
  }, [authChecked, loadVenue, loadFiles, loadShows])

  // ─── File helpers ─────────────────────────────────────────────────────────
  const photos = files.filter(f => f.mimeType.startsWith('image/'))
  const docs = files.filter(f => !f.mimeType.startsWith('image/'))

  const docsByCategory = VENUE_FILE_CATEGORIES.reduce<Record<string, FileItem[]>>((acc, cat) => {
    const matching = docs.filter(f => f.category === cat)
    if (matching.length > 0) acc[cat] = matching
    return acc
  }, {})
  const unknownFiles = docs.filter(f => !(VENUE_FILE_CATEGORIES as readonly string[]).includes(f.category))
  if (unknownFiles.length > 0) {
    docsByCategory['Sonstiges'] = [...(docsByCategory['Sonstiges'] ?? []), ...unknownFiles]
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploadError('')
    setUploading(true)
    const category = uploadType === 'photos' ? 'Fotos' : selectedCategory
    try {
      const form = new FormData()
      Array.from(fileList).forEach(f => form.append('files', f))
      const res = await fetch(
        `${API_BASE}/api/files/venue/${venueId}?category=${encodeURIComponent(category)}`,
        { method: 'POST', headers: authHeaders(), body: form }
      )
      if (!res.ok) throw new Error('Upload fehlgeschlagen')
      await loadFiles()
      setShowUploadModal(false)
    } catch (e) {
      setUploadError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!confirm('Datei löschen?')) return
    try {
      await fetch(`${API_BASE}/api/files/${fileId}`, { method: 'DELETE', headers: authHeaders() })
      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch { alert('Löschen fehlgeschlagen') }
  }

  async function openFile(file: FileItem) {
    try {
      const res = await fetch(`${API_BASE}/api/files/download/${file.id}`, { headers: authHeaders() })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (file.mimeType.startsWith('image/') || file.mimeType.includes('pdf')) {
        window.open(url, '_blank')
      } else {
        const a = document.createElement('a'); a.href = url; a.download = file.originalName; a.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch { alert('Datei konnte nicht geöffnet werden') }
  }

  async function openLightbox(index: number) {
    setLightboxLoading(true)
    setLightboxIndex(index)
    lightboxIndexRef.current = index
    try {
      const file = photos[index]
      const res = await fetch(`${API_BASE}/api/files/download/${file.id}`, { headers: authHeaders() })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      setLightboxBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob) })
    } catch { alert('Bild konnte nicht geladen werden') }
    finally { setLightboxLoading(false) }
  }

  function closeLightbox() {
    setLightboxBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    setLightboxIndex(null)
    lightboxIndexRef.current = null
  }

  function navigateLightbox(dir: 1 | -1) {
    const idx = lightboxIndexRef.current
    if (idx === null || photos.length === 0) return
    openLightbox((idx + dir + photos.length) % photos.length)
  }

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') navigateLightbox(1)
      else if (e.key === 'ArrowLeft') navigateLightbox(-1)
      else if (e.key === 'Escape') closeLightbox()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex])

  // ─── Content ──────────────────────────────────────────────────────────────
  if (!authChecked) return null

  const address = [
    venue?.street,
    [venue?.postalCode, venue?.city].filter(Boolean).join(' '),
    venue?.state,
    venue?.country,
  ].filter(Boolean).join(', ')

  const content = (
    <div className="module-content">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => window.location.href = '/?tab=venues'}
          className="text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          {loading
            ? <div className="h-6 w-48 bg-gray-200 animate-pulse rounded" />
            : <>
                <h1 className="text-xl font-bold text-gray-900 truncate">{venue?.name}</h1>
                {venue?.city && <p className="text-sm text-gray-500">{venue.city}{venue.country ? `, ${venue.country}` : ''}</p>}
              </>
          }
        </div>
        {isEditor && venue && (
          <button onClick={() => setEditModalOpen(true)} className="btn btn-ghost">
            <Pencil className="w-4 h-4" /> Bearbeiten
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Venue Info */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><MapPin className="w-3.5 h-3.5 inline mr-1" />Venue Info</span>
            {isEditor && venue && (
              <button onClick={() => setEditModalOpen(true)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Bearbeiten">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div> : venue ? (
              <>
                <KV label="Adresse" value={address || undefined} />
                <KV label="Kapazität" value={[venue.capacity && `${venue.capacity} stehend`, venue.capacitySeated && `${venue.capacitySeated} bestuhlt`].filter(Boolean).join(' / ') || undefined} />
                {venue.website && (
                  <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1.5 border-b border-gray-50">
                    <span className="text-gray-400 font-medium text-xs uppercase tracking-wide leading-5">Website</span>
                    <a href={venue.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 truncate">
                      <Globe className="w-3 h-3 shrink-0" />{venue.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                <KV label="WLAN" value={venue.wifi || undefined} />
                <KV label="Garderoben" value={venue.wardrobe || undefined} />
                <KV label="Duschen" value={venue.showers || undefined} />
                <KV label="Anfahrt (Notiz)" value={venue.arrival || undefined} />
                <KV label="Anfahrtsadresse" value={[venue.arrivalStreet, [venue.arrivalPostalCode, venue.arrivalCity].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined} />
                <KV label="Parkplatz" value={venue.parking || undefined} />
                <KV label="Nightliner" value={venue.nightlinerParking || undefined} />
                <KV label="Ladeweg" value={venue.loadingPath || undefined} />
                <KV label="Notizen" value={venue.notes || undefined} />
              </>
            ) : null}
          </div>
        </div>

        {/* Technische Specs */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Ruler className="w-3.5 h-3.5 inline mr-1" />Technische Specs</span>
            {isEditor && venue && (
              <button onClick={() => setEditModalOpen(true)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Bearbeiten">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div> : venue ? (
              <>
                <KV label="Bühnenmaße" value={venue.stageDimensions || undefined} />
                <KV label="Lichte Höhe" value={venue.clearanceHeight || undefined} />
                <KV label="Merchandise Fee" value={venue.merchandiseFee || undefined} />
                <KV label="Merch-Stand" value={venue.merchandiseStand || undefined} />
                {!venue.stageDimensions && !venue.clearanceHeight && !venue.merchandiseFee && !venue.merchandiseStand && (
                  <p className="text-sm text-gray-400 py-2">Keine technischen Daten hinterlegt.</p>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Fotos — 2-spaltig */}
        <div className="pt-card md:col-span-2">
          <div className="pt-card-header">
            <span className="pt-card-title"><ImageIcon className="w-3.5 h-3.5 inline mr-1" />Fotos</span>
            {isEditor && (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditModalOpen(true)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Venue bearbeiten">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setUploadType('photos'); setShowUploadModal(true) }}
                  className="text-gray-400 hover:text-blue-600 transition-colors" title="Foto hochladen">
                  <Upload className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="pt-card-body">
            {filesLoading ? (
              <div className="flex items-center justify-center h-16 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin mr-2" />Lade…</div>
            ) : photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-20 text-gray-400">
                <ImageIcon className="w-6 h-6 mb-1" />
                <span className="text-xs">Noch keine Fotos hochgeladen</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
                {photos.map((photo, idx) => (
                  <div key={photo.id} className="relative group aspect-square rounded overflow-hidden bg-gray-100 cursor-pointer"
                    onClick={() => openLightbox(idx)}>
                    <PhotoThumb file={photo} />
                    {isEditor && (
                      <button onClick={e => { e.stopPropagation(); handleDeleteFile(photo.id) }}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dokumente */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><File className="w-3.5 h-3.5 inline mr-1" />Dokumente</span>
            {isEditor && (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditModalOpen(true)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Venue bearbeiten">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setUploadType('files'); setShowUploadModal(true) }}
                  className="text-gray-400 hover:text-blue-600 transition-colors" title="Dokument hochladen">
                  <Upload className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="pt-card-body">
            {filesLoading ? (
              <div className="flex items-center justify-center h-16 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin mr-2" />Lade…</div>
            ) : Object.keys(docsByCategory).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-20 text-gray-400">
                <File className="w-6 h-6 mb-1" />
                <span className="text-xs">Keine Dokumente hinterlegt</span>
              </div>
            ) : (
              Object.entries(docsByCategory).map(([cat, catFiles]) => (
                <DocCategorySection key={cat} category={cat} files={catFiles}
                  onDelete={isEditor ? handleDeleteFile : undefined}
                  onOpen={openFile} />
              ))
            )}
          </div>
        </div>

        {/* Vergangene Shows */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Users className="w-3.5 h-3.5 inline mr-1" />Shows an diesem Venue</span>
          </div>
          <div className="pt-card-body">
            {showsLoading ? (
              <div className="flex items-center justify-center h-16 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin mr-2" />Lade…</div>
            ) : shows.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">Noch keine Shows an diesem Venue.</p>
            ) : (
              <div className="space-y-0.5">
                {shows.map(show => (
                  <div key={show.id}
                    className="flex items-center justify-between py-1.5 px-1 rounded hover:bg-gray-50 cursor-pointer group"
                    onClick={() => window.location.href = `/appointments/${show.id}/details`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{show.title || show.city || '—'}</p>
                      <p className="text-xs text-gray-400">{fmtDate(show.date)}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 shrink-0 ml-2 transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal-container max-w-md">
            <div className="modal-header">
              <span className="modal-title">{uploadType === 'photos' ? 'Foto hochladen' : 'Dokument hochladen'}</span>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="modal-body space-y-4">
              {uploadType === 'files' && (
                <div>
                  <label className="form-label">Kategorie</label>
                  <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="form-select">
                    {VENUE_FILE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              )}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files) }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Dateien hierher ziehen oder klicken</p>
                <p className="text-xs text-gray-400 mt-1">Max. 50 MB pro Datei</p>
                <input ref={fileInputRef} type="file" multiple
                  accept={uploadType === 'photos' ? 'image/*' : undefined}
                  className="hidden" onChange={e => handleUpload(e.target.files)} />
              </div>
              {uploading && <div className="flex items-center gap-2 text-sm text-blue-600"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Wird hochgeladen…</div>}
              {uploadError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{uploadError}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={closeLightbox}>
          {/* Close */}
          <button className="absolute top-4 right-4 text-white/70 hover:text-white z-10" onClick={closeLightbox}>
            <X className="w-6 h-6" />
          </button>
          {/* Prev */}
          {photos.length > 1 && (
            <button
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
              onClick={e => { e.stopPropagation(); navigateLightbox(-1) }}>
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {/* Image */}
          {lightboxLoading ? (
            <Loader2 className="w-10 h-10 text-white/60 animate-spin" onClick={e => e.stopPropagation()} />
          ) : lightboxBlobUrl ? (
            <img src={lightboxBlobUrl} alt={photos[lightboxIndex]?.originalName}
              className="max-w-full max-h-full object-contain rounded"
              onClick={e => e.stopPropagation()} />
          ) : null}
          {/* Next */}
          {photos.length > 1 && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
              onClick={e => { e.stopPropagation(); navigateLightbox(1) }}>
              <ChevronRightIcon className="w-6 h-6" />
            </button>
          )}
          {/* Caption + counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
            <p className="text-white/60 text-sm">{photos[lightboxIndex]?.originalName}</p>
            {photos.length > 1 && (
              <p className="text-white/40 text-xs mt-0.5">{lightboxIndex + 1} / {photos.length}</p>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && venue && (
        <VenueModal
          venue={venue}
          onClose={() => setEditModalOpen(false)}
          onSaved={updated => { setVenue(updated); setEditModalOpen(false) }}
          onDeleted={() => { window.location.href = '/?tab=venues' }}
        />
      )}
    </div>
  )

  return (
    <AppShell activeTab="venues" onTabChange={handleTabChange}>
      {content}
    </AppShell>
  )
}

// ─── Photo Thumbnail ──────────────────────────────────────────────────────────
function PhotoThumb({ file }: { file: FileItem }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let url: string
    fetch(`${API_BASE}/api/files/download/${file.id}`, { headers: authHeaders() })
      .then(r => r.blob()).then(blob => { url = URL.createObjectURL(blob); setSrc(url) }).catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [file.id])
  if (!src) return <div className="w-full h-full bg-gray-200 animate-pulse" />
  return <img src={src} alt={file.originalName} className="w-full h-full object-cover" />
}

// ─── Doc Category Section ─────────────────────────────────────────────────────
function DocCategorySection({ category, files, onDelete, onOpen }: {
  category: string
  files: FileItem[]
  onDelete?: (id: string) => void
  onOpen: (f: FileItem) => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-2 hover:bg-gray-50 transition-colors">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {category} <span className="text-gray-400 font-normal normal-case">({files.length})</span>
        </span>
        {open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-1">
          {files.map(file => (
            <div key={file.id} className="flex items-center justify-between py-1 px-1 rounded hover:bg-gray-50">
              <button onClick={() => onOpen(file)}
                className="flex items-center gap-1.5 flex-1 text-left truncate hover:text-blue-600 transition-colors">
                <span className="text-base leading-none">{fileIcon(file.mimeType)}</span>
                <span className="truncate text-xs">{file.originalName}</span>
              </button>
              <div className="flex items-center gap-1 ml-2 shrink-0">
                <span className="text-xs text-gray-400">{formatSize(file.size)}</span>
                {onDelete && (
                  <button onClick={() => onDelete(file.id)} className="text-gray-400 hover:text-red-600 p-0.5 rounded">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
