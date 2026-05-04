'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Loader2, Pencil, Save, Check, X, AlertCircle,
  MapPin, Navigation, Ruler, UserCircle, FileIcon,
  Image as ImageIcon, Globe, Phone, Mail, Plus, Trash2, Upload,
} from 'lucide-react'
import {
  getVenue, getVenues, createVenue, updateTermin, getAuthToken, getCurrentTenant, isEditorRole, getEffectiveRole,
  getVenueContacts, createVenueContact, updateVenueContact, deleteVenueContact,
  type Venue, type VenueContact, type Termin,
} from '@/lib/api-client'
import { useLightbox, Lightbox } from '@/app/components/shared/Lightbox'

// ─── API ───────────────────────────────────────────────────────────────────────
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

// ─── Types ─────────────────────────────────────────────────────────────────────
interface VenueFile {
  id: string
  category: string
  originalName: string
  mimeType: string
  size: number
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatSize(bytes: number) {
  if (!bytes) return ''
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`
}

function fileIcon(mime: string): string {
  if (mime?.startsWith('image/')) return '🖼️'
  if (mime?.includes('pdf')) return '📄'
  if (mime?.includes('word') || mime?.includes('document')) return '📝'
  if (mime?.includes('excel') || mime?.includes('spreadsheet')) return '📊'
  return '📎'
}

// ─── KV row ────────────────────────────────────────────────────────────────────
function KV({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-400 font-medium text-xs uppercase tracking-wide leading-5">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  )
}

// ─── Inline Edit Helpers ───────────────────────────────────────────────────────
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

// ─── New Venue Inline Form ────────────────────────────────────────────────────
function NewVenueInlineForm({ form, onChange, onSave, onCancel, saving, error }: {
  form: { name: string; city: string; postalCode: string; country: string }
  onChange: (f: { name: string; city: string; postalCode: string; country: string }) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string
}) {
  const s = (key: string, value: string) => onChange({ ...form, [key]: value })
  return (
    <div className="space-y-2 p-2 bg-gray-50 rounded-lg border border-blue-200">
      <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Neues Venue</p>
      <input autoFocus type="text" placeholder="Name *" value={form.name}
        onChange={e => s('name', e.target.value)}
        className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
      <div className="grid grid-cols-[72px_1fr] gap-1.5">
        <input type="text" placeholder="PLZ" value={form.postalCode}
          onChange={e => s('postalCode', e.target.value)}
          className="px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
        <input type="text" placeholder="Stadt" value={form.city}
          onChange={e => s('city', e.target.value)}
          className="px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
      </div>
      <input type="text" placeholder="Land" value={form.country}
        onChange={e => s('country', e.target.value)}
        className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Abbrechen</button>
        <button onClick={onSave} disabled={saving || !form.name.trim()}
          className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Anlegen & verknüpfen
        </button>
      </div>
    </div>
  )
}

// ─── Contact Form (inline) ─────────────────────────────────────────────────────
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

// ─── Auth Image (for photos) ───────────────────────────────────────────────────
function AuthImage({ fileId, alt, className }: { fileId: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let url: string
    fetch(`${API_BASE}/api/files/download/${fileId}`, { headers: authHeaders() })
      .then(r => r.blob())
      .then(blob => { url = URL.createObjectURL(blob); setSrc(url) })
      .catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [fileId])
  if (!src) return <div className={`${className} bg-gray-100 flex items-center justify-center`}><Loader2 size={14} className="animate-spin text-gray-300" /></div>
  return <img src={src} alt={alt} className={className} />
}

// ─── Main Component ────────────────────────────────────────────────────────────
interface VenueInfoSectionProps {
  venueId?: number | string | null
  venueName?: string
  isAdmin?: boolean
  // Optionale Termin-Verlinkung
  termin?: Termin
  onTerminUpdated?: (t: Termin) => void
}

type EditSection = 'spielstaette' | 'backstage' | 'technik'

export default function VenueInfoSection({ venueId, venueName, isAdmin, termin, onTerminUpdated }: VenueInfoSectionProps) {
  const isEditor = isAdmin ?? isEditorRole(getEffectiveRole())
  const id = venueId ? String(venueId) : ''

  const [venue, setVenue] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(!!venueId)

  // Venue-Verlinkung
  const [allVenues, setAllVenues] = useState<Venue[]>([])
  const [selecting, setSelecting] = useState(false)
  const [search, setSearch] = useState('')
  const [linkSaving, setLinkSaving] = useState(false)

  // Inline Venue-Erstellung
  const [creatingNew, setCreatingNew] = useState(false)
  const [newVenueForm, setNewVenueForm] = useState({ name: '', city: '', postalCode: '', country: '' })
  const [savingNew, setSavingNew] = useState(false)
  const [newVenueError, setNewVenueError] = useState('')

  // Inline edit
  const [editingSection, setEditingSection] = useState<EditSection | null>(null)
  const [inlineForm, setInlineForm] = useState<Record<string, string>>({})
  const [savingInline, setSavingInline] = useState(false)
  const [inlineError, setInlineError] = useState('')

  // Contacts
  const [venueContacts, setVenueContacts] = useState<VenueContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [addingContact, setAddingContact] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [contactForm, setContactForm] = useState({ name: '', role: '', phone: '', email: '', notes: '' })
  const [savingContact, setSavingContact] = useState(false)

  // Files
  const [files, setFiles] = useState<VenueFile[]>([])
  const [filesLoading, setFilesLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [docCategory, setDocCategory] = useState('Sonstiges')
  const photoInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  // Photos for lightbox (derived from files)
  const photos = files.filter(f => f.mimeType?.startsWith('image/'))
  const docs = files.filter(f => !f.mimeType?.startsWith('image/'))
  const lightbox = useLightbox(photos, API_BASE, authHeaders)

  // ─── Load ──────────────────────────────────────────────────────────────────
  const loadVenue = useCallback(async () => {
    if (!id) { setLoading(false); return }
    try {
      const v = await getVenue(id)
      setVenue(v)
      setInlineForm({ ...(v as any) })
    } catch { setVenue(null) }
    finally { setLoading(false) }
  }, [id])

  // Alle Venues laden wenn Verlinkung aktiv ist
  useEffect(() => {
    if (termin) getVenues().then(setAllVenues).catch(() => {})
  }, [termin])

  const loadContacts = useCallback(async () => {
    try {
      const c = await getVenueContacts(id)
      setVenueContacts(c)
    } catch { /* silent */ }
    finally { setContactsLoading(false) }
  }, [id])

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/files/venue/${id}`, { headers: authHeaders() })
      if (!res.ok) return
      const data = await res.json()
      setFiles((data.files ?? []).map((f: any) => ({
        id: f.id,
        category: f.category,
        originalName: f.originalName || f.original_name,
        mimeType: f.mimeType || f.mime_type,
        size: f.size,
      })))
    } catch { /* silent */ }
    finally { setFilesLoading(false) }
  }, [id])

  useEffect(() => {
    if (id) {
      loadVenue()
      loadContacts()
      loadFiles()
    }
  }, [id, loadVenue, loadContacts, loadFiles])

  // ─── Upload ────────────────────────────────────────────────────────────────
  async function handleUpload(fileList: FileList | null, category: string) {
    if (!fileList || fileList.length === 0 || !id) return
    setUploadError('')
    setUploading(true)
    try {
      const form = new FormData()
      Array.from(fileList).forEach(f => form.append('files', f))
      const res = await fetch(
        `${API_BASE}/api/files/venue/${id}?category=${encodeURIComponent(category)}`,
        { method: 'POST', headers: authHeaders(), body: form }
      )
      if (!res.ok) throw new Error('Upload fehlgeschlagen')
      await loadFiles()
    } catch (e) {
      setUploadError((e as Error).message || 'Upload fehlgeschlagen')
    } finally {
      setUploading(false)
    }
  }

  // ─── Venue linking ─────────────────────────────────────────────────────────
  const filteredVenues = allVenues.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.city.toLowerCase().includes(search.toLowerCase())
  )

  async function linkVenue(v: Venue | null) {
    if (!termin || !onTerminUpdated) return
    setLinkSaving(true)
    try {
      const updated = await updateTermin(termin.id, {
        date: termin.date,
        title: termin.title,
        art: termin.art || '',
        art_sub: termin.artSub || '',
        status_booking: termin.statusBooking || 'Idee',
        status_public: termin.statusPublic || 'nicht öffentlich',
        show_title_as_header: termin.showTitleAsHeader || false,
        city: v ? v.city : termin.city,
        venue_id: v ? Number(v.id) : null,
        partner_id: termin.partnerId ?? null,
        announcement: termin.announcement,
        capacity: termin.capacity ?? null,
        notes: termin.notes,
      })
      onTerminUpdated(updated)
      setSelecting(false)
      setSearch('')
    } catch { /* silent */ }
    finally { setLinkSaving(false) }
  }

  async function createAndLink() {
    if (!newVenueForm.name.trim()) { setNewVenueError('Name ist erforderlich'); return }
    setSavingNew(true)
    setNewVenueError('')
    try {
      const created = await createVenue({
        name: newVenueForm.name.trim(),
        city: newVenueForm.city.trim(),
        postalCode: newVenueForm.postalCode.trim(),
        country: newVenueForm.country.trim(),
        street: '', state: '', website: '', latitude: '', longitude: '',
        arrival: '', arrivalStreet: '', arrivalPostalCode: '', arrivalCity: '',
        parking: '', nightlinerParking: '', loadingPath: '',
        capacity: '', capacitySeated: '', stageDimensions: '', clearanceHeight: '',
        wifi: '', wardrobe: '', showers: '', merchandiseFee: '', merchandiseStand: '', notes: '',
      })
      setAllVenues(prev => [...prev, created])
      await linkVenue(created)
      setCreatingNew(false)
      setNewVenueForm({ name: '', city: '', postalCode: '', country: '' })
    } catch (e) {
      setNewVenueError((e as Error).message || 'Erstellen fehlgeschlagen')
    } finally {
      setSavingNew(false)
    }
  }

  function startCreatingNew() {
    setCreatingNew(true)
    setNewVenueForm({ name: search, city: '', postalCode: '', country: '' })
    setNewVenueError('')
  }

  function cancelCreatingNew() {
    setCreatingNew(false)
    setNewVenueForm({ name: '', city: '', postalCode: '', country: '' })
    setNewVenueError('')
  }

  // ─── Inline edit handlers ──────────────────────────────────────────────────
  function startEditSection(section: EditSection) {
    if (venue) setInlineForm({ ...(venue as any) })
    setInlineError('')
    setEditingSection(section)
  }
  function cancelEditSection() {
    if (venue) setInlineForm({ ...(venue as any) })
    setEditingSection(null)
    setInlineError('')
  }
  async function saveInlineSection() {
    if (!venue) return
    setSavingInline(true)
    setInlineError('')
    try {
      const res = await fetch(`${API_BASE}/api/venues/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(inlineForm),
      })
      if (!res.ok) throw new Error('Speichern fehlgeschlagen')
      const data = await res.json()
      setVenue(data.venue)
      setInlineForm({ ...(data.venue as any) })
      setEditingSection(null)
    } catch (e) {
      setInlineError((e as Error).message || 'Speichern fehlgeschlagen')
    } finally {
      setSavingInline(false)
    }
  }
  const iF = (key: string, value: string) => setInlineForm(prev => ({ ...prev, [key]: value }))

  // ─── Contact handlers ──────────────────────────────────────────────────────
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
        const updated = await updateVenueContact(id, editingContactId, contactForm)
        setVenueContacts(prev => prev.map(c => c.id === editingContactId ? updated : c))
      } else {
        const created = await createVenueContact(id, contactForm)
        setVenueContacts(prev => [...prev, created])
      }
      setAddingContact(false)
      setEditingContactId(null)
    } catch { /* silent */ }
    finally { setSavingContact(false) }
  }
  async function handleDeleteContact(cid: string) {
    if (!confirm('Ansprechpartner löschen?')) return
    try {
      await deleteVenueContact(id, cid)
      setVenueContacts(prev => prev.filter(c => c.id !== cid))
    } catch { /* silent */ }
  }

  // ─── Computed ──────────────────────────────────────────────────────────────
  const address = venue ? [
    venue.street,
    [venue.postalCode, venue.city].filter(Boolean).join(' '),
    venue.state,
    venue.country,
  ].filter(Boolean).join(', ') : ''

  const arrivalAddress = venue ? [
    venue.arrivalStreet,
    [venue.arrivalPostalCode, venue.arrivalCity].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ') : ''

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
      <Loader2 size={14} className="animate-spin" /> Venue-Daten werden geladen…
    </div>
  )

  // Kein Venue verknüpft → Selektor oder Leerstate
  if (!venue || !id) {
    if (!termin) return <div className="text-sm text-gray-400 py-4">Kein Venue verknüpft</div>
    return (
      <div className="pt-card">
        <div className="px-5 py-4">
          {selecting ? (
            <div className="space-y-2">
              {!creatingNew && (
                <input type="text" autoFocus placeholder="Venue suchen…"
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              )}
              {creatingNew ? (
                <NewVenueInlineForm
                  form={newVenueForm} onChange={setNewVenueForm}
                  onSave={createAndLink} onCancel={cancelCreatingNew}
                  saving={savingNew} error={newVenueError} />
              ) : (
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                    {filteredVenues.length === 0
                      ? <div className="px-3 py-3 text-xs text-gray-400 text-center">Keine Venues gefunden</div>
                      : filteredVenues.map(v => (
                        <button key={v.id} onClick={() => linkVenue(v)} disabled={linkSaving}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors">
                          <div className="font-medium text-gray-800">{v.name}</div>
                          {v.city && <div className="text-xs text-gray-400">{[v.postalCode, v.city].filter(Boolean).join(' ')}</div>}
                        </button>
                      ))
                    }
                  </div>
                  {isEditor && (
                    <button onClick={startCreatingNew}
                      className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1.5">
                      <Plus size={11} />
                      {search.trim() ? `„${search.trim()}" als neues Venue anlegen` : 'Neues Venue anlegen'}
                    </button>
                  )}
                </div>
              )}
              {!creatingNew && (
                <button onClick={() => { setSelecting(false); setSearch(''); setCreatingNew(false) }}
                  className="text-xs text-gray-400 hover:text-gray-600">Abbrechen</button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <MapPin className="w-6 h-6 text-gray-300" />
              <p className="text-sm text-gray-400">Kein Venue verknüpft</p>
              {isEditor && (
                <button onClick={() => setSelecting(true)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
                  <Plus className="w-3.5 h-3.5" /> Venue verknüpfen
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Venue verknüpft → normaler Tile-View mit Ändern-Option im Header
  const canLink = !!termin && !!onTerminUpdated && isEditor

  return (
    <>
      <div className="flex items-center justify-between px-0.5 mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Venue
        </span>
        {canLink && !selecting && (
          <button onClick={() => setSelecting(true)}
            className="text-xs text-gray-400 hover:text-blue-600 transition-colors">
            Ändern
          </button>
        )}
        {canLink && selecting && (
          <button onClick={() => { setSelecting(false); setSearch(''); setCreatingNew(false) }}
            className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
        )}
      </div>

      {/* Venue-Selektor wenn aktiv */}
      {selecting && (
        <div className="mb-4 p-3 bg-white border border-gray-200 rounded-lg space-y-2">
          {!creatingNew && (
            <input type="text" autoFocus placeholder="Venue suchen…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          )}
          {creatingNew ? (
            <NewVenueInlineForm
              form={newVenueForm} onChange={setNewVenueForm}
              onSave={createAndLink} onCancel={cancelCreatingNew}
              saving={savingNew} error={newVenueError} />
          ) : (
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                {termin?.venueId && (
                  <button onClick={() => linkVenue(null)} disabled={linkSaving}
                    className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors">
                    Venue-Verknüpfung entfernen
                  </button>
                )}
                {filteredVenues.length === 0
                  ? <div className="px-3 py-3 text-xs text-gray-400 text-center">Keine Venues gefunden</div>
                  : filteredVenues.map(v => (
                    <button key={v.id} onClick={() => linkVenue(v)} disabled={linkSaving}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${Number(v.id) === termin?.venueId ? 'bg-blue-50 font-medium' : ''}`}>
                      <div className="font-medium text-gray-800">{v.name}</div>
                      {v.city && <div className="text-xs text-gray-400">{[v.postalCode, v.city].filter(Boolean).join(' ')}</div>}
                    </button>
                  ))
                }
              </div>
              {isEditor && (
                <button onClick={startCreatingNew}
                  className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1.5">
                  <Plus size={11} />
                  {search.trim() ? `„${search.trim()}" als neues Venue anlegen` : 'Neues Venue anlegen'}
                </button>
              )}
            </div>
          )}
          {!creatingNew && linkSaving && (
            <div className="flex items-center gap-1 text-xs text-gray-400"><Loader2 size={11} className="animate-spin" /> Wird gespeichert…</div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Spielstätte */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><MapPin className="w-3.5 h-3.5 inline mr-1" />Spielstätte</span>
            {isEditor && editingSection !== 'spielstaette' && (
              <button onClick={() => startEditSection('spielstaette')}
                className="text-gray-400 hover:text-blue-600 transition-colors" title="Bearbeiten">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="pt-card-body">
            {editingSection === 'spielstaette' ? (
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
            ) : (
              <>
                {venue.name && (
                  <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1.5 border-b border-gray-50">
                    <span className="text-gray-400 font-medium text-xs uppercase tracking-wide leading-5">Name</span>
                    <span className="text-gray-800 font-semibold">{venue.name}</span>
                  </div>
                )}
                <KV label="Straße" value={venue.street || undefined} />
                <KV label="PLZ / Ort" value={[venue.postalCode, venue.city].filter(Boolean).join(' ') || undefined} />
                <KV label="Bundesland" value={venue.state || undefined} />
                <KV label="Land" value={venue.country || undefined} />
                {venue.website && (
                  <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1.5 border-b border-gray-50">
                    <span className="text-gray-400 font-medium text-xs uppercase tracking-wide leading-5">Website</span>
                    <a href={venue.website} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1 truncate">
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
                {!venue.name && !venue.street && !venue.city && !venue.postalCode && !venue.state && !venue.country && !venue.website && !venue.latitude && !venue.longitude && (
                  <p className="text-sm text-gray-400 py-2">Keine Angaben hinterlegt.</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Backstage & Logistics */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Navigation className="w-3.5 h-3.5 inline mr-1" />Backstage & Logistics</span>
            {isEditor && editingSection !== 'backstage' && (
              <button onClick={() => startEditSection('backstage')}
                className="text-gray-400 hover:text-blue-600 transition-colors" title="Bearbeiten">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="pt-card-body">
            {editingSection === 'backstage' ? (
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
            ) : (
              <>
                <KV label="Anfahrt" value={venue.arrival || undefined} />
                <KV label="Anfahrt – Straße" value={venue.arrivalStreet || undefined} />
                <KV label="Anfahrt – PLZ / Ort" value={[venue.arrivalPostalCode, venue.arrivalCity].filter(Boolean).join(' ') || undefined} />
                <KV label="Parkplatz" value={venue.parking || undefined} />
                <KV label="Nightliner" value={venue.nightlinerParking || undefined} />
                <KV label="Ladeweg" value={venue.loadingPath || undefined} />
                {!venue.arrival && !venue.arrivalStreet && !venue.arrivalPostalCode && !venue.arrivalCity && !venue.parking && !venue.nightlinerParking && !venue.loadingPath && (
                  <p className="text-sm text-gray-400 py-2">Keine Angaben hinterlegt.</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Technische Specs */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Ruler className="w-3.5 h-3.5 inline mr-1" />Technische Specs</span>
            {isEditor && editingSection !== 'technik' && (
              <button onClick={() => startEditSection('technik')}
                className="text-gray-400 hover:text-blue-600 transition-colors" title="Bearbeiten">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="pt-card-body">
            {editingSection === 'technik' ? (
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
            ) : (
              <>
                <KV label="Kapazität stehend" value={venue.capacity ? String(venue.capacity) : undefined} />
                <KV label="Kapazität bestuhlt" value={venue.capacitySeated ? String(venue.capacitySeated) : undefined} />
                <KV label="Bühnenmaße" value={venue.stageDimensions || undefined} />
                <KV label="Lichte Höhe" value={venue.clearanceHeight || undefined} />
                <KV label="WLAN" value={venue.wifi || undefined} />
                <KV label="Garderoben" value={venue.wardrobe || undefined} />
                <KV label="Duschen" value={venue.showers || undefined} />
                <KV label="Merchandise Fee" value={venue.merchandiseFee || undefined} />
                <KV label="Merch-Stand" value={venue.merchandiseStand || undefined} />
                <KV label="Notizen" value={venue.notes || undefined} />
                {!venue.capacity && !venue.capacitySeated && !venue.stageDimensions && !venue.clearanceHeight && !venue.wifi && !venue.wardrobe && !venue.showers && !venue.merchandiseFee && !venue.merchandiseStand && !venue.notes && (
                  <p className="text-sm text-gray-400 py-2">Keine technischen Daten hinterlegt.</p>
                )}
              </>
            )}
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
              <div className="flex items-center justify-center h-16 text-xs text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />Lade…
              </div>
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

        {/* Fotos */}
        <div className="pt-card md:col-span-2">
          <div className="pt-card-header">
            <span className="pt-card-title"><ImageIcon className="w-3.5 h-3.5 inline mr-1" />Fotos</span>
            {isEditor && (
              <button onClick={() => photoInputRef.current?.click()} disabled={uploading}
                className="text-gray-400 hover:text-blue-600 transition-colors" title="Fotos hochladen">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              </button>
            )}
            <input ref={photoInputRef} type="file" multiple accept="image/*" className="hidden"
              onChange={e => handleUpload(e.target.files, 'Fotos')} />
          </div>
          <div className="pt-card-body">
            {filesLoading ? (
              <div className="flex items-center justify-center h-16 text-xs text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />Lade…
              </div>
            ) : photos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {photos.map((photo, idx) => (
                  <button key={photo.id} onClick={() => lightbox.open(idx)}
                    className="focus:outline-none rounded overflow-hidden aspect-square">
                    <AuthImage fileId={photo.id} alt={photo.originalName}
                      className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                  </button>
                ))}
              </div>
            ) : (
              <button onClick={() => photoInputRef.current?.click()} disabled={!isEditor || uploading}
                className="w-full flex flex-col items-center justify-center gap-1.5 py-6 rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-gray-400 hover:text-blue-500 disabled:pointer-events-none">
                <ImageIcon className="w-5 h-5" />
                <span className="text-xs">{isEditor ? 'Fotos hochladen' : 'Keine Fotos vorhanden'}</span>
              </button>
            )}
            {uploadError && <p className="text-xs text-red-600 mt-2">{uploadError}</p>}
          </div>
        </div>

        {/* Dokumente */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><FileIcon className="w-3.5 h-3.5 inline mr-1" />Dokumente</span>
            {isEditor && (
              <div className="flex items-center gap-1.5">
                <select value={docCategory} onChange={e => setDocCategory(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 focus:outline-none focus:border-blue-400">
                  {['Stage Plan','Groundplan / Hallenplan','Rigging Plot','Technische Daten','Anfahrt & Parken','Verträge','Sonstiges'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button onClick={() => docInputRef.current?.click()} disabled={uploading}
                  className="text-gray-400 hover:text-blue-600 transition-colors" title="Dokument hochladen">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
            <input ref={docInputRef} type="file" multiple className="hidden"
              onChange={e => handleUpload(e.target.files, docCategory)} />
          </div>
          <div className="pt-card-body">
            {filesLoading ? (
              <div className="flex items-center justify-center h-16 text-xs text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />Lade…
              </div>
            ) : docs.length > 0 ? (
              <div className="flex flex-col gap-1">
                {docs.map(f => (
                  <button key={f.id}
                    onClick={() => {
                      fetch(`${API_BASE}/api/files/download/${f.id}`, { headers: authHeaders() })
                        .then(r => r.blob())
                        .then(blob => {
                          const url = URL.createObjectURL(blob)
                          window.open(url, '_blank')
                          setTimeout(() => URL.revokeObjectURL(url), 60_000)
                        })
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 group w-full text-left">
                    <span className="text-base leading-none">{fileIcon(f.mimeType)}</span>
                    <span className="text-sm text-gray-700 flex-1 truncate group-hover:text-blue-600">{f.originalName}</span>
                    {f.category && f.category !== 'Allgemein' && (
                      <span className="text-xs text-gray-400 flex-shrink-0">{f.category}</span>
                    )}
                    <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(f.size)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <button onClick={() => docInputRef.current?.click()} disabled={!isEditor || uploading}
                className="w-full flex flex-col items-center justify-center gap-1.5 py-6 rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-gray-400 hover:text-blue-500 disabled:pointer-events-none">
                <FileIcon className="w-5 h-5" />
                <span className="text-xs">{isEditor ? 'Dokumente hochladen' : 'Keine Dokumente vorhanden'}</span>
              </button>
            )}
          </div>
        </div>

      </div>

      <Lightbox {...lightbox.props} />
    </>
  )
}
