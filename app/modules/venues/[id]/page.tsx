'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Pencil, Upload, Trash2, Edit, X, AlertCircle,
  File, Globe, MapPin, Users, Ruler, Zap, ChevronDown, ChevronRight,
  FolderInput, Image as ImageIcon, ExternalLink, Loader2
} from 'lucide-react'
import {
  getAuthToken, getCurrentTenant, isEditorRole, getEffectiveRole,
  updateVenue, type Venue, type VenueFormData
} from '@/lib/api-client'
import VenueModal from '../VenueModal'

// ─── API Base ────────────────────────────────────────────────────────────────
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
type VenueFileCategory = typeof VENUE_FILE_CATEGORIES[number]

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

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

function kv(label: string, value: string | undefined) {
  if (!value?.trim()) return null
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1 border-b border-gray-50">
      <span className="text-gray-400 font-medium text-xs uppercase tracking-wide leading-5">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VenueDetailPage() {
  const params = useParams()
  const router = useRouter()
  const venueId = String(params.id)
  const isEditor = isEditorRole(getEffectiveRole())

  const [venue, setVenue] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editModalOpen, setEditModalOpen] = useState(false)

  const [files, setFiles] = useState<FileItem[]>([])
  const [filesLoading, setFilesLoading] = useState(true)

  const [shows, setShows] = useState<Show[]>([])
  const [showsLoading, setShowsLoading] = useState(true)

  // Lightbox
  const [lightboxImg, setLightboxImg] = useState<FileItem | null>(null)

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadType, setUploadType] = useState<'files' | 'photos'>('files')
  const [selectedCategory, setSelectedCategory] = useState<string>(VENUE_FILE_CATEGORIES[0])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      if (!res.ok) throw new Error()
      const data = await res.json()
      setFiles(data.files ?? [])
    } catch {
      // fail silently
    } finally {
      setFilesLoading(false)
    }
  }, [venueId])

  const loadShows = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/venues/${venueId}/shows`, { headers: authHeaders() })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setShows(data.shows ?? [])
    } catch {
      // fail silently
    } finally {
      setShowsLoading(false)
    }
  }, [venueId])

  useEffect(() => {
    loadVenue()
    loadFiles()
    loadShows()
  }, [loadVenue, loadFiles, loadShows])

  // ─── File helpers ────────────────────────────────────────────────────────
  const photos = files.filter(f => f.mimeType.startsWith('image/'))
  const docs = files.filter(f => !f.mimeType.startsWith('image/'))

  const docsByCategory = VENUE_FILE_CATEGORIES.reduce<Record<string, FileItem[]>>((acc, cat) => {
    const matching = docs.filter(f => f.category === cat)
    if (matching.length > 0) acc[cat] = matching
    return acc
  }, {})
  const unknownCatFiles = docs.filter(f => !(VENUE_FILE_CATEGORIES as readonly string[]).includes(f.category))
  if (unknownCatFiles.length > 0) {
    docsByCategory['Sonstiges'] = [...(docsByCategory['Sonstiges'] ?? []), ...unknownCatFiles]
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

  async function openLightbox(file: FileItem) {
    // Fetch blob URL für Lightbox
    try {
      const res = await fetch(`${API_BASE}/api/files/download/${file.id}`, { headers: authHeaders() })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setLightboxImg({ ...file, url })
    } catch { alert('Bild konnte nicht geladen werden') }
  }

  // ─── Loading / Error ─────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" />
      <span className="text-gray-500">Lade Venue…</span>
    </div>
  )

  if (error || !venue) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <AlertCircle className="w-8 h-8 text-red-400" />
      <p className="text-gray-500">{error || 'Venue nicht gefunden'}</p>
      <button onClick={() => router.back()} className="btn btn-ghost">Zurück</button>
    </div>
  )

  const address = [venue.street, [venue.postalCode, venue.city].filter(Boolean).join(' '), venue.state, venue.country].filter(Boolean).join(', ')

  return (
    <div className="module-content">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{venue.name}</h1>
          {venue.city && <p className="text-sm text-gray-500">{venue.city}{venue.country ? `, ${venue.country}` : ''}</p>}
        </div>
        {isEditor && (
          <button onClick={() => setEditModalOpen(true)} className="btn btn-ghost" title="Bearbeiten">
            <Pencil className="w-4 h-4" /> Bearbeiten
          </button>
        )}
      </div>

      {/* ── Card Grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Venue Info ── */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><MapPin className="w-3.5 h-3.5 inline mr-1" />Venue Info</span>
          </div>
          <div className="pt-card-body space-y-0.5">
            {kv('Adresse', address || undefined)}
            {kv('Kapazität', [venue.capacity && `${venue.capacity} stehend`, venue.capacitySeated && `${venue.capacitySeated} bestuhlt`].filter(Boolean).join(' / ') || undefined)}
            {venue.website && (
              <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1 border-b border-gray-50">
                <span className="text-gray-400 font-medium text-xs uppercase tracking-wide leading-5">Website</span>
                <a href={venue.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 truncate">
                  <Globe className="w-3 h-3 shrink-0" />{venue.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {kv('WLAN', venue.wifi || undefined)}
            {kv('Garderoben', venue.wardrobe || undefined)}
            {kv('Duschen', venue.showers || undefined)}
            {kv('Anfahrt', venue.arrival || undefined)}
            {kv('Parkplatz', venue.parking || undefined)}
            {kv('Nightliner', venue.nightlinerParking || undefined)}
            {kv('Ladeweg', venue.loadingPath || undefined)}
            {kv('Notizen', venue.notes || undefined)}
          </div>
        </div>

        {/* ── Technische Specs ── */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Ruler className="w-3.5 h-3.5 inline mr-1" />Technische Specs</span>
          </div>
          <div className="pt-card-body space-y-0.5">
            {kv('Bühnenmaße', venue.stageDimensions || undefined)}
            {kv('Lichte Höhe', venue.clearanceHeight || undefined)}
            {kv('Merchandise Fee', venue.merchandiseFee || undefined)}
            {kv('Merch-Stand', venue.merchandiseStand || undefined)}
            {(!venue.stageDimensions && !venue.clearanceHeight && !venue.merchandiseFee && !venue.merchandiseStand) && (
              <p className="text-sm text-gray-400 py-2">Keine technischen Daten hinterlegt.</p>
            )}
          </div>
        </div>

        {/* ── Fotos (2-spaltig) ── */}
        <div className="pt-card md:col-span-2">
          <div className="pt-card-header">
            <span className="pt-card-title"><ImageIcon className="w-3.5 h-3.5 inline mr-1" />Fotos</span>
            {isEditor && (
              <button onClick={() => { setUploadType('photos'); setShowUploadModal(true) }}
                className="text-gray-400 hover:text-blue-600 transition-colors" title="Foto hochladen">
                <Upload className="w-3.5 h-3.5" />
              </button>
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
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {photos.map(photo => (
                  <div key={photo.id} className="relative group aspect-square rounded overflow-hidden bg-gray-100 cursor-pointer"
                    onClick={() => openLightbox(photo)}>
                    <PhotoThumb file={photo} />
                    {isEditor && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteFile(photo.id) }}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Dokumente ── */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><File className="w-3.5 h-3.5 inline mr-1" />Dokumente</span>
            {isEditor && (
              <button onClick={() => { setUploadType('files'); setShowUploadModal(true) }}
                className="text-gray-400 hover:text-blue-600 transition-colors" title="Dokument hochladen">
                <Upload className="w-3.5 h-3.5" />
              </button>
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

        {/* ── Vergangene Shows ── */}
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
                    onClick={() => router.push(`/?tab=appointments&terminId=${show.id}&view=details`)}>
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

      {/* ── Upload Modal ─────────────────────────────────────────────────── */}
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

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => { URL.revokeObjectURL(lightboxImg.url); setLightboxImg(null) }}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => { URL.revokeObjectURL(lightboxImg.url); setLightboxImg(null) }}>
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImg.url}
            alt={lightboxImg.originalName}
            className="max-w-full max-h-full object-contain rounded"
            onClick={e => e.stopPropagation()}
          />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">{lightboxImg.originalName}</p>
        </div>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
      {editModalOpen && venue && (
        <VenueModal
          venue={venue}
          onClose={() => setEditModalOpen(false)}
          onSaved={updated => { setVenue(updated); setEditModalOpen(false) }}
          onDeleted={() => router.back()}
        />
      )}
    </div>
  )
}

// ─── Photo Thumbnail ──────────────────────────────────────────────────────────
function PhotoThumb({ file }: { file: FileItem }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let url: string
    fetch(`${API_BASE}/api/files/download/${file.id}`, { headers: authHeaders() })
      .then(r => r.blob())
      .then(blob => { url = URL.createObjectURL(blob); setSrc(url) })
      .catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [file.id])

  if (!src) return <div className="w-full h-full bg-gray-200 animate-pulse" />
  return <img src={src} alt={file.originalName} className="w-full h-full object-cover" />
}

// ─── Doc Category Section ─────────────────────────────────────────────────────
function DocCategorySection({
  category, files, onDelete, onOpen
}: {
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
