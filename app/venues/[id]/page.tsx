'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/app/components/shared/AppShell'
import {
  ArrowLeft, Pencil, Upload, Trash2, X, AlertCircle, Plus, Save, Check,
  File, Globe, MapPin, Users, Ruler, ChevronDown, ChevronRight, Navigation,
  Image as ImageIcon, ExternalLink, Loader2, UserCircle, Phone, Mail,
} from 'lucide-react'
import { useLightbox, Lightbox } from '@/app/components/shared/Lightbox'
import {
  getAuthToken, getCurrentTenant, getCurrentUser, isAuthenticated,
  isEditorRole, getEffectiveRole, type Venue, type VenueContact,
  getVenueContacts, createVenueContact, updateVenueContact, deleteVenueContact,
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

  type EditSection = 'spielstaette' | 'backstage' | 'technik'
  const [editingSection, setEditingSection] = useState<EditSection | null>(null)
  const [inlineForm, setInlineForm] = useState<Record<string, string>>({})
  const [savingInline, setSavingInline] = useState(false)
  const [inlineError, setInlineError] = useState('')

  const [files, setFiles] = useState<FileItem[]>([])
  const [filesLoading, setFilesLoading] = useState(true)

  const [shows, setShows] = useState<Show[]>([])
  const [showsLoading, setShowsLoading] = useState(true)

  const [venueContacts, setVenueContacts] = useState<VenueContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [addingContact, setAddingContact] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [contactForm, setContactForm] = useState({ name: '', role: '', phone: '', email: '', notes: '' })
  const [savingContact, setSavingContact] = useState(false)

  // Lightbox — shared hook; photos werden via filesRef aktuell gehalten
  const [photos, setPhotos] = useState<FileItem[]>([])
  const lightbox = useLightbox(photos, API_BASE, authHeaders)

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
      setInlineForm(data.venue)
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

  const loadContacts = useCallback(async () => {
    try {
      const contacts = await getVenueContacts(venueId)
      setVenueContacts(contacts)
    } catch { /* silent */ } finally {
      setContactsLoading(false)
    }
  }, [venueId])

  useEffect(() => {
    if (!authChecked) return
    loadVenue()
    loadFiles()
    loadShows()
    loadContacts()
  }, [authChecked, loadVenue, loadFiles, loadShows, loadContacts])

  // ─── File helpers ─────────────────────────────────────────────────────────
  const docs = files.filter(f => !f.mimeType.startsWith('image/'))
  // photos als State damit useLightbox immer aktuell ist
  useEffect(() => {
    setPhotos(files.filter(f => f.mimeType.startsWith('image/')))
  }, [files])

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

  // ─── Contact handlers ─────────────────────────────────────────────────────
  function startAddContact() {
    setContactForm({ name: '', role: '', phone: '', email: '', notes: '' })
    setEditingContactId(null)
    setAddingContact(true)
  }

  function startEditContact(c: VenueContact) {
    setContactForm({ name: c.name, role: c.role, phone: c.phone, email: c.email, notes: c.notes })
    setEditingContactId(c.id)
    setAddingContact(false)
  }

  async function saveContact() {
    if (!contactForm.name.trim()) return
    setSavingContact(true)
    try {
      if (editingContactId) {
        const updated = await updateVenueContact(venueId, editingContactId, contactForm)
        setVenueContacts(prev => prev.map(c => c.id === editingContactId ? updated : c))
      } else {
        const created = await createVenueContact(venueId, contactForm)
        setVenueContacts(prev => [...prev, created])
      }
      setAddingContact(false)
      setEditingContactId(null)
    } catch { /* silent */ } finally {
      setSavingContact(false)
    }
  }

  async function handleDeleteContact(id: string) {
    if (!confirm('Ansprechpartner löschen?')) return
    try {
      await deleteVenueContact(venueId, id)
      setVenueContacts(prev => prev.filter(c => c.id !== id))
    } catch { /* silent */ }
  }

  // ─── Inline section edit ──────────────────────────────────────────────────
  function startEditSection(section: EditSection) {
    if (venue) setInlineForm({ ...venue })
    setInlineError('')
    setEditingSection(section)
  }

  function cancelEditSection() {
    if (venue) setInlineForm({ ...venue })
    setEditingSection(null)
    setInlineError('')
  }

  async function saveInlineSection() {
    if (!venue) return
    setSavingInline(true)
    setInlineError('')
    try {
      const res = await fetch(`${API_BASE}/api/venues/${venueId}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(inlineForm),
      })
      if (!res.ok) throw new Error('Speichern fehlgeschlagen')
      const data = await res.json()
      setVenue(data.venue)
      setInlineForm({ ...data.venue })
      setEditingSection(null)
    } catch (e) {
      setInlineError((e as Error).message || 'Speichern fehlgeschlagen')
    } finally {
      setSavingInline(false)
    }
  }

  const iF = (key: string, value: string) => setInlineForm(prev => ({ ...prev, [key]: value }))

  // Lightbox — openLightbox/closeLightbox/navigateLightbox via shared hook (lightbox.open / lightbox.close)

  // ─── Content ──────────────────────────────────────────────────────────────
  if (!authChecked) return null

  const address = [
    venue?.street,
    [venue?.postalCode, venue?.city].filter(Boolean).join(' '),
    venue?.state,
    venue?.country,
  ].filter(Boolean).join(', ')

  const arrivalAddress = [
    venue?.arrivalStreet,
    [venue?.arrivalPostalCode, venue?.arrivalCity].filter(Boolean).join(' '),
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
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Spielstätte */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><MapPin className="w-3.5 h-3.5 inline mr-1" />Spielstätte</span>
            {isEditor && venue && editingSection !== 'spielstaette' && (
              <button onClick={() => startEditSection('spielstaette')} className="text-gray-400 hover:text-blue-600 transition-colors" title="Bearbeiten">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            : editingSection === 'spielstaette' ? (
              <div className="space-y-2">
                <IField label="Name *" value={inlineForm.name ?? ''} onChange={v => iF('name', v)} />
                <IField label="Straße" value={inlineForm.street ?? ''} onChange={v => iF('street', v)} />
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <IField label="PLZ" value={inlineForm.postalCode ?? ''} onChange={v => iF('postalCode', v)} />
                  <IField label="Ort" value={inlineForm.city ?? ''} onChange={v => iF('city', v)} />
                </div>
                <IField label="Bundesland" value={inlineForm.state ?? ''} onChange={v => iF('state', v)} />
                <IField label="Land" value={inlineForm.country ?? ''} onChange={v => iF('country', v)} />
                <IField label="Website" value={inlineForm.website ?? ''} onChange={v => iF('website', v)} placeholder="https://..." />
                <div className="grid grid-cols-2 gap-2">
                  <IField label="Latitude" value={inlineForm.latitude ?? ''} onChange={v => iF('latitude', v)} placeholder="48.137154" />
                  <IField label="Longitude" value={inlineForm.longitude ?? ''} onChange={v => iF('longitude', v)} placeholder="11.576124" />
                </div>
                <InlineSaveBar onSave={saveInlineSection} onCancel={cancelEditSection} saving={savingInline} error={inlineError} />
              </div>
            ) : venue ? (
              <>
                <KV label="Adresse" value={address || undefined} />
                {venue.website && (
                  <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1.5 border-b border-gray-50">
                    <span className="text-gray-400 font-medium text-xs uppercase tracking-wide leading-5">Website</span>
                    <a href={venue.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 truncate">
                      <Globe className="w-3 h-3 shrink-0" />{venue.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                {(venue.latitude || venue.longitude) && (
                  <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1.5 border-b border-gray-50">
                    <span className="text-gray-400 font-medium text-xs uppercase tracking-wide leading-5">GPS</span>
                    <a href={`https://maps.google.com/?q=${venue.latitude},${venue.longitude}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1">
                      <Navigation className="w-3 h-3 shrink-0" />{venue.latitude}, {venue.longitude}
                    </a>
                  </div>
                )}
                {!address && !venue.website && !venue.latitude && (
                  <p className="text-sm text-gray-400 py-2">Keine Angaben hinterlegt.</p>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Backstage & Logistics */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Navigation className="w-3.5 h-3.5 inline mr-1" />Backstage & Logistics</span>
            {isEditor && venue && editingSection !== 'backstage' && (
              <button onClick={() => startEditSection('backstage')} className="text-gray-400 hover:text-blue-600 transition-colors" title="Bearbeiten">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            : editingSection === 'backstage' ? (
              <div className="space-y-2">
                <IField label="Anfahrt (Notiz)" value={inlineForm.arrival ?? ''} onChange={v => iF('arrival', v)} />
                <IField label="Anfahrt – Straße" value={inlineForm.arrivalStreet ?? ''} onChange={v => iF('arrivalStreet', v)} />
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <IField label="PLZ" value={inlineForm.arrivalPostalCode ?? ''} onChange={v => iF('arrivalPostalCode', v)} />
                  <IField label="Ort" value={inlineForm.arrivalCity ?? ''} onChange={v => iF('arrivalCity', v)} />
                </div>
                <ITextarea label="Parkplatz" value={inlineForm.parking ?? ''} onChange={v => iF('parking', v)} />
                <ITextarea label="Nightliner" value={inlineForm.nightlinerParking ?? ''} onChange={v => iF('nightlinerParking', v)} />
                <ITextarea label="Ladeweg" value={inlineForm.loadingPath ?? ''} onChange={v => iF('loadingPath', v)} />
                <InlineSaveBar onSave={saveInlineSection} onCancel={cancelEditSection} saving={savingInline} error={inlineError} />
              </div>
            ) : venue ? (
              <>
                <KV label="Anfahrt" value={venue.arrival || undefined} />
                <KV label="Anfahrtsadresse" value={arrivalAddress || undefined} />
                <KV label="Parkplatz" value={venue.parking || undefined} />
                <KV label="Nightliner" value={venue.nightlinerParking || undefined} />
                <KV label="Ladeweg" value={venue.loadingPath || undefined} />
                {!venue.arrival && !arrivalAddress && !venue.parking && !venue.nightlinerParking && !venue.loadingPath && (
                  <p className="text-sm text-gray-400 py-2">Keine Angaben hinterlegt.</p>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Technische Specs */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Ruler className="w-3.5 h-3.5 inline mr-1" />Technische Specs</span>
            {isEditor && venue && editingSection !== 'technik' && (
              <button onClick={() => startEditSection('technik')} className="text-gray-400 hover:text-blue-600 transition-colors" title="Bearbeiten">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            : editingSection === 'technik' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <IField label="Kapazität (stehend)" value={inlineForm.capacity ?? ''} onChange={v => iF('capacity', v)} placeholder="z.B. 5000" />
                  <IField label="Kapazität (bestuhlt)" value={inlineForm.capacitySeated ?? ''} onChange={v => iF('capacitySeated', v)} placeholder="z.B. 3000" />
                </div>
                <div className="grid grid-cols-[2fr_1fr] gap-2">
                  <IField label="Bühnenmaße" value={inlineForm.stageDimensions ?? ''} onChange={v => iF('stageDimensions', v)} placeholder="z.B. 12x8m" />
                  <IField label="Lichte Höhe" value={inlineForm.clearanceHeight ?? ''} onChange={v => iF('clearanceHeight', v)} placeholder="z.B. 6m" />
                </div>
                <ITextarea label="WLAN" value={inlineForm.wifi ?? ''} onChange={v => iF('wifi', v)} placeholder="SSID / Passwort..." />
                <ITextarea label="Garderoben" value={inlineForm.wardrobe ?? ''} onChange={v => iF('wardrobe', v)} />
                <IField label="Duschen" value={inlineForm.showers ?? ''} onChange={v => iF('showers', v)} placeholder="z.B. 4 im Backstage" />
                <IField label="Merchandise Fee" value={inlineForm.merchandiseFee ?? ''} onChange={v => iF('merchandiseFee', v)} placeholder="z.B. 15%" />
                <ITextarea label="Merch-Stand" value={inlineForm.merchandiseStand ?? ''} onChange={v => iF('merchandiseStand', v)} />
                <ITextarea label="Notizen" value={inlineForm.notes ?? ''} onChange={v => iF('notes', v)} />
                <InlineSaveBar onSave={saveInlineSection} onCancel={cancelEditSection} saving={savingInline} error={inlineError} />
              </div>
            ) : venue ? (
              <>
                <KV label="Kapazität" value={[venue.capacity && `${venue.capacity} stehend`, venue.capacitySeated && `${venue.capacitySeated} bestuhlt`].filter(Boolean).join(' / ') || undefined} />
                <KV label="Bühnenmaße" value={venue.stageDimensions || undefined} />
                <KV label="Lichte Höhe" value={venue.clearanceHeight || undefined} />
                <KV label="WLAN" value={venue.wifi || undefined} />
                <KV label="Garderoben" value={venue.wardrobe || undefined} />
                <KV label="Duschen" value={venue.showers || undefined} />
                <KV label="Merchandise Fee" value={venue.merchandiseFee || undefined} />
                <KV label="Merch-Stand" value={venue.merchandiseStand || undefined} />
                <KV label="Notizen" value={venue.notes || undefined} />
                {!venue.capacity && !venue.stageDimensions && !venue.clearanceHeight && !venue.wifi && !venue.wardrobe && !venue.showers && !venue.merchandiseFee && !venue.merchandiseStand && !venue.notes && (
                  <p className="text-sm text-gray-400 py-2">Keine technischen Daten hinterlegt.</p>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Ansprechpartner */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><UserCircle className="w-3.5 h-3.5 inline mr-1" />Ansprechpartner</span>
            {isEditor && (
              <button onClick={startAddContact} className="text-gray-400 hover:text-blue-600 transition-colors" title="Hinzufügen">
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="pt-card-body">
            {contactsLoading ? (
              <div className="flex items-center justify-center h-16 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin mr-2" />Lade…</div>
            ) : (
              <>
                {venueContacts.map(c => (
                  editingContactId === c.id ? (
                    <ContactForm key={c.id}
                      form={contactForm} onChange={setContactForm}
                      onSave={saveContact} onCancel={() => setEditingContactId(null)}
                      saving={savingContact} />
                  ) : (
                    <div key={c.id} className="py-2 border-b border-gray-50 last:border-0 group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800">{c.name}</p>
                          {c.role && <p className="text-xs text-gray-500">{c.role}</p>}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            {c.phone && (
                              <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                <Phone className="w-2.5 h-2.5" />{c.phone}
                              </a>
                            )}
                            {c.email && (
                              <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                <Mail className="w-2.5 h-2.5" />{c.email}
                              </a>
                            )}
                          </div>
                          {c.notes && <p className="text-xs text-gray-400 mt-0.5">{c.notes}</p>}
                        </div>
                        {isEditor && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => startEditContact(c)} className="text-gray-400 hover:text-blue-600 p-0.5">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleDeleteContact(c.id)} className="text-gray-400 hover:text-red-600 p-0.5">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                ))}
                {addingContact && (
                  <ContactForm
                    form={contactForm} onChange={setContactForm}
                    onSave={saveContact} onCancel={() => setAddingContact(false)}
                    saving={savingContact} />
                )}
                {venueContacts.length === 0 && !addingContact && (
                  <div className="flex flex-col items-center justify-center h-16 text-gray-400">
                    <UserCircle className="w-5 h-5 mb-1" />
                    <span className="text-xs">Noch keine Ansprechpartner</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Fotos — 2-spaltig */}
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
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
                {photos.map((photo, idx) => (
                  <div key={photo.id} className="relative group aspect-square rounded overflow-hidden bg-gray-100 cursor-pointer"
                    onClick={() => lightbox.open(idx)}>
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

      {/* Danger Zone */}
      {isEditor && venue && (
        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={async () => {
              if (!confirm(`Spielstätte "${venue.name}" wirklich löschen?`)) return
              try {
                await fetch(`${API_BASE}/api/venues/${venueId}`, { method: 'DELETE', headers: authHeaders() })
                window.location.href = '/?tab=venues'
              } catch { alert('Löschen fehlgeschlagen') }
            }}
            className="btn btn-danger"
          >
            <Trash2 className="w-3.5 h-3.5" /> Spielstätte löschen
          </button>
        </div>
      )}

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

      {/* Lightbox — shared component */}
      <Lightbox {...lightbox.props} />

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

// ─── Inline Edit Helpers ──────────────────────────────────────────────────────
function IField({ label, value, onChange, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</label>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 bg-white"
      />
    </div>
  )
}

function ITextarea({ label, value, onChange, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</label>
      <textarea
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={2}
        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 bg-white resize-none"
      />
    </div>
  )
}

function InlineSaveBar({ onSave, onCancel, saving, error }: {
  onSave: () => void; onCancel: () => void; saving: boolean; error?: string
}) {
  return (
    <div className="pt-2 border-t border-gray-100 mt-2">
      {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Abbrechen</button>
        <button onClick={onSave} disabled={saving}
          className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Speichern
        </button>
      </div>
    </div>
  )
}

// ─── Contact Form (inline) ────────────────────────────────────────────────────
function ContactForm({ form, onChange, onSave, onCancel, saving }: {
  form: { name: string; role: string; phone: string; email: string; notes: string }
  onChange: (f: any) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  const f = (key: string, value: string) => onChange((prev: any) => ({ ...prev, [key]: value }))
  return (
    <div className="py-2 border-b border-gray-100 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={form.name} onChange={e => f('name', e.target.value)} placeholder="Name *"
          className="form-input text-xs py-1" />
        <input value={form.role} onChange={e => f('role', e.target.value)} placeholder="Funktion"
          className="form-input text-xs py-1" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="Telefon"
          className="form-input text-xs py-1" />
        <input value={form.email} onChange={e => f('email', e.target.value)} placeholder="E-Mail"
          className="form-input text-xs py-1" />
      </div>
      <input value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Notiz"
        className="form-input text-xs py-1 w-full" />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn btn-ghost text-xs py-1 px-2">Abbrechen</button>
        <button onClick={onSave} disabled={saving || !form.name.trim()} className="btn btn-primary text-xs py-1 px-2 disabled:opacity-50">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Speichern
        </button>
      </div>
    </div>
  )
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
