'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useT } from '@/app/lib/i18n/LanguageContext'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'
import {
  Upload, Trash2, X, AlertCircle, Plus, Save, Check,
  File, Globe, MapPin, Users, Ruler, ChevronDown, ChevronRight, Navigation,
  Image as ImageIcon, ExternalLink, Loader2, UserCircle, Phone, Mail, ArrowLeft,
} from 'lucide-react'
import { useLightbox, Lightbox } from '@/app/components/shared/Lightbox'
import {
  getAuthToken, getCurrentTenant, getCurrentUser,
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

// ─── Main Detail Component ────────────────────────────────────────────────────
export function VenueDetailContent({ venueId, onBack, headerRight }: { venueId: string; onBack?: () => void; headerRight?: React.ReactNode }) {
  const t = useT()
  const { layout } = useLayout()
  const isL2 = layout === 'L2'
  const isMobile = useIsMobile()

  const isEditor = isEditorRole(getEffectiveRole())
  const currentUser = getCurrentUser()
  const isSuperadmin = Boolean((currentUser as any)?.isSuperadmin)

  const [venue, setVenue] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editModalOpen, setEditModalOpen] = useState(false)

  // Always-editable form state
  const [form, setForm] = useState<Record<string, string>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showDirtyDialog, setShowDirtyDialog] = useState(false)
  const originalRef = useRef<Record<string, string>>({})

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

  const [photos, setPhotos] = useState<FileItem[]>([])
  const lightbox = useLightbox(photos, API_BASE, authHeaders)

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadType, setUploadType] = useState<'files' | 'photos'>('files')
  const [selectedCategory, setSelectedCategory] = useState<string>(VENUE_FILE_CATEGORIES[0])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Load data ────────────────────────────────────────────────────────────
  const loadVenue = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/venues/${venueId}`, { headers: authHeaders() })
      if (!res.ok) throw new Error(t('venues.notFound'))
      const data = await res.json()
      setVenue(data.venue)
      const d = data.venue as Record<string, string>
      setForm(d)
      originalRef.current = d
      setIsDirty(false)
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
    loadVenue()
    loadFiles()
    loadShows()
    loadContacts()
  }, [loadVenue, loadFiles, loadShows, loadContacts])

  // ─── File helpers ─────────────────────────────────────────────────────────
  const docs = files.filter(f => !f.mimeType.startsWith('image/'))
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
      const formData = new FormData()
      Array.from(fileList).forEach(f => formData.append('files', f))
      const res = await fetch(
        `${API_BASE}/api/files/venue/${venueId}?category=${encodeURIComponent(category)}`,
        { method: 'POST', headers: authHeaders(), body: formData }
      )
      if (!res.ok) throw new Error(t('general.uploadFailed'))
      await loadFiles()
      setShowUploadModal(false)
    } catch (e) {
      setUploadError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!confirm(t('general.fileDeleteConfirm'))) return
    try {
      await fetch(`${API_BASE}/api/files/${fileId}`, { method: 'DELETE', headers: authHeaders() })
      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch { alert(t('general.deleteFailed')) }
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
    } catch { alert(t('general.fileOpenError')) }
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
    if (!confirm(t('venues.deleteContactConfirm'))) return
    try {
      await deleteVenueContact(venueId, id)
      setVenueContacts(prev => prev.filter(c => c.id !== id))
    } catch { /* silent */ }
  }

  // ─── Form handlers ────────────────────────────────────────────────────────
  const f = (key: string, val: string) => {
    const next = { ...form, [key]: val }
    setForm(next)
    const orig = originalRef.current
    setIsDirty(Object.keys(next).some(k => next[k] !== (orig[k] ?? '')))
  }

  const cancelEdit = () => { setForm(originalRef.current); setIsDirty(false); setSaveError('') }

  const saveEdit = async (): Promise<boolean> => {
    if (!venue) return false
    setSaving(true); setSaveError('')
    try {
      const res = await fetch(`${API_BASE}/api/venues/${venueId}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(t('general.saveFailed'))
      const data = await res.json()
      setVenue(data.venue)
      const d = data.venue as Record<string, string>
      setForm(d)
      originalRef.current = d
      setIsDirty(false)
      window.dispatchEvent(new CustomEvent('venue-updated', { detail: data.venue }))
      return true
    } catch (e) {
      setSaveError((e as Error).message || 'Speichern fehlgeschlagen')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => { if (isDirty) setShowDirtyDialog(true); else onBack?.() }

  useEffect(() => {
    ;(window as any).__pt_isDirty = isDirty
    return () => { ;(window as any).__pt_isDirty = false }
  }, [isDirty])

  useEffect(() => {
    ;(window as any).__pt_save = saveEdit
    return () => { ;(window as any).__pt_save = null }
  })

  const ro = !isEditor
  const titleColor = isL2 ? '#e0e0e0' : '#111827'
  const dirtyColor = isL2 ? '#b0b0b0' : '#6b7280'

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="module-content">
      {onBack && (
        <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Übersicht
        </button>
      )}
      {/* Header */}
      <div className="flex items-center justify-between" style={{ minHeight: '32px', gap: '12px' }}>
        <h2 style={{ color: titleColor, fontSize: '17px', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loading ? '' : (form.name || venue?.name || '')}
        </h2>
        {isDirty ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '12px', color: dirtyColor }}>Ungespeicherte Änderungen</span>
            <button onClick={cancelEdit}
              style={{ padding: '5px 12px', fontSize: '13px', color: dirtyColor, background: 'none', border: `1px solid ${isL2 ? '#555' : '#d1d5db'}`, borderRadius: '4px', cursor: 'pointer' }}>
              <X className="w-3 h-3 inline mr-1" />{t('general.cancel')}
            </button>
            <button onClick={saveEdit} disabled={saving}
              style={{ padding: '5px 12px', fontSize: '13px', fontWeight: 500, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '5px' }}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {t('general.save')}
            </button>
          </div>
        ) : headerRight ? (
          <div style={{ flexShrink: 0 }}>{headerRight}</div>
        ) : null}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}
      {saveError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />{saveError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Spielstätte */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><MapPin className="w-3.5 h-3.5 inline mr-1" />{t('venues.cardVenue')}</span>
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            : (
              <div className="space-y-2">
                <IField label={t('general.name')} value={form.name ?? ''} onChange={v => f('name', v)} readOnly={ro} />
                <IField label={t('address.street')} value={form.street ?? ''} onChange={v => f('street', v)} readOnly={ro} />
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <IField label={t('address.postalCode')} value={form.postalCode ?? ''} onChange={v => f('postalCode', v)} readOnly={ro} />
                  <IField label={t('address.city')} value={form.city ?? ''} onChange={v => f('city', v)} readOnly={ro} />
                </div>
                <IField label={t('address.state')} value={form.state ?? ''} onChange={v => f('state', v)} readOnly={ro} />
                <IField label={t('address.country')} value={form.country ?? ''} onChange={v => f('country', v)} readOnly={ro} />
                <IField label={t('general.website')} value={form.website ?? ''} onChange={v => f('website', v)} placeholder="https://..." readOnly={ro} />
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('address.latitude')} value={form.latitude ?? ''} onChange={v => f('latitude', v)} placeholder="48.137154" readOnly={ro} />
                  <IField label={t('address.longitude')} value={form.longitude ?? ''} onChange={v => f('longitude', v)} placeholder="11.576124" readOnly={ro} />
                </div>
                {(form.latitude || form.longitude) && (
                  <a href={`https://maps.google.com/?q=${form.latitude},${form.longitude}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1">
                    <Navigation className="w-3 h-3" />Google Maps
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Backstage & Logistics */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Navigation className="w-3.5 h-3.5 inline mr-1" />{t('venues.cardBackstage')}</span>
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            : (
              <div className="space-y-2">
                <IField label={t('address.arrivalNote')} value={form.arrival ?? ''} onChange={v => f('arrival', v)} readOnly={ro} />
                <IField label={t('address.arrivalStreet')} value={form.arrivalStreet ?? ''} onChange={v => f('arrivalStreet', v)} readOnly={ro} />
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <IField label={t('address.arrivalPostalCode')} value={form.arrivalPostalCode ?? ''} onChange={v => f('arrivalPostalCode', v)} readOnly={ro} />
                  <IField label={t('address.arrivalCity')} value={form.arrivalCity ?? ''} onChange={v => f('arrivalCity', v)} readOnly={ro} />
                </div>
                <ITextarea label={t('venues.parking')} value={form.parking ?? ''} onChange={v => f('parking', v)} readOnly={ro} />
                <ITextarea label={t('venues.nightliner')} value={form.nightlinerParking ?? ''} onChange={v => f('nightlinerParking', v)} readOnly={ro} />
                <ITextarea label={t('venues.loadingPath')} value={form.loadingPath ?? ''} onChange={v => f('loadingPath', v)} readOnly={ro} />
              </div>
            )}
          </div>
        </div>

        {/* Technische Specs */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Ruler className="w-3.5 h-3.5 inline mr-1" />{t('venues.cardTech')}</span>
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('venues.capacityStanding')} value={form.capacity ?? ''} onChange={v => f('capacity', v)} placeholder="z.B. 5000" readOnly={ro} />
                  <IField label={t('venues.capacitySeated')} value={form.capacitySeated ?? ''} onChange={v => f('capacitySeated', v)} placeholder="z.B. 3000" readOnly={ro} />
                </div>
                <div className="grid grid-cols-[2fr_1fr] gap-2">
                  <IField label={t('venues.stageDimensions')} value={form.stageDimensions ?? ''} onChange={v => f('stageDimensions', v)} placeholder="z.B. 12x8m" readOnly={ro} />
                  <IField label={t('venues.clearanceHeight')} value={form.clearanceHeight ?? ''} onChange={v => f('clearanceHeight', v)} placeholder="z.B. 6m" readOnly={ro} />
                </div>
                <ITextarea label={t('venues.wifiShort')} value={form.wifi ?? ''} onChange={v => f('wifi', v)} placeholder="SSID / Passwort..." readOnly={ro} />
                <ITextarea label={t('venues.wardrobe')} value={form.wardrobe ?? ''} onChange={v => f('wardrobe', v)} readOnly={ro} />
                <IField label={t('venues.showers')} value={form.showers ?? ''} onChange={v => f('showers', v)} placeholder="z.B. 4 im Backstage" readOnly={ro} />
                <IField label={t('venues.merchandiseFeeShort')} value={form.merchandiseFee ?? ''} onChange={v => f('merchandiseFee', v)} placeholder="z.B. 15%" readOnly={ro} />
                <ITextarea label={t('venues.merchandiseStandShort')} value={form.merchandiseStand ?? ''} onChange={v => f('merchandiseStand', v)} readOnly={ro} />
                <ITextarea label={t('venues.notesTitle')} value={form.notes ?? ''} onChange={v => f('notes', v)} readOnly={ro} />
              </div>
            )}
          </div>
        </div>

        {/* Ansprechpartner */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><UserCircle className="w-3.5 h-3.5 inline mr-1" />{t('venues.cardContacts')}</span>
            {isEditor && <button onClick={startAddContact} className="text-gray-400 hover:text-blue-600 transition-colors"><Plus className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="pt-card-body">
            {contactsLoading ? (
              <div className="flex items-center justify-center h-16 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin mr-2" />{t('general.loadingShort')}</div>
            ) : (
              <>
                {venueContacts.map(c => (
                  editingContactId === c.id ? (
                    <ContactForm key={c.id} form={contactForm} onChange={setContactForm}
                      onSave={saveContact} onCancel={() => setEditingContactId(null)} saving={savingContact} />
                  ) : (
                    <div key={c.id} className="py-2 border-b border-gray-50 last:border-0 group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800">{c.name}</p>
                          {c.role && <p className="text-xs text-gray-500">{c.role}</p>}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><Phone className="w-2.5 h-2.5" />{c.phone}</a>}
                            {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><Mail className="w-2.5 h-2.5" />{c.email}</a>}
                          </div>
                          {c.notes && <p className="text-xs text-gray-400 mt-0.5">{c.notes}</p>}
                        </div>
                        {isEditor && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => startEditContact(c)} className="text-gray-400 hover:text-blue-600 p-0.5"><File className="w-3 h-3" /></button>
                            <button onClick={() => handleDeleteContact(c.id)} className="text-gray-400 hover:text-red-600 p-0.5"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                ))}
                {addingContact && (
                  <ContactForm form={contactForm} onChange={setContactForm}
                    onSave={saveContact} onCancel={() => setAddingContact(false)} saving={savingContact} />
                )}
                {venueContacts.length === 0 && !addingContact && (
                  <div className="flex flex-col items-center justify-center h-16 text-gray-400">
                    <UserCircle className="w-5 h-5 mb-1" />
                    <span className="text-xs">{t('venues.noContactsYet')}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Fotos */}
        <div className="pt-card md:col-span-2">
          <div className="pt-card-header">
            <span className="pt-card-title"><ImageIcon className="w-3.5 h-3.5 inline mr-1" />{t('venues.cardPhotos')}</span>
            {isEditor && <button onClick={() => { setUploadType('photos'); setShowUploadModal(true) }} className="text-gray-400 hover:text-blue-600 transition-colors"><Upload className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="pt-card-body">
            {filesLoading ? (
              <div className="flex items-center justify-center h-16 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin mr-2" />{t('general.loadingShort')}</div>
            ) : photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-20 text-gray-400"><ImageIcon className="w-6 h-6 mb-1" /><span className="text-xs">{t('venues.noPhotos')}</span></div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
                {photos.map((photo, idx) => (
                  <div key={photo.id} className="relative group aspect-square rounded overflow-hidden bg-gray-100 cursor-pointer" onClick={() => lightbox.open(idx)}>
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
            <span className="pt-card-title"><File className="w-3.5 h-3.5 inline mr-1" />{t('venues.cardDocs')}</span>
            {isEditor && <button onClick={() => { setUploadType('files'); setShowUploadModal(true) }} className="text-gray-400 hover:text-blue-600 transition-colors"><Upload className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="pt-card-body">
            {filesLoading ? (
              <div className="flex items-center justify-center h-16 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin mr-2" />{t('general.loadingShort')}</div>
            ) : Object.keys(docsByCategory).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-20 text-gray-400"><File className="w-6 h-6 mb-1" /><span className="text-xs">{t('venues.noDocs')}</span></div>
            ) : (
              Object.entries(docsByCategory).map(([cat, catFiles]) => (
                <DocCategorySection key={cat} category={cat} files={catFiles}
                  onDelete={isEditor ? handleDeleteFile : undefined} onOpen={openFile} />
              ))
            )}
          </div>
        </div>

        {/* Shows */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Users className="w-3.5 h-3.5 inline mr-1" />{t('venues.cardShows')}</span>
          </div>
          <div className="pt-card-body">
            {showsLoading ? (
              <div className="flex items-center justify-center h-16 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin mr-2" />{t('general.loadingShort')}</div>
            ) : shows.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">{t('venues.noShows')}</p>
            ) : (
              <div className="space-y-0.5">
                {shows.map(show => (
                  <div key={show.id}
                    className="flex items-center justify-between py-1.5 px-1 rounded hover:bg-gray-50 cursor-pointer group"
                    onClick={() => window.dispatchEvent(new CustomEvent('select-termin', { detail: { id: show.id, view: 'details' } }))}>
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
              <span className="modal-title">{uploadType === 'photos' ? t('venues.photoUpload') : t('venues.docUpload')}</span>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="modal-body space-y-4">
              {uploadType === 'files' && (
                <div>
                  <label className="form-label">{t('venues.category')}</label>
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
                <p className="text-sm text-gray-600">{t('general.uploadHint')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('general.uploadMaxSize')}</p>
                <input ref={fileInputRef} type="file" multiple
                  accept={uploadType === 'photos' ? 'image/*' : undefined}
                  className="hidden" onChange={e => handleUpload(e.target.files)} />
              </div>
              {uploading && <div className="flex items-center gap-2 text-sm text-blue-600"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />{t('general.uploading')}</div>}
              {uploadError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{uploadError}</div>}
            </div>
          </div>
        </div>
      )}

      <Lightbox {...lightbox.props} />

      {editModalOpen && venue && (
        <VenueModal
          venue={venue}
          onClose={() => setEditModalOpen(false)}
          onSaved={updated => { setVenue(updated); setEditModalOpen(false); window.dispatchEvent(new CustomEvent('venue-updated', { detail: updated })) }}
          onDeleted={() => { window.location.href = '/?tab=venues' }}
        />
      )}

      {showDirtyDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: isL2 ? '#2a2a2a' : '#fff', borderRadius: '8px', padding: '24px', maxWidth: '360px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ color: titleColor, fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Ungespeicherte Änderungen</h3>
            <p style={{ color: dirtyColor, fontSize: '14px', marginBottom: '20px' }}>Möchtest du die Änderungen speichern oder verwerfen?</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDirtyDialog(false)}
                style={{ padding: '8px 16px', fontSize: '13px', color: dirtyColor, background: 'none', border: `1px solid ${isL2 ? '#555' : '#d1d5db'}`, borderRadius: '4px', cursor: 'pointer' }}>
                Abbrechen
              </button>
              <button onClick={() => { setShowDirtyDialog(false); cancelEdit(); onBack?.() }}
                style={{ padding: '8px 16px', fontSize: '13px', color: dirtyColor, background: 'none', border: `1px solid ${isL2 ? '#555' : '#d1d5db'}`, borderRadius: '4px', cursor: 'pointer' }}>
                Verwerfen
              </button>
              <button onClick={async () => { const ok = await saveEdit(); if (ok) { setShowDirtyDialog(false); onBack?.() } }} disabled={saving}
                style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
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

function IField({ label, value, onChange, placeholder = '', readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="detail-label">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        readOnly={readOnly} className="detail-input" />
    </div>
  )
}

function ITextarea({ label, value, onChange, placeholder = '', readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="detail-label">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2}
        readOnly={readOnly} className="detail-input resize-none" />
    </div>
  )
}

function ContactForm({ form, onChange, onSave, onCancel, saving }: {
  form: { name: string; role: string; phone: string; email: string; notes: string }
  onChange: (f: any) => void; onSave: () => void; onCancel: () => void; saving: boolean
}) {
  const t = useT()
  const f = (key: string, value: string) => onChange((prev: any) => ({ ...prev, [key]: value }))
  return (
    <div className="py-2 border-b border-gray-100 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={form.name} onChange={e => f('name', e.target.value)} placeholder={`${t('general.name')} *`} className="form-input text-xs py-1" />
        <input value={form.role} onChange={e => f('role', e.target.value)} placeholder={t('venues.contactRole')} className="form-input text-xs py-1" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={form.phone} onChange={e => f('phone', e.target.value)} placeholder={t('general.phone')} className="form-input text-xs py-1" />
        <input value={form.email} onChange={e => f('email', e.target.value)} placeholder={t('general.email')} className="form-input text-xs py-1" />
      </div>
      <input value={form.notes} onChange={e => f('notes', e.target.value)} placeholder={t('venues.contactNote')} className="form-input text-xs py-1 w-full" />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn btn-ghost text-xs py-1 px-2">{t('general.cancel')}</button>
        <button onClick={onSave} disabled={saving || !form.name.trim()} className="btn btn-primary text-xs py-1 px-2 disabled:opacity-50">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} {t('general.save')}
        </button>
      </div>
    </div>
  )
}

function DocCategorySection({ category, files, onDelete, onOpen }: {
  category: string; files: FileItem[]; onDelete?: (id: string) => void; onOpen: (f: FileItem) => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-2 py-2 hover:bg-gray-50 transition-colors">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{category} <span className="text-gray-400 font-normal normal-case">({files.length})</span></span>
        {open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-1">
          {files.map(file => (
            <div key={file.id} className="flex items-center justify-between py-1 px-1 rounded hover:bg-gray-50">
              <button onClick={() => onOpen(file)} className="flex items-center gap-1.5 flex-1 text-left truncate hover:text-blue-600 transition-colors">
                <span className="text-base leading-none">{fileIcon(file.mimeType)}</span>
                <span className="truncate text-xs">{file.originalName}</span>
              </button>
              <div className="flex items-center gap-1 ml-2 shrink-0">
                <span className="text-xs text-gray-400">{formatSize(file.size)}</span>
                {onDelete && <button onClick={() => onDelete(file.id)} className="text-gray-400 hover:text-red-600 p-0.5 rounded"><Trash2 size={11} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
