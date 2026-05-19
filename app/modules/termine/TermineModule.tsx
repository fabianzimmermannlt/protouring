'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { usePolling } from '@/app/hooks/usePolling'
import { useIsMobile } from '@/app/hooks/useIsMobile'
import { useEscapeKey } from '@/app/hooks/useEscapeKey'
import { useT } from '@/app/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/app/lib/i18n/translations/de'
import { Plus, X, Loader2, AlertCircle, MessageSquare, Check, ChevronLeft, ChevronRight, Edit2, Trash2, Download, Upload, Save, ArrowLeft } from 'lucide-react'
import TerminFileCard from './TerminFileCard'
import TerminModal from './TerminModal'
import VenueModal from '../venues/VenueModal'
import { QuickCreateVenueModal } from '@/app/components/shared/modals/QuickCreateVenueModal'
import { VenueDetailContent } from '../venues/VenueDetail'
import { PartnerDetailContent } from '../partners/PartnerDetail'
import PartnerModal from '../partners/PartnerModal'
import { QuickCreatePartnerModal } from '@/app/components/shared/modals/QuickCreatePartnerModal'
import LokaleKontakteCard from './LokaleKontakteCard'
import ZeitplaeneCard from './ZeitplaeneCard'
import KalenderView from './KalenderView'
import AnreiseCard from './AnreiseCard'
import HotelCard from './HotelCard'
import ContentBoard from '@/app/components/shared/ContentBoard'
import TerminChatCard from './TerminChatCard'
import ToDoCard from './ToDoCard'
import CateringCard from './CateringCard'
import AdvancingCard from './AdvancingCard'
import SonstigesCard from './SonstigesCard'
import VenueInfoSection from './VenueInfoSection'
import ReisegruppeView from './ReisegruppeView'
import AdvanceSheetView from './AdvanceSheetView'
import GaestelisteView from './GaestelisteView'
import TravelView from './TravelView'
import ScheduleView from './ScheduleView'
import HospitalityView from './HospitalityView'
import AdvancingView from './AdvancingView'
import BriefingView from './BriefingView'
import AgreementsView from './AgreementsView'
import TerminDetailMobile from './TerminDetailMobile'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'
import {
  getTermine,
  createTermin,
  updateTermin,
  deleteTermin,
  setAvailability,
  getVenues,
  createVenue,
  getPartners,
  getCurrentUser,
  getCurrentTenant,
  isAuthenticated,
  getEffectiveRole,
  isAdminRole,
  isEditorRole,
  canDo,
  CAN_CREATE_TERMIN,
  CAN_SEE_GEBUCHT,
  CAN_SEE_FILES_TERMIN,
  CAN_SEE_KALENDER,
  TERMIN_ART,
  TERMIN_ART_SUB,
  TERMIN_STATUS_BOOKING,
  TERMIN_STATUS_PUBLIC,
  type Termin,
  type TerminAvailability,
  type TerminFormData,
  type Venue,
  type Partner,
} from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

type AvailStatus = 'available' | 'maybe' | 'unavailable' | null

// ============================================================
// Constants
// ============================================================

const AVAIL_ICON: Record<string, { tKey: TranslationKey; color: string; symbol: string }> = {
  available:   { tKey: 'availability.available',   color: '#22c55e', symbol: '✓' },
  maybe:       { tKey: 'availability.maybe',       color: '#eab308', symbol: '?' },
  unavailable: { tKey: 'availability.unavailable', color: '#ef4444', symbol: '✗' },
  null:        { tKey: 'availability.unknown',     color: '#9ca3af', symbol: '–' },
}

const STATUS_BOOKING_DOT: Record<string, string> = {
  'Idee':                 '#9ca3af',
  'Option':               '#d97706',
  'noch nicht bestätigt': '#f59e0b',
  'bestätigt':            '#22c55e',
  'abgeschlossen':        '#6b7280',
  'abgesagt':             '#ef4444',
}

const STATUS_PUBLIC_DOT: Record<string, string> = {
  'nicht öffentlich': '#6b7280',
  'tba':              '#d97706',
  'veröffentlicht':   '#22c55e',
}

// Maps DB status values (stored in German) → translation keys
const STATUS_BOOKING_TKEY: Record<string, TranslationKey> = {
  'Idee':                 'status.booking.idea',
  'Option':               'status.booking.option',
  'noch nicht bestätigt': 'status.booking.pending',
  'bestätigt':            'status.booking.confirmed',
  'abgeschlossen':        'status.booking.completed',
  'abgesagt':             'status.booking.cancelled',
}
const STATUS_PUBLIC_TKEY: Record<string, TranslationKey> = {
  'nicht öffentlich': 'status.public.notPublic',
  'tba':              'status.public.tba',
  'veröffentlicht':   'status.public.published',
}

const EMPTY_FORM: TerminFormData = {
  date: '',
  title: '',
  art: '',
  art_sub: '',
  status_booking: 'Idee',
  status_public: 'nicht öffentlich',
  show_title_as_header: false,
}

// ============================================================
// Helpers
// ============================================================

export function formatDateLong(dateStr: string, withWeekday = true) {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    ...(withWeekday ? { weekday: 'long' } : {}),
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

export function formatDateTable(dateStr: string) {
  const d = new Date(dateStr)
  const weekday = d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')
  const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `${weekday} ${date}`
}

// ============================================================
// Veranstaltung-Card (detail view, editable)
// ============================================================

function VeranstaltungCard({ termin, isAdmin, onUpdated }: {
  termin: Termin
  isAdmin: boolean
  onUpdated: (t: Termin) => void
}) {
  const t = useT()
  const [form, setForm] = useState<TerminFormData>(() => terminToFormData(termin))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const originalRef = useRef<TerminFormData>(terminToFormData(termin))

  // Sync when navigating to a different termin
  useEffect(() => {
    const fd = terminToFormData(termin)
    setForm(fd)
    originalRef.current = fd
    setError('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termin.id])

  const isDirty = JSON.stringify(form) !== JSON.stringify(originalRef.current)

  // Nav guard
  useEffect(() => {
    ;(window as any).__pt_isDirty = isDirty
  }, [isDirty])

  // Always-fresh save reference
  useEffect(() => {
    ;(window as any).__pt_save = saveEdit
  })

  const f = (key: keyof TerminFormData, value: string | boolean | number | null | undefined) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const cancelEdit = () => {
    setForm(originalRef.current)
    setError('')
  }

  const saveEdit = async (): Promise<boolean> => {
    setSaving(true)
    try {
      const updated = await updateTermin(termin.id, form)
      onUpdated(updated)
      originalRef.current = terminToFormData(updated)
      setError('')
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
      return false
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pt-card">
      <div className="pt-card-header">
        <span className="pt-card-title">{t('appointments.card.event')}</span>
        {isDirty && (
          <div className="flex items-center gap-2">
            <button onClick={cancelEdit} disabled={saving}
              className="text-xs transition-colors" style={{ color: '#888' }}>
              Abbrechen
            </button>
            <button onClick={saveEdit} disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded font-medium disabled:opacity-50 transition-colors"
              style={{ background: '#2563eb', color: '#fff' }}>
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              Speichern
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-5 mt-2 p-2 bg-red-900/30 border border-red-700/40 rounded text-red-300 text-xs flex items-center gap-2">
          <AlertCircle size={12} /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={12} /></button>
        </div>
      )}

      <div className="pt-card-body">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {/* Datum + Stadt */}
          <div>
            <label className="detail-label">{t('appointments.card.date')}</label>
            <input type="date" className="detail-input" value={form.date}
              onChange={e => f('date', e.target.value)} disabled={!isAdmin} />
          </div>
          <div>
            <label className="detail-label">{t('table.city')}</label>
            <input type="text" className="detail-input" value={form.city || ''}
              onChange={e => f('city', e.target.value)} disabled={!isAdmin} />
          </div>

          {/* Titel – volle Breite */}
          <div className="col-span-2">
            <label className="detail-label">{t('appointments.card.title')}</label>
            <input type="text" className="detail-input" value={form.title}
              onChange={e => f('title', e.target.value)} disabled={!isAdmin} />
          </div>

          {/* Typ + Sub-Typ */}
          <div>
            <label className="detail-label">{t('appointments.card.type')}</label>
            <select className="detail-input" value={form.art || ''}
              onChange={e => f('art', e.target.value)} disabled={!isAdmin}>
              <option value="">—</option>
              {TERMIN_ART.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="detail-label">Sub-Typ</label>
            <select className="detail-input" value={form.art_sub || ''}
              onChange={e => f('art_sub', e.target.value)} disabled={!isAdmin}>
              <option value="">—</option>
              {TERMIN_ART_SUB.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Status Booking + Status Public */}
          <div>
            <label className="detail-label">{t('appointments.card.statusBooking')}</label>
            <select className="detail-input" value={form.status_booking || ''}
              onChange={e => f('status_booking', e.target.value)} disabled={!isAdmin}>
              {TERMIN_STATUS_BOOKING.map(s => (
                <option key={s} value={s}>{STATUS_BOOKING_TKEY[s] ? t(STATUS_BOOKING_TKEY[s]) : s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="detail-label">{t('appointments.card.statusPublic')}</label>
            <select className="detail-input" value={form.status_public || ''}
              onChange={e => f('status_public', e.target.value)} disabled={!isAdmin}>
              {TERMIN_STATUS_PUBLIC.map(s => (
                <option key={s} value={s}>{STATUS_PUBLIC_TKEY[s] ? t(STATUS_PUBLIC_TKEY[s]) : s}</option>
              ))}
            </select>
          </div>

          {/* Notizen – volle Breite */}
          <div className="col-span-2">
            <label className="detail-label">Notizen</label>
            <textarea className="detail-input" rows={3} value={form.notes || ''}
              onChange={e => f('notes', e.target.value)} disabled={!isAdmin}
              style={{ resize: 'vertical' }} />
          </div>

          {/* Titel als Header */}
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!form.show_title_as_header}
                onChange={e => f('show_title_as_header', e.target.checked)}
                disabled={!isAdmin}
                className="rounded"
              />
              <span className="detail-label mb-0">{t('termin.showTitleAsHeader')}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Spielstätte card
// ============================================================

function terminToFormData(t: Termin): TerminFormData {
  return {
    date: t.date,
    title: t.title,
    art: t.art || '',
    art_sub: t.artSub || '',
    status_booking: t.statusBooking || 'Idee',
    status_public: t.statusPublic || 'nicht öffentlich',
    show_title_as_header: t.showTitleAsHeader || false,
    city: t.city,
    venue_id: t.venueId ?? null,
    partner_id: t.partnerId ?? null,
    announcement: t.announcement,
    capacity: t.capacity ?? null,
    notes: t.notes,
  }
}

const EMPTY_VENUE = { name: '', city: '', postalCode: '', capacity: '', street: '', state: '', country: '', website: '', arrival: '', arrivalStreet: '', arrivalPostalCode: '', arrivalCity: '', capacitySeated: '', stageDimensions: '', clearanceHeight: '', merchandiseFee: '', merchandiseStand: '', wardrobe: '', showers: '', wifi: '', parking: '', nightlinerParking: '', loadingPath: '', notes: '' }

function SpielstaetteCard({ termin, isAdmin, onUpdated }: {
  termin: Termin
  isAdmin: boolean
  onUpdated: (t: Termin) => void
}) {
  const t = useT()
  const [venues, setVenues] = useState<Venue[]>([])
  const [selecting, setSelecting] = useState(false)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)
  const [venueModalOpen, setVenueModalOpen] = useState(false)
  const [venueToEdit, setVenueToEdit] = useState<Venue | null>(null)
  const [venueQuickCreateOpen, setVenueQuickCreateOpen] = useState(false)

  useEffect(() => {
    getVenues().then(setVenues).catch(() => {})
  }, [])

  const filtered = venues.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.city.toLowerCase().includes(search.toLowerCase())
  )

  const linkVenue = async (venue: Venue | null) => {
    setSaving(true)
    try {
      const updated = await updateTermin(termin.id, {
        ...terminToFormData(termin),
        venue_id: venue ? Number(venue.id) : null,
        city: venue ? venue.city : termin.city,
      })
      onUpdated(updated)
      setSelecting(false)
      setSearch('')
    } catch (e) {
      setCardError(e instanceof Error ? e.message : t('general.error'))
    } finally {
      setSaving(false)
    }
  }

  const currentVenue = termin.venueId
    ? venues.find(v => Number(v.id) === termin.venueId)
    : null

  return (
    <div className="pt-card">
      <div className="pt-card-header">
        <span className="pt-card-title">{t('appointments.card.venue')}</span>
        {isAdmin && !selecting && (
          termin.venueId && currentVenue ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setSelecting(true); setSearch('') }}
                className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
              >
                Ändern
              </button>
              <button
                onClick={() => { setVenueToEdit(currentVenue); setVenueModalOpen(true) }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Edit2 size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setSelecting(true); setSearch('') }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
            >
              <Edit2 size={12} /> Verknüpfen
            </button>
          )
        )}
        {selecting && (
          <button onClick={() => { setSelecting(false); setSearch('') }}
            className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
        )}
      </div>

      {cardError && (
        <div className="mx-5 mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-center gap-2">
          <AlertCircle size={12} /> {cardError}
          <button onClick={() => setCardError(null)} className="ml-auto"><X size={12} /></button>
        </div>
      )}

      <div className="pt-card-body">
        {selecting ? (
          <div className="space-y-2">
            <input
              type="text"
              autoFocus
              placeholder={t('general.search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {termin.venueId && (
                <button onClick={() => linkVenue(null)} disabled={saving}
                  className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors">
                  {t('appointments.card.removeVenue')}
                </button>
              )}
              <button onClick={() => { setVenueQuickCreateOpen(true); setSelecting(false) }}
                className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1">
                <Plus size={11} /> {t('appointments.card.newVenue')}
              </button>
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-xs text-gray-400 text-center">{t('appointments.noResults')}</div>
              ) : filtered.map(v => (
                <button key={v.id} onClick={() => linkVenue(v)} disabled={saving}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${Number(v.id) === termin.venueId ? 'bg-blue-50 font-medium' : ''}`}>
                  <div className="font-medium text-gray-800">{v.name}</div>
                  {v.city && <div className="text-xs text-gray-400">{[v.postalCode, v.city].filter(Boolean).join(' ')}</div>}
                </button>
              ))}
            </div>
            {saving && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Loader2 size={11} className="animate-spin" /> Wird gespeichert…
              </div>
            )}
          </div>
        ) : termin.venueId && (currentVenue || termin.venueName) ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
            <dt className="text-gray-400 font-medium whitespace-nowrap">Name</dt>
            <dd className="text-gray-800 font-semibold">{currentVenue?.name || termin.venueName}</dd>
            {(currentVenue?.city || termin.city) && (
              <>
                <dt className="text-gray-400 font-medium">{t('table.city')}</dt>
                <dd className="text-gray-800">
                  {[currentVenue?.postalCode, currentVenue?.city || termin.city].filter(Boolean).join(' ')}
                </dd>
              </>
            )}
            {currentVenue?.capacity && (
              <>
                <dt className="text-gray-400 font-medium">{t('appointments.card.capacity')}</dt>
                <dd className="text-gray-800">{Number(currentVenue.capacity).toLocaleString('de-DE')}</dd>
              </>
            )}
            {currentVenue?.website && (
              <>
                <dt className="text-gray-400 font-medium">{t('appointments.card.website')}</dt>
                <dd>
                  <a href={currentVenue.website} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs truncate block">
                    {currentVenue.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                  </a>
                </dd>
              </>
            )}
          </dl>
        ) : (
          <p className="text-sm text-gray-400 text-center py-2">
            {t('appointments.card.noVenue')}
          </p>
        )}
      </div>

      {venueQuickCreateOpen && (
        <QuickCreateVenueModal
          onClose={() => setVenueQuickCreateOpen(false)}
          onCreated={async saved => {
            setVenues(prev => [...prev, saved])
            await linkVenue(saved)
            setVenueQuickCreateOpen(false)
          }}
        />
      )}
      {venueModalOpen && (
        <VenueModal
          venue={venueToEdit}
          onClose={() => { setVenueModalOpen(false); setVenueToEdit(null) }}
          onSaved={async saved => {
            setVenues(prev => {
              const exists = prev.find(v => v.id === saved.id)
              return exists ? prev.map(v => v.id === saved.id ? saved : v) : [...prev, saved]
            })
            // Neue Spielstätte automatisch verknüpfen
            if (!venueToEdit) {
              await linkVenue(saved)
            }
            setVenueModalOpen(false)
            setVenueToEdit(null)
          }}
          onDeleted={id => {
            setVenues(prev => prev.filter(v => v.id !== id))
            if (termin.venueId === Number(id)) linkVenue(null)
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// Partner card
// ============================================================

function PartnerCard({ termin, isAdmin, onUpdated }: {
  termin: Termin
  isAdmin: boolean
  onUpdated: (t: Termin) => void
}) {
  const t = useT()
  const [partners, setPartners] = useState<Partner[]>([])
  const [selecting, setSelecting] = useState(false)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)
  const [partnerModalOpen, setPartnerModalOpen] = useState(false)
  const [partnerToEdit, setPartnerToEdit] = useState<Partner | null>(null)
  const [partnerQuickCreateOpen, setPartnerQuickCreateOpen] = useState(false)

  useEffect(() => {
    getPartners().then(setPartners).catch(() => {})
  }, [])

  const filtered = partners.filter(p =>
    p.companyName.toLowerCase().includes(search.toLowerCase()) ||
    p.city.toLowerCase().includes(search.toLowerCase()) ||
    p.contactPerson.toLowerCase().includes(search.toLowerCase())
  )

  const linkPartner = async (partner: Partner | null) => {
    setSaving(true)
    try {
      const updated = await updateTermin(termin.id, {
        ...terminToFormData(termin),
        partner_id: partner ? Number(partner.id) : null,
      })
      onUpdated(updated)
      setSelecting(false)
      setSearch('')
    } catch (e) {
      setCardError(e instanceof Error ? e.message : t('general.error'))
    } finally {
      setSaving(false)
    }
  }

  const currentPartner = termin.partnerId
    ? partners.find(p => Number(p.id) === termin.partnerId) ?? null
    : null

  return (
    <div className="pt-card">
      <div className="pt-card-header">
        <span className="pt-card-title">{t('partners.title')}</span>
        {isAdmin && !selecting && (
          termin.partnerId && currentPartner ? (
            <div className="flex items-center gap-3">
              <button onClick={() => { setSelecting(true); setSearch('') }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
                Ändern
              </button>
              <button onClick={() => { setPartnerToEdit(currentPartner); setPartnerModalOpen(true) }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
                <Edit2 size={12} />
              </button>
            </div>
          ) : (
            <button onClick={() => { setSelecting(true); setSearch('') }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
              <Edit2 size={12} /> Verknüpfen
            </button>
          )
        )}
        {selecting && (
          <button onClick={() => { setSelecting(false); setSearch('') }}
            className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
        )}
      </div>

      {cardError && (
        <div className="mx-5 mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-center gap-2">
          <AlertCircle size={12} /> {cardError}
          <button onClick={() => setCardError(null)} className="ml-auto"><X size={12} /></button>
        </div>
      )}

      <div className="pt-card-body">
        {selecting ? (
          <div className="space-y-2">
            <input type="text" autoFocus placeholder={t('general.search')}
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {termin.partnerId && (
                <button onClick={() => linkPartner(null)} disabled={saving}
                  className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors">
                  {t('appointments.card.removePartner')}
                </button>
              )}
              <button
                onClick={() => { setPartnerQuickCreateOpen(true); setSelecting(false) }}
                className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1">
                <Plus size={11} /> {t('appointments.card.newPartner')}
              </button>
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-xs text-gray-400 text-center">{t('appointments.noResults')}</div>
              ) : filtered.map(p => (
                <button key={p.id} onClick={() => linkPartner(p)} disabled={saving}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${Number(p.id) === termin.partnerId ? 'bg-blue-50 font-medium' : ''}`}>
                  <div className="font-medium text-gray-800">{p.companyName}</div>
                  <div className="text-xs text-gray-400">
                    {[p.contactPerson, p.city].filter(Boolean).join(' · ')}
                  </div>
                </button>
              ))}
            </div>
            {saving && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Loader2 size={11} className="animate-spin" /> Wird gespeichert…
              </div>
            )}
          </div>
        ) : termin.partnerId && (currentPartner || termin.partnerName) ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
            <dt className="text-gray-400 font-medium whitespace-nowrap">Firma</dt>
            <dd className="text-gray-800 font-semibold">{currentPartner?.companyName || termin.partnerName}</dd>
            {currentPartner?.contactPerson && (
              <>
                <dt className="text-gray-400 font-medium">Kontakt</dt>
                <dd className="text-gray-800">{currentPartner.contactPerson}</dd>
              </>
            )}
            {currentPartner?.city && (
              <>
                <dt className="text-gray-400 font-medium">Ort</dt>
                <dd className="text-gray-800">{[currentPartner.postalCode, currentPartner.city].filter(Boolean).join(' ')}</dd>
              </>
            )}
            {currentPartner?.email && (
              <>
                <dt className="text-gray-400 font-medium">E-Mail</dt>
                <dd>
                  <a href={`mailto:${currentPartner.email}`} className="text-blue-600 hover:underline text-sm">
                    {currentPartner.email}
                  </a>
                </dd>
              </>
            )}
            {currentPartner?.phone && (
              <>
                <dt className="text-gray-400 font-medium">Telefon</dt>
                <dd className="text-gray-800">{currentPartner.phone}</dd>
              </>
            )}
          </dl>
        ) : (
          <p className="text-sm text-gray-400 text-center py-2">
            {t('appointments.card.noPartner')}
          </p>
        )}
      </div>

      {partnerQuickCreateOpen && (
        <QuickCreatePartnerModal
          onClose={() => setPartnerQuickCreateOpen(false)}
          onCreated={async saved => {
            setPartners(prev => [...prev, saved])
            setPartnerQuickCreateOpen(false)
            await linkPartner(saved)
          }}
        />
      )}
      {/* PartnerModal – nur für Bearbeiten */}
      {partnerModalOpen && (
        <PartnerModal
          partner={partnerToEdit}
          onClose={() => { setPartnerModalOpen(false); setPartnerToEdit(null) }}
          onSaved={async (saved) => {
            // Update local list
            setPartners(prev => {
              const exists = prev.find(p => p.id === saved.id)
              return exists
                ? prev.map(p => p.id === saved.id ? saved : p)
                : [...prev, saved]
            })
            setPartnerModalOpen(false)
            setPartnerToEdit(null)
            // If create mode → auto-link new partner to termin
            if (!partnerToEdit) {
              await linkPartner(saved)
            }
          }}
          onDeleted={() => {
            setPartners(prev => prev.filter(p => p.id !== partnerToEdit?.id))
            setPartnerModalOpen(false)
            setPartnerToEdit(null)
            // If deleted partner was linked, unlink it
            if (termin.partnerId && partnerToEdit && Number(partnerToEdit.id) === termin.partnerId) {
              linkPartner(null)
            }
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// Placeholder card
// ============================================================

function PlaceholderCard({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-200 shadow-sm">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</span>
      </div>
      <div className="px-5 py-6 text-center text-gray-300 text-sm">Noch nicht verfügbar</div>
    </div>
  )
}

// ============================================================
// Venue Tab View – zeigt VenueDetailContent (identisch zu Venues/Details)
// ============================================================

function VenuePicker({ termin, onLinked, onClose }: {
  termin: Termin
  onLinked: (updated: Termin) => void
  onClose: () => void
}) {
  const t = useT()
  useEscapeKey(onClose)
  const [venues, setVenues] = useState<Venue[]>([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [venueModalOpen, setVenueModalOpen] = useState(false)

  useEffect(() => { getVenues().then(setVenues).catch(() => {}) }, [])

  const filtered = venues.filter(v =>
    !search ||
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.city.toLowerCase().includes(search.toLowerCase())
  )

  const linkVenue = async (venue: Venue | null) => {
    setSaving(true)
    try {
      const updated = await updateTermin(termin.id, {
        ...terminToFormData(termin),
        venue_id: venue ? Number(venue.id) : null,
        city: venue ? venue.city : termin.city,
      })
      onLinked(updated)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('general.error'))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{t('appointments.card.venue')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
        </div>
        {error && (
          <div className="mx-4 mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-xs flex items-center gap-2">
            <AlertCircle size={12} /> {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={12} /></button>
          </div>
        )}
        <div className="px-4 py-3 space-y-2">
          <input
            type="text" autoFocus
            placeholder={t('general.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
            {termin.venueId && (
              <button onClick={() => linkVenue(null)} disabled={saving}
                className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors">
                {t('appointments.card.removeVenue')}
              </button>
            )}
            <button onClick={() => setVenueModalOpen(true)}
              className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1">
              <Plus size={11} /> {t('appointments.card.newVenue')}
            </button>

            {filtered.length === 0
              ? <div className="px-3 py-3 text-xs text-gray-400 text-center">{t('appointments.noResults')}</div>
              : filtered.map(v => (
                <button key={v.id} onClick={() => linkVenue(v)} disabled={saving}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${Number(v.id) === termin.venueId ? 'bg-blue-50 font-medium' : ''}`}>
                  <div className="font-medium text-gray-800">{v.name}</div>
                  {v.city && <div className="text-xs text-gray-400">{[v.postalCode, v.city].filter(Boolean).join(' ')}</div>}
                </button>
              ))
            }
          </div>
          {saving && <div className="flex items-center gap-1 text-xs text-gray-400"><Loader2 size={11} className="animate-spin" /> Wird gespeichert…</div>}
        </div>
        {venueModalOpen && (
          <QuickCreateVenueModal
            onClose={() => setVenueModalOpen(false)}
            onCreated={async saved => {
              setVenues(prev => [...prev, saved])
              setVenueModalOpen(false)
              await linkVenue(saved)
            }}
          />
        )}
      </div>
    </div>
  )
}

function VenueView({ termin, isAdmin, onUpdated }: {
  termin: Termin
  isAdmin: boolean
  onUpdated: (t: Termin) => void
}) {
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => { setShowPicker(false) }, [termin.id])

  const wechselnButton = isAdmin ? (
    <button
      onClick={() => setShowPicker(true)}
      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      {termin.venueId ? 'wechseln' : 'verknüpfen'}
    </button>
  ) : undefined

  return (
    <div className="flex flex-col gap-4">
      {termin.venueId ? (
        <VenueDetailContent venueId={String(termin.venueId)} headerRight={wechselnButton} />
      ) : (
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title">Spielstätte</span>
            {wechselnButton && <div style={{ flexShrink: 0 }}>{wechselnButton}</div>}
          </div>
          <div className="pt-card-body">
            <p className="text-sm text-gray-400">Noch keine Spielstätte verknüpft.</p>
          </div>
        </div>
      )}
      <LokaleKontakteCard terminId={termin.id} isAdmin={isAdmin} />

      {showPicker && (
        <VenuePicker
          termin={termin}
          onLinked={updated => { onUpdated(updated) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

// ============================================================
// Partner Tab View
// ============================================================

function PartnerPicker({ termin, onLinked, onClose }: {
  termin: Termin
  onLinked: (updated: Termin) => void
  onClose: () => void
}) {
  const t = useT()
  useEscapeKey(onClose)
  const [partners, setPartners] = useState<Partner[]>([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partnerModalOpen, setPartnerModalOpen] = useState(false)

  useEffect(() => { getPartners().then(setPartners).catch(() => {}) }, [])

  const filtered = partners.filter(p =>
    !search ||
    p.companyName.toLowerCase().includes(search.toLowerCase()) ||
    p.city.toLowerCase().includes(search.toLowerCase()) ||
    p.contactPerson.toLowerCase().includes(search.toLowerCase())
  )

  const linkPartner = async (partner: Partner | null) => {
    setSaving(true)
    try {
      const updated = await updateTermin(termin.id, {
        ...terminToFormData(termin),
        partner_id: partner ? Number(partner.id) : null,
      })
      onLinked(updated)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('general.error'))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{t('partners.title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
        </div>
        {error && (
          <div className="mx-4 mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-xs flex items-center gap-2">
            <AlertCircle size={12} /> {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={12} /></button>
          </div>
        )}
        <div className="px-4 py-3 space-y-2">
          <input
            type="text" autoFocus
            placeholder={t('general.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
            {termin.partnerId && (
              <button onClick={() => linkPartner(null)} disabled={saving}
                className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors">
                {t('appointments.card.removePartner')}
              </button>
            )}
            <button onClick={() => setPartnerModalOpen(true)}
              className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1">
              <Plus size={11} /> {t('appointments.card.newPartner')}
            </button>
            {filtered.length === 0
              ? <div className="px-3 py-3 text-xs text-gray-400 text-center">{t('appointments.noResults')}</div>
              : filtered.map(p => (
                <button key={p.id} onClick={() => linkPartner(p)} disabled={saving}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${Number(p.id) === termin.partnerId ? 'bg-blue-50 font-medium' : ''}`}>
                  <div className="font-medium text-gray-800">{p.companyName}</div>
                  {(p.contactPerson || p.city) && (
                    <div className="text-xs text-gray-400">{[p.contactPerson, p.city].filter(Boolean).join(' · ')}</div>
                  )}
                </button>
              ))
            }
          </div>
          {saving && <div className="flex items-center gap-1 text-xs text-gray-400"><Loader2 size={11} className="animate-spin" /> Wird gespeichert…</div>}
        </div>
        {partnerModalOpen && (
          <QuickCreatePartnerModal
            onClose={() => setPartnerModalOpen(false)}
            onCreated={async saved => {
              setPartners(prev => [...prev, saved])
              setPartnerModalOpen(false)
              await linkPartner(saved)
            }}
          />
        )}
      </div>
    </div>
  )
}

function PartnerView({ termin, isAdmin, onUpdated }: {
  termin: Termin
  isAdmin: boolean
  onUpdated: (t: Termin) => void
}) {
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => { setShowPicker(false) }, [termin.id])

  const wechselnButton = isAdmin ? (
    <button
      onClick={() => setShowPicker(true)}
      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      {termin.partnerId ? 'wechseln' : 'verknüpfen'}
    </button>
  ) : undefined

  return (
    <div className="flex flex-col gap-4">
      {termin.partnerId ? (
        <PartnerDetailContent
          partnerId={String(termin.partnerId)}
          headerRight={wechselnButton}
        />
      ) : (
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title">Partner / Veranstalter</span>
            {wechselnButton && <div style={{ flexShrink: 0 }}>{wechselnButton}</div>}
          </div>
          <div className="pt-card-body">
            <p className="text-sm text-gray-400">Noch kein Partner verknüpft.</p>
          </div>
        </div>
      )}

      {showPicker && (
        <PartnerPicker
          termin={termin}
          onLinked={updated => { onUpdated(updated) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

// ============================================================
// Kommunikation Tab View
// ============================================================

function KommunikationView({ termin, canSeeFiles }: {
  termin: Termin
  canSeeFiles: boolean
}) {
  const currentUser = getCurrentUser()
  const currentUserId = currentUser ? String(currentUser.id) : 'unknown'

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: '800px' }}>
      {canSeeFiles && <TerminFileCard terminId={String(termin.id)} className="min-h-[200px]" />}
      <div className="pt-card" style={{ minHeight: '180px', display: 'flex', flexDirection: 'column' }}>
        <ContentBoard
          entityType="termin_private"
          entityId={`${termin.id}_${currentUserId}`}
          title=""
          isAdmin={true}
          singleItem
          fixedTitle="Private Notiz"
          showTitleField={false}
          modalTitle={{ new: 'Notiz bearbeiten', edit: 'Notiz bearbeiten' }}
          hideEmptyButton
          allowDelete={false}
          className="flex-1"
        />
      </div>
      <TerminChatCard terminId={termin.id} />
    </div>
  )
}

// ============================================================
// TerminDetailHeader – Event-Name + Datum + Tab-Bar (Desktop)
// ============================================================

function TerminDetailHeader({
  termin,
  termine,
  selectedView,
  onNavigate,
  isAdmin,
  isEditor,
}: {
  termin: Termin
  termine: Termin[]
  selectedView: string
  onNavigate: (id: number) => void
  isAdmin: boolean
  isEditor: boolean
}) {
  const idx = termine.findIndex(t => t.id === termin.id)
  const prev = idx > 0 ? termine[idx - 1] : null
  const next = idx < termine.length - 1 ? termine[idx + 1] : null

  const pageTitle = termin.showTitleAsHeader
    ? [termin.city, termin.title].filter(Boolean).join(' · ')
    : termin.venueId
      ? [termin.venueName, termin.venueCity].filter(Boolean).join(' · ') || termin.title || ''
      : [termin.city, termin.title].filter(Boolean).join(' · ') || termin.title || ''

  // Alle verfügbaren Views
  const tabs = [
    { id: 'details2',       label: 'Details' },
    { id: 'venue',          label: 'Venue' },
    { id: 'partner',        label: 'Partner' },
    { id: 'travel',         label: 'Travel' },
    { id: 'schedule',       label: 'Schedule' },
    { id: 'hospitality',    label: 'Hospitality' },
    { id: 'advancing',      label: 'Advancing' },
    { id: 'agreements',     label: 'Agreements' },
    { id: 'travelparty',    label: 'Reisegruppe' },
    { id: 'briefing',       label: 'Briefing' },
    ...(isEditor ? [{ id: 'advance-sheet', label: 'Advance Sheet' }] : []),
    { id: 'guestlist',      label: 'Gästeliste' },
    { id: 'communication',  label: 'Kommunikation' },
  ]

  const changeView = (view: string) => {
    window.dispatchEvent(new CustomEvent('termine-set-view', { detail: { view } }))
  }

  // Normalize: 'details' maps to 'details2' in this header
  const activeTab = selectedView === 'details' ? 'details2' : selectedView

  return (
    <div style={{ marginBottom: '0.25rem' }}>
      {/* Back link — gleicher Stil wie ContactDetail */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('termine-go-to-list'))}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <ArrowLeft size={16} /> Zurück zur Übersicht
      </button>

      {/* Nav arrows + Title + Date */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1rem' }}>
        {/* Arrows */}
        <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0, paddingTop: '3px' }}>
          <button
            onClick={() => prev && onNavigate(prev.id)}
            disabled={!prev}
            title={prev ? formatDateShort(prev.date) + ' · ' + (prev.city || prev.title) : undefined}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', border: '1px solid #3a3a3a', borderRadius: '5px', background: 'none', cursor: prev ? 'pointer' : 'default', opacity: prev ? 1 : 0.2, color: '#888', transition: 'border-color 0.12s, color 0.12s' }}
            onMouseOver={e => { if (prev) { e.currentTarget.style.borderColor = '#666'; e.currentTarget.style.color = '#ccc' } }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#3a3a3a'; e.currentTarget.style.color = '#888' }}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => next && onNavigate(next.id)}
            disabled={!next}
            title={next ? formatDateShort(next.date) + ' · ' + (next.city || next.title) : undefined}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', border: '1px solid #3a3a3a', borderRadius: '5px', background: 'none', cursor: next ? 'pointer' : 'default', opacity: next ? 1 : 0.2, color: '#888', transition: 'border-color 0.12s, color 0.12s' }}
            onMouseOver={e => { if (next) { e.currentTarget.style.borderColor = '#666'; e.currentTarget.style.color = '#ccc' } }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#3a3a3a'; e.currentTarget.style.color = '#888' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
        {/* Title + Date stacked */}
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e0e0e0', margin: 0, lineHeight: 1.25 }}>
            {pageTitle}
          </h1>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.1rem' }}>
            {formatDateLong(termin.date)}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #333', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => changeView(tab.id)}
            className={`pt-detail-tab${activeTab === tab.id ? ' active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Detail view components (exported for use in standalone route pages)
// ============================================================

// Neighbour termin button (prev/next, with distance-based opacity/size)
export function TerminDatumzeile({ termin, termine, onNavigate }: {
  termin: Termin
  termine: Termin[]
  onNavigate: (id: number) => void
}) {
  const isMobile = useIsMobile()
  const idx = termine.findIndex(t => t.id === termin.id)
  const prev2 = idx >= 2 ? termine[idx - 2] : null
  const prev1 = idx >= 1 ? termine[idx - 1] : null
  const next1 = idx < termine.length - 1 ? termine[idx + 1] : null
  const next2 = idx < termine.length - 2 ? termine[idx + 2] : null

  const pageTitle = termin.showTitleAsHeader
    ? [termin.city, termin.title].filter(Boolean).join(' · ')
    : termin.venueId
      ? [termin.venueName, termin.venueCity].filter(Boolean).join(' · ') || termin.title || ''
      : [termin.city, termin.title].filter(Boolean).join(' · ') || termin.title || ''

  const dateLabel = formatDateLong(termin.date)

  return (
    <div className="pt-datumzeile">
      <div className="pt-datumzeile-neighbors--left">
        {prev1 && (
          <>
            {!isMobile && prev2 && <NeighbourBtn t={prev2} distance={2} dir="prev" onClick={() => onNavigate(prev2.id)} />}
            <NeighbourBtn t={prev1} distance={1} dir="prev" onClick={() => onNavigate(prev1.id)} />
          </>
        )}
      </div>
      <div className="pt-datumzeile-center">
        {isMobile ? (
          <div className="font-medium text-gray-700 text-center" style={{ fontSize: 'clamp(0.75rem, 3.8vw, 1rem)' }}>{dateLabel}</div>
        ) : (
          <div className="pt-datumzeile-center-date">{dateLabel}</div>
        )}
        <div className="pt-datumzeile-center-label">{pageTitle}</div>
      </div>
      <div className="pt-datumzeile-neighbors--right">
        {next1 && <NeighbourBtn t={next1} distance={1} dir="next" onClick={() => onNavigate(next1.id)} />}
        {!isMobile && next2 && <NeighbourBtn t={next2} distance={2} dir="next" onClick={() => onNavigate(next2.id)} />}
      </div>
    </div>
  )
}

function NeighbourBtn({ t, distance, dir, onClick }: {
  t: Termin
  distance: 1 | 2
  dir: 'prev' | 'next'
  onClick: () => void
}) {
  const cityLabel = t.city || t.venueName || t.title || ''

  return (
    <button onClick={onClick} className="pt-datumzeile-btn">
      {dir === 'prev' && <ChevronLeft size={16} className="flex-shrink-0" />}
      <div className="text-center">
        <div className="pt-datumzeile-btn-date">{formatDateTable(t.date)}</div>
        {cityLabel && <div className="pt-datumzeile-btn-city">{cityLabel}</div>}
      </div>
      {dir === 'next' && <ChevronRight size={16} className="flex-shrink-0" />}
    </button>
  )
}

export function TerminDetail({
  termin,
  termine,
  isAdmin,
  canSeeFiles,
  onUpdated,
  onDeleted,
}: {
  termin: Termin
  termine: Termin[]
  isAdmin: boolean
  canSeeFiles: boolean
  onUpdated: (t: Termin) => void
  onDeleted: () => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [abreiseRefreshKey, setAbreiseRefreshKey] = useState(0)
  const [anreiseRefreshKey, setAnreiseRefreshKey] = useState(0)

  const currentUser = getCurrentUser()
  const currentUserId = currentUser ? String(currentUser.id) : 'unknown'

  // Nachbar-Termine: Vortag / Folgetag (exakt 1 Tag Abstand)
  const ONE_DAY_MS = 86400000
  const idx = termine.findIndex(t => t.id === termin.id)
  const prevTermin = idx > 0 ? termine[idx - 1] : null
  const nextTermin = idx < termine.length - 1 ? termine[idx + 1] : null
  const prevTerminCity: string | undefined =
    prevTermin?.date && termin.date &&
    new Date(termin.date).getTime() - new Date(prevTermin.date).getTime() === ONE_DAY_MS
      ? (prevTermin.city || undefined) : undefined
  const nextTerminCity: string | undefined =
    nextTermin?.date && termin.date &&
    new Date(nextTermin.date).getTime() - new Date(termin.date).getTime() === ONE_DAY_MS
      ? (nextTermin.city || undefined) : undefined

  return (
    <div className="min-h-0">
      {/* Cards grid – 4 Spalten: 3× ~22%, Ablauf ~33% */}
      <div className="pt-detail-grid">

        {/* Spalte 1: Basis */}
        <div className="flex flex-col gap-4">
          <VeranstaltungCard
            key={termin.id}
            termin={termin}
            isAdmin={isAdmin}
            onUpdated={onUpdated}
          />
          <SpielstaetteCard
            key={`venue-${termin.id}`}
            termin={termin}
            isAdmin={isAdmin}
            onUpdated={onUpdated}
          />
          <PartnerCard
            key={`partner-${termin.id}`}
            termin={termin}
            isAdmin={isAdmin}
            onUpdated={onUpdated}
          />
          {canSeeFiles && <TerminFileCard terminId={String(termin.id)} className="min-h-[200px]" />}
          <ToDoCard terminId={termin.id} />
          <div className="pt-card" style={{ minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
            <ContentBoard
              entityType="termin_private"
              entityId={`${termin.id}_${currentUserId}`}
              title=""
              isAdmin={true}
              singleItem
              fixedTitle="Private Notiz"
              showTitleField={false}
              modalTitle={{ new: 'Notiz bearbeiten', edit: 'Notiz bearbeiten' }}
              hideEmptyButton
              allowDelete={false}
              className="flex-1"
            />
          </div>
          <TerminChatCard terminId={termin.id} />
        </div>

        {/* Spalte 2: Logistik & Reise */}
        <div className="flex flex-col gap-4">
          <AnreiseCard
            terminId={termin.id}
            legType="anreise"
            isAdmin={isAdmin}
            terminDate={termin.date}
            terminCity={termin.city || ''}
            prevTerminCity={prevTerminCity}
            refreshKey={anreiseRefreshKey}
            onCopiedToAbreise={() => setAbreiseRefreshKey(k => k + 1)}
          />
          <HotelCard
            terminId={termin.id}
            isAdmin={isAdmin}
            terminDate={termin.date}
          />
          <AnreiseCard
            terminId={termin.id}
            legType="abreise"
            isAdmin={isAdmin}
            terminDate={termin.date}
            terminCity={termin.city || ''}
            nextTerminCity={nextTerminCity}
            refreshKey={abreiseRefreshKey}
            onLegDeleted={() => setAnreiseRefreshKey(k => k + 1)}
          />
        </div>

        {/* Spalte 3: Lokale Ansprechpartner */}
        <div className="flex flex-col gap-4">
          <LokaleKontakteCard terminId={termin.id} isAdmin={isAdmin} />
        </div>

        {/* Spalte 4: Ablauf */}
        <div className="flex flex-col gap-4">
          <ZeitplaeneCard terminId={termin.id} isAdmin={isAdmin} />
          <CateringCard terminId={termin.id} isAdmin={isAdmin} />
          <AdvancingCard terminId={termin.id} isAdmin={isAdmin} />
          <PlaceholderCard title="Setlist" />
          <SonstigesCard terminId={termin.id} isAdmin={isAdmin} />
        </div>

      </div>

      {isAdmin && (
        <div className="pt-4 border-t border-gray-200 mt-2">
          <button onClick={() => setModalOpen(true)} className="btn btn-danger text-xs">
            Termin löschen
          </button>
        </div>
      )}

      {modalOpen && (
        <TerminModal
          termin={termin}
          onClose={() => setModalOpen(false)}
          onSaved={updated => { onUpdated(updated); setModalOpen(false) }}
          onDeleted={() => { onDeleted(); setModalOpen(false) }}
        />
      )}
    </div>
  )
}

// ============================================================
// TerminDetail2 – Row-based layout experiment
// ============================================================

export function TerminDetail2({
  termin,
  termine,
  isAdmin,
  canSeeFiles,
  onUpdated,
  onDeleted,
}: {
  termin: Termin
  termine: Termin[]
  isAdmin: boolean
  canSeeFiles: boolean
  onUpdated: (t: Termin) => void
  onDeleted: () => void
}) {
  const [deletingTermin, setDeletingTermin] = useState(false)

  const handleDeleteTermin = async () => {
    if (!window.confirm('Termin wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return
    setDeletingTermin(true)
    try {
      await deleteTermin(termin.id)
      onDeleted()
    } catch {
      setDeletingTermin(false)
    }
  }

  const currentUser = getCurrentUser()
  const currentUserId = currentUser ? String(currentUser.id) : 'unknown'

  const SectionLabel = ({ label }: { label: string }) => (
    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-0.5">
      {label}
    </div>
  )

  return (
    <div className="min-h-0 flex flex-col gap-6">

      {/* Verwerfen-Banner für leere (neu angelegte) Events */}
      {isAdmin && termin.title === 'Neues Event' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-sm text-amber-800 flex-1">Neues Event — Angaben ergänzen oder verwerfen.</span>
          <button
            onClick={handleDeleteTermin}
            disabled={deletingTermin}
            className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            Verwerfen
          </button>
        </div>
      )}

      {/* Zeile 1: Veranstaltung (2/3) + ToDo (1/3) */}
      <div className="grid grid-cols-3 gap-4 items-start">
        <div className="col-span-2">
          <VeranstaltungCard
            key={termin.id}
            termin={termin}
            isAdmin={isAdmin}
            onUpdated={onUpdated}
          />
        </div>
        <ToDoCard terminId={termin.id} />
      </div>

      {/* Zeile 2: Private Notiz volle Breite */}
      <div className="pt-card" style={{ minHeight: '180px', display: 'flex', flexDirection: 'column' }}>
        <ContentBoard
          entityType="termin_private"
          entityId={`${termin.id}_${currentUserId}`}
          title=""
          isAdmin={true}
          singleItem
          fixedTitle="Private Notiz"
          showTitleField={false}
          modalTitle={{ new: 'Notiz bearbeiten', edit: 'Notiz bearbeiten' }}
          hideEmptyButton
          allowDelete={false}
          className="flex-1"
        />
      </div>

    </div>
  )
}

// ============================================================
// Main component
// ============================================================

import CrewBookingView from '../contacts/CrewBookingView'

export default function TerminePage({ activeSubTab = '' }: { activeSubTab?: string }) {
  const router = useRouter()
  const { layout } = useLayout()
  const isL3 = layout === 'L3'
  const [termine, setTermine] = useState<Termin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // ── Inline-Detail-State (SPA-Navigation ohne Route-Wechsel) ──────────────
  const [selectedTerminId, setSelectedTerminId] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const id = new URLSearchParams(window.location.search).get('id')
    return id ? parseInt(id, 10) : null
  })
  const [selectedView, setSelectedView] = useState<string>(() => {
    if (typeof window === 'undefined') return 'details'
    return new URLSearchParams(window.location.search).get('view') || 'details'
  })
  const selectedTerminIdRef = useRef(selectedTerminId)
  useEffect(() => { selectedTerminIdRef.current = selectedTerminId }, [selectedTerminId])

  const getTab = () =>
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('tab') || 'events'
      : 'events'

  const selectTermin = useCallback((id: number, view?: string) => {
    const tab = getTab()
    const defaultView = tab === 'events' ? 'details2' : 'details'
    const v = view || defaultView
    setSelectedTerminId(id)
    setSelectedView(v)
    history.pushState(null, '', `/?tab=${tab}&id=${id}&view=${v}`)
    window.dispatchEvent(new CustomEvent('termine-view-changed', { detail: { inDetail: true, view: v } }))
    window.dispatchEvent(new CustomEvent('advancing-view-changed', { detail: { view: v } }))
  }, [])

  useEffect(() => {
    const onSelect = (e: Event) => {
      const { id, view } = (e as CustomEvent<{ id: number; view?: string }>).detail
      selectTermin(id, view)
    }
    const onGoBack = () => {
      setSelectedTerminId(null)
      history.pushState(null, '', `/?tab=${getTab()}`)
      window.dispatchEvent(new CustomEvent('termine-view-changed', { detail: { inDetail: false } }))
    }
    const onSetView = (e: Event) => {
      const v = (e as CustomEvent<{ view: string }>).detail?.view
      if (!v) return
      setSelectedView(v)
      const id = selectedTerminIdRef.current
      if (id) history.pushState(null, '', `/?tab=${getTab()}&id=${id}&view=${v}`)
    }
    const onPopState = () => {
      const p = new URLSearchParams(window.location.search)
      const id = p.get('id')
      const view = p.get('view') || 'details'
      const newId = id ? parseInt(id, 10) : null
      setSelectedTerminId(newId)
      setSelectedView(view)
      window.dispatchEvent(new CustomEvent('termine-view-changed', { detail: { inDetail: !!newId, view } }))
    }
    window.addEventListener('select-termin', onSelect)
    window.addEventListener('termine-go-to-list', onGoBack)
    window.addEventListener('advancing-go-to-list', onGoBack)
    window.addEventListener('termine-set-view', onSetView)
    window.addEventListener('advancing-set-view', onSetView)
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('select-termin', onSelect)
      window.removeEventListener('termine-go-to-list', onGoBack)
      window.removeEventListener('advancing-go-to-list', onGoBack)
      window.removeEventListener('termine-set-view', onSetView)
      window.removeEventListener('advancing-set-view', onSetView)
      window.removeEventListener('popstate', onPopState)
    }
  }, [selectTermin])

  // Filter + View (synced with Navigation SubMenu)
  const [termineFilter, setTermineFilter] = useState<'aktuell' | 'vergangen' | 'alle'>(() => {
    if (typeof window === 'undefined') return 'aktuell'
    const f = new URLSearchParams(window.location.search).get('filter') as 'aktuell' | 'vergangen' | 'alle'
    return f ?? 'aktuell'
  })
  const [listView, setListView] = useState<'list' | 'calendar'>('list')

  // Notify Navigation about current view state on mount
  useEffect(() => {
    if (selectedTerminId) {
      window.dispatchEvent(new CustomEvent('termine-view-changed', { detail: { inDetail: true, view: selectedView } }))
    } else {
      window.dispatchEvent(new CustomEvent('termine-view-changed', { detail: { inDetail: false } }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ filter: 'aktuell' | 'vergangen' | 'alle' }>).detail
      if (detail?.filter) setTermineFilter(detail.filter)
    }
    window.addEventListener('termine-filter-changed', handler)
    return () => window.removeEventListener('termine-filter-changed', handler)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ view: 'list' | 'calendar' }>).detail
      if (detail?.view) setListView(detail.view)
    }
    window.addEventListener('termine-listview-changed', handler)
    return () => window.removeEventListener('termine-listview-changed', handler)
  }, [])

  // Sidebar "+" Button → neues Event öffnen (Legacy, nicht mehr genutzt)
  useEffect(() => {
    const handler = () => { setEditingTermin(null); setIsModalOpen(true) }
    window.addEventListener('open-new-termin', handler)
    return () => window.removeEventListener('open-new-termin', handler)
  }, [])

  // Neues Event wurde direkt per API erstellt (kein Modal) → in lokalen State einfügen
  useEffect(() => {
    const handler = (e: Event) => {
      const { termin } = (e as CustomEvent<{ termin: Termin }>).detail
      setTermine(prev => {
        if (prev.find(t => t.id === termin.id)) return prev
        return [termin, ...prev]
      })
    }
    window.addEventListener('termin-added', handler)
    return () => window.removeEventListener('termin-added', handler)
  }, [])

  // New/edit modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTermin, setEditingTermin] = useState<Termin | null>(null)

  // Availability comment popup
  const [commentPopup, setCommentPopup] = useState<{ terminId: number; comment: string } | null>(null)
  const [commentSaving, setCommentSaving] = useState(false)

  const t = useT()
  const isMobile = useIsMobile()
  const currentUser = getCurrentUser()
  const effectiveRole = getEffectiveRole()
  const isAdmin  = isAdminRole(effectiveRole)                        // admin + tourmanagement
  const isEditor = isEditorRole(effectiveRole)                       // admin + agency + tourmanagement (CAN_EDIT)
  const canCreate    = canDo(effectiveRole, CAN_CREATE_TERMIN)       // admin + agency + tourmanagement
  const canSeeGebucht = canDo(effectiveRole, CAN_SEE_GEBUCHT)        // alle außer Gast
  const canSeeFiles   = canDo(effectiveRole, CAN_SEE_FILES_TERMIN)   // admin + tourmanagement + agency + artist + crew_plus

  // ---- Load data ----

  const loadData = useCallback(async () => {
    if (!isAuthenticated()) { setAuthError(true); setLoading(false); return }
    try {
      setLoading(true)
      setError(null)
      const data = await getTermine()
      setTermine(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verbindung zum Server fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }, [])

  // Stilles Polling alle 30s — kein Loading-Spinner
  const silentRefresh = useCallback(async () => {
    if (!isAuthenticated()) return
    try {
      const data = await getTermine()
      setTermine(data)
    } catch {
      // still ignorieren
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  usePolling(silentRefresh, 30_000)

  // ---- Modal helpers ----

  const openNew = () => { setEditingTermin(null); setIsModalOpen(true) }
  const openEdit = (t: Termin) => { setEditingTermin(t); setIsModalOpen(true) }
  const closeModal = () => { setIsModalOpen(false); setEditingTermin(null) }

  const handleDelete = async (id: number) => {
    if (!confirm(t('general.delete') + '?')) return
    try {
      await deleteTermin(id)
      setTermine(prev => prev.filter(item => item.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('general.error'))
    }
  }

  // ---- Availability cycling ----

  const applyAvailabilityUpdate = (terminId: number, avail: { user_id: number; status: string | null; comment: string | null; updated_at: string; id: number }) => {
    setTermine(prev => prev.map(t => {
      if (t.id !== terminId) return t
      const existing = t.availability ?? []
      const entry: TerminAvailability = {
        id: avail.id, terminId, userId: avail.user_id,
        status: avail.status as TerminAvailability['status'],
        comment: avail.comment ?? undefined,
        updatedAt: avail.updated_at,
      }
      const updated = existing.some(a => a.userId === avail.user_id)
        ? existing.map(a => a.userId === avail.user_id ? entry : a)
        : [...existing, entry]
      return { ...t, availability: updated }
    }))
  }

  const selectAvailability = async (termin: Termin, status: AvailStatus) => {
    const next: AvailStatus = termin.myAvailability === status ? null : status
    if (next === 'maybe') {
      setCommentPopup({ terminId: termin.id, comment: termin.myComment || '' })
      setTermine(prev => prev.map(t => t.id === termin.id ? { ...t, myAvailability: 'maybe' } : t))
      try {
        const res = await setAvailability(termin.id, 'maybe', termin.myComment || '')
        applyAvailabilityUpdate(termin.id, res.availability)
      }
      catch (e) { setError(e instanceof Error ? e.message : 'Fehler') }
      return
    }
    setTermine(prev => prev.map(t => t.id === termin.id ? { ...t, myAvailability: next, myComment: undefined } : t))
    try {
      const res = await setAvailability(termin.id, next)
      applyAvailabilityUpdate(termin.id, res.availability)
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Fehler beim Setzen der Verfügbarkeit'); await loadData() }
  }

  const saveComment = async () => {
    if (!commentPopup) return
    setCommentSaving(true)
    try {
      const res = await setAvailability(commentPopup.terminId, 'maybe', commentPopup.comment)
      applyAvailabilityUpdate(commentPopup.terminId, res.availability)
      setTermine(prev => prev.map(t => t.id === commentPopup.terminId ? { ...t, myComment: commentPopup.comment } : t))
      setCommentPopup(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setCommentSaving(false)
    }
  }

  // ---- Sort + Filter ----
  const today = new Date().toISOString().slice(0, 10)
  const sortedTermine = [...termine].sort((a, b) => a.date.localeCompare(b.date))
  const filteredTermine = sortedTermine.filter(item => {
    if (termineFilter === 'aktuell')   { if (item.date < today) return false }
    if (termineFilter === 'vergangen') { if (item.date >= today) return false }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      if (![item.title, item.city, item.venueName, item.art].some(v => v?.toLowerCase().includes(q))) return false
    }
    return true
  })

  // ---- Table sort (column headers) ----
  const [tableSortKey, setTableSortKey] = useState<keyof Termin>('date')
  const [tableSortDir, setTableSortDir] = useState<'asc' | 'desc'>('asc')
  const toggleTableSort = (key: keyof Termin) => {
    if (key === tableSortKey) setTableSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setTableSortKey(key); setTableSortDir('asc') }
  }
  const tableRows = useMemo(() => {
    return [...filteredTermine].sort((a, b) => {
      const av = (a[tableSortKey] ?? '').toString().toLowerCase()
      const bv = (b[tableSortKey] ?? '').toString().toLowerCase()
      const cmp = av.localeCompare(bv, 'de')
      return tableSortDir === 'asc' ? cmp : -cmp
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTermine, tableSortKey, tableSortDir])

  // ---- Guards ----

  if (authError) return (
    <div className="p-8 text-center text-gray-500">
      <AlertCircle className="inline mb-2" size={24} />
      <p>Nicht eingeloggt. Bitte zuerst anmelden.</p>
    </div>
  )

  if (loading) return (
    <div className="p-8 text-center text-gray-400">
      <Loader2 className="inline animate-spin mb-2" size={24} />
      <p>{t('appointments.loading')}</p>
    </div>
  )

  // ============================================================
  // Inline Detail View (SPA – kein Route-Wechsel)
  // ============================================================

  const selectedTermin = selectedTerminId ? sortedTermine.find(t => t.id === selectedTerminId) ?? null : null

  if (selectedTermin) {
    const tab = getTab()
    const onUpdated = (updated: Termin) => {
      setTermine(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
      window.dispatchEvent(new CustomEvent('termin-list-changed'))
    }
    const onDeleted = () => {
      setTermine(prev => prev.filter(t => t.id !== selectedTermin.id))
      setSelectedTerminId(null)
      history.pushState(null, '', `/?tab=${tab}`)
      window.dispatchEvent(new CustomEvent('termine-view-changed', { detail: { inDetail: false } }))
      window.dispatchEvent(new CustomEvent('termin-list-changed'))
    }
    const isAdvancingTab = tab === 'events'

    return (
      <div className="module-content">
        {!isL3 && !isMobile && (
          <TerminDetailHeader
            termin={selectedTermin}
            termine={sortedTermine}
            selectedView={selectedView}
            onNavigate={id => selectTermin(id, selectedView)}
            isAdmin={isAdmin}
            isEditor={isEditor}
          />
        )}
        {!isL3 && isMobile && (
          <TerminDatumzeile
            termin={selectedTermin}
            termine={sortedTermine}
            onNavigate={id => selectTermin(id, selectedView)}
          />
        )}
        {selectedView === 'venue' ? (
          <VenueView termin={selectedTermin} isAdmin={isAdmin} onUpdated={onUpdated} />
        ) : selectedView === 'partner' ? (
          <PartnerView termin={selectedTermin} isAdmin={isAdmin} onUpdated={onUpdated} />
        ) : selectedView === 'communication' ? (
          <KommunikationView termin={selectedTermin} canSeeFiles={canSeeFiles} />
        ) : selectedView === 'travelparty' ? (
          <ReisegruppeView terminId={selectedTermin.id} isAdmin={isEditor} />
        ) : selectedView === 'advance-sheet' ? (
          <AdvanceSheetView terminId={selectedTermin.id} />
        ) : selectedView === 'guestlist' ? (
          <GaestelisteView key={selectedTermin.id} terminId={selectedTermin.id} />
        ) : selectedView === 'travel' ? (
          <TravelView termin={selectedTermin} termine={sortedTermine} isAdmin={isAdmin} />
        ) : selectedView === 'schedule' ? (
          <ScheduleView terminId={selectedTermin.id} isAdmin={isAdmin} />
        ) : selectedView === 'hospitality' || selectedView === 'catering' ? (
          <HospitalityView terminId={selectedTermin.id} isAdmin={isAdmin} />
        ) : selectedView === 'advancing' ? (
          <AdvancingView terminId={selectedTermin.id} isAdmin={isAdmin} />
        ) : selectedView === 'briefing' ? (
          <BriefingView terminId={selectedTermin.id} isAdmin={isAdmin} />
        ) : selectedView === 'agreements' ? (
          <AgreementsView terminId={selectedTermin.id} isAdmin={isAdmin} />
        ) : isAdvancingTab || selectedView === 'details2' ? (
          isMobile ? (
            <TerminDetailMobile termin={selectedTermin} termine={sortedTermine} isAdmin={isEditor} canSeeFiles={canSeeFiles}
              onUpdated={onUpdated} onDeleted={onDeleted}
              onEditClick={() => {}} />
          ) : (
            <TerminDetail2 termin={selectedTermin} termine={sortedTermine} isAdmin={isAdmin} canSeeFiles={canSeeFiles}
              onUpdated={onUpdated} onDeleted={onDeleted} />
          )
        ) : (
          isMobile ? (
            <TerminDetailMobile termin={selectedTermin} termine={sortedTermine} isAdmin={isEditor} canSeeFiles={canSeeFiles}
              onUpdated={onUpdated} onDeleted={onDeleted}
              onEditClick={() => {}} />
          ) : (
            <TerminDetail termin={selectedTermin} termine={sortedTermine} isAdmin={isAdmin} canSeeFiles={canSeeFiles}
              onUpdated={onUpdated} onDeleted={onDeleted} />
          )
        )}
      {isModalOpen && (
        <TerminModal
          termin={editingTermin}
          onClose={closeModal}
          onSaved={saved => {
            if (editingTermin) {
              setTermine(prev => prev.map(t => t.id === saved.id ? { ...t, ...saved } : t))
            } else {
              setTermine(prev => [...prev, saved])
            }
            window.dispatchEvent(new CustomEvent('termin-list-changed'))
          }}
          onDeleted={id => {
            setTermine(prev => prev.filter(t => t.id !== id))
            closeModal()
          }}
          allowAddAnother
        />
      )}
      </div>
    )
  }

  // ============================================================
  // Render (List View)
  // ============================================================

  if (activeSubTab === 'crew-booking') return (
    <div className="module-content">
      <CrewBookingView isAdmin={isAdmin} />
    </div>
  )

  return (
    <div className="module-content">

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* ---- LIST VIEW ---- */}
      {(
        <>
          {/* Titel */}
          <h1 className="text-xl font-semibold mb-1" style={{ color: '#e0e0e0' }}>Events</h1>

          {/* Toolbar: Neu + Suche + Filter + CSV */}
          <div className="flex items-center gap-2">
            {canCreate && (
              <button onClick={openNew} className="btn btn-primary flex-shrink-0" style={{ borderRadius: '4px' }}>
                {t('appointments.new')}
              </button>
            )}
            <input
              type="text"
              placeholder={t('appointments.search')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input l2-search"
              style={{ marginBottom: 0, borderRadius: '4px', flex: 1 }}
            />
            {/* Filter-Pills */}
            {(['aktuell', 'vergangen', 'alle'] as const).map(f => {
              const labels = { aktuell: t('appointments.filter.current'), vergangen: t('appointments.filter.past'), alle: t('appointments.filter.all') }
              const active = listView === 'list' && termineFilter === f
              return (
                <button key={f} onClick={() => {
                  setTermineFilter(f); setListView('list')
                  window.dispatchEvent(new CustomEvent('termine-filter-changed', { detail: { filter: f } }))
                  window.dispatchEvent(new CustomEvent('termine-listview-changed', { detail: { view: 'list' } }))
                }}
                  className="flex-shrink-0 px-2.5 py-1 text-xs font-medium rounded transition-colors"
                  style={{ background: active ? '#3a3a3a' : 'transparent', color: active ? '#e0e0e0' : '#888', border: '1px solid', borderColor: active ? '#555' : 'transparent' }}>
                  {labels[f]}
                </button>
              )
            })}
            {canDo(effectiveRole, CAN_SEE_KALENDER) && (
              <button onClick={() => {
                setListView('calendar')
                window.dispatchEvent(new CustomEvent('termine-listview-changed', { detail: { view: 'calendar' } }))
              }}
                className="flex-shrink-0 px-2.5 py-1 text-xs font-medium rounded transition-colors"
                style={{ background: listView === 'calendar' ? '#3a3a3a' : 'transparent', color: listView === 'calendar' ? '#e0e0e0' : '#888', border: '1px solid', borderColor: listView === 'calendar' ? '#555' : 'transparent' }}>
                {t('appointments.calendar')}
              </button>
            )}
            {/* CSV Export + Import (Admin) */}
            {isAdmin && (<>
              <button onClick={() => {
                const q = (v: string | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`
                const rows = [
                  ['Datum', 'Titel', 'Art', 'Art_Sub', 'Stadt', 'Venue', 'Status_Booking', 'Status_Public', 'Notiz'].join(';'),
                  ...filteredTermine.map(item => [q(item.date), q(item.title), q(item.art), q(item.artSub), q(item.city), q(item.venueName), q(item.statusBooking), q(item.statusPublic), q(item.notes)].join(';')),
                ]
                const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = 'termine.csv'; a.click()
                URL.revokeObjectURL(url)
              }}
                className="btn btn-ghost flex-shrink-0" style={{ borderRadius: '4px' }} title="CSV Export">
                <Download size={15} />
              </button>
              <label className="btn btn-ghost flex-shrink-0 cursor-pointer" style={{ borderRadius: '4px' }} title="CSV Import">
                <Upload size={15} />
                <input type="file" accept=".csv" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const text = await file.text()
                  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
                  const header = lines[0].split(';').map(h => h.replace(/"/g, '').trim())
                  const col = (row: string[], name: string) => row[header.indexOf(name)]?.replace(/^"|"$/g, '').trim() ?? ''
                  const created: Termin[] = []
                  for (const line of lines.slice(1)) {
                    const row = line.split(';')
                    const date = col(row, 'Datum')
                    const title = col(row, 'Titel')
                    if (!date || !title) continue
                    try {
                      const termin = await createTermin({
                        date, title,
                        art: col(row, 'Art') || undefined,
                        art_sub: col(row, 'Art_Sub') || undefined,
                        city: col(row, 'Stadt') || undefined,
                        status_booking: col(row, 'Status_Booking') || 'Idee',
                        status_public: col(row, 'Status_Public') || 'nicht öffentlich',
                        notes: col(row, 'Notiz') || undefined,
                      })
                      created.push(termin)
                    } catch { /* skip invalid rows */ }
                  }
                  if (created.length > 0) setTermine(prev => [...prev, ...created])
                  e.target.value = ''
                }} />
              </label>
            </>)}
          </div>

          {/* Kalender-View */}
          {listView === 'calendar' && (
            <KalenderView
              termine={filteredTermine}
              onSelectTermin={id => selectTermin(id)}
            />
          )}

          {/* Mobile Card List */}
          {listView === 'list' && isMobile && (
            <div className="flex flex-col gap-2 mt-2">
              {tableRows.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  {termine.length === 0 ? t('appointments.emptyState') : t('appointments.noResults')}
                </div>
              ) : tableRows.map(item => (
                <button
                  key={item.id}
                  onClick={() => selectTermin(item.id)}
                  className="w-full bg-white rounded-xl border border-gray-200 px-4 py-3 text-left flex items-center gap-3 active:bg-gray-50 transition-colors"
                >
                  {/* Date column */}
                  <div className="flex-shrink-0 w-12 text-center">
                    <div className="text-lg font-bold text-gray-800 leading-none">
                      {new Date(item.date).toLocaleDateString('de-DE', { day: '2-digit' })}
                    </div>
                    <div className="text-xs text-gray-400 uppercase mt-0.5">
                      {new Date(item.date).toLocaleDateString('de-DE', { month: 'short' })}
                    </div>
                  </div>
                  {/* Divider */}
                  <div className="w-px self-stretch bg-gray-100 flex-shrink-0" />
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm truncate">{item.title}</span>
                      {item.statusBooking && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 500, flexShrink: 0, color: STATUS_BOOKING_DOT[item.statusBooking] || '#9ca3af' }}>
                          {STATUS_BOOKING_TKEY[item.statusBooking] ? t(STATUS_BOOKING_TKEY[item.statusBooking]) : item.statusBooking}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {[item.city, item.venueName].filter(Boolean).join(' · ') || <span className="italic">Kein Ort</span>}
                    </div>
                  </div>
                  {/* Availability dots + Gebucht */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <div className="flex gap-1">
                      {(['available', 'maybe', 'unavailable'] as AvailStatus[]).map(s => {
                        const active = item.myAvailability === s
                        const cfg = AVAIL_ICON[s as string]
                        return (
                          <button
                            key={s}
                            onClick={e => { e.stopPropagation(); selectAvailability(item, s) }}
                            title={t(cfg.tKey)}
                            className="w-5 h-5 rounded-full font-bold flex items-center justify-center text-xs transition-all active:scale-110"
                            style={{
                              backgroundColor: active ? cfg.color : 'transparent',
                              color: active ? '#fff' : '#d1d5db',
                              border: active ? 'none' : '1.5px solid #d1d5db',
                            }}
                          >
                            {cfg.symbol}
                          </button>
                        )
                      })}
                    </div>
                    {/* Gebucht-Status: Admins sehen ihn immer, Crew sieht eigenen Status */}
                    {(canSeeGebucht || item.inTravelParty || item.isRejected) && (
                      item.inTravelParty
                        ? <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5b9bd5' }} title={t('availability.booked')}>✓</span>
                        : item.isRejected
                          ? <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#c07070' }} title={t('availability.rejected')}>✗</span>
                          : canSeeGebucht
                            ? <span style={{ fontSize: '0.75rem', color: '#d1d5db' }} title={t('availability.open')}>–</span>
                            : null
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Desktop Table */}
          {listView === 'list' && !isMobile && <div className="data-table-wrapper">
            <table className="data-table data-table--termine">
              <thead>
                <tr>
                  {([
                    [t('table.date'),   'date',          '7rem'],
                    [t('table.type'),   'art',           '8rem'],
                    [t('table.status'), 'statusBooking', '11rem'],
                    [t('table.public'), 'statusPublic',  '8rem'],
                    [t('table.title'),  'title',         '14rem'],
                    [t('table.city'),   'city',          '8rem'],
                    [t('table.venue'),  'venueName',     '11rem'],
                  ] as [string, keyof Termin, string | null][]).map(([label, key, w]) => (
                    <th
                      key={key as string}
                      className="sortable"
                      style={w ? { width: w } : undefined}
                      onClick={() => toggleTableSort(key)}
                    >
                      {label}
                      <span className={`sort-indicator${tableSortKey === key ? ' active' : ''}`}>
                        {tableSortKey === key ? (tableSortDir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </th>
                  ))}
                  <th className="text-center" style={{ width: '5.5rem' }}>{t('table.availability')}</th>
                  {canSeeGebucht && <th className="text-center" style={{ width: '4rem' }}>{t('table.booked')}</th>}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = tableRows.filter(row =>
                    `${row.title} ${row.city} ${row.art} ${row.artSub} ${row.date}`.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  if (filtered.length === 0) return (
                    <tr>
                      <td colSpan={canSeeGebucht ? 9 : 8} className="text-center" style={{ padding: '3rem 1rem', color: '#9ca3af' }}>
                        {termine.length === 0 ? t('appointments.emptyState') : t('appointments.noResults')}
                      </td>
                    </tr>
                  )
                  return filtered.map(termin => (
                  <tr key={termin.id} className="clickable" onClick={() => selectTermin(termin.id)}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTable(termin.date)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {termin.art
                        ? <><span className="font-medium text-gray-800">{termin.art}</span>{termin.artSub && <span className="text-gray-400 text-xs ml-1">· {termin.artSub}</span>}</>
                        : <span className="text-gray-400">–</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: (termin.statusBooking ? STATUS_BOOKING_DOT[termin.statusBooking] : undefined) || '#9ca3af' }}>
                        {termin.statusBooking
                          ? (STATUS_BOOKING_TKEY[termin.statusBooking] ? t(STATUS_BOOKING_TKEY[termin.statusBooking]) : termin.statusBooking)
                          : '–'}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: (termin.statusPublic ? STATUS_PUBLIC_DOT[termin.statusPublic] : undefined) || '#9ca3af' }}>
                        {termin.statusPublic
                          ? (STATUS_PUBLIC_TKEY[termin.statusPublic] ? t(STATUS_PUBLIC_TKEY[termin.statusPublic]) : termin.statusPublic)
                          : '–'}
                      </span>
                    </td>
                    <td className="font-medium text-gray-900" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '14rem' }}>{termin.title}</td>
                    <td className="text-gray-600 text-sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '10rem' }}>{termin.city || <span className="text-gray-300">–</span>}</td>
                    <td className="text-gray-600 text-sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '13rem' }}>{termin.venueName || <span className="text-gray-300">–</span>}</td>

                    {/* Verfügbar */}
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {(['available', 'maybe', 'unavailable'] as AvailStatus[]).map(s => {
                          const active = termin.myAvailability === s
                          const cfg = AVAIL_ICON[s as string]
                          return (
                            <button key={s}
                              onClick={e => { e.stopPropagation(); selectAvailability(termin, s) }}
                              title={t(cfg.tKey)}
                              className="w-4 h-4 rounded-full font-bold transition-all hover:scale-110 flex items-center justify-center text-xs"
                              style={{
                                backgroundColor: active ? cfg.color : 'transparent',
                                color: active ? '#fff' : '#d1d5db',
                                border: active ? 'none' : '1.5px solid #d1d5db',
                              }}>
                              {cfg.symbol}
                            </button>
                          )
                        })}
                        {termin.myAvailability === 'maybe' && (
                          <button
                            onClick={e => { e.stopPropagation(); setCommentPopup({ terminId: termin.id, comment: termin.myComment || '' }) }}
                            title={termin.myComment || ''}
                            className="text-gray-400 hover:text-yellow-500 transition-colors ml-0.5">
                            <MessageSquare size={11} fill={termin.myComment ? '#eab308' : 'none'} />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Gebucht */}
                    {canSeeGebucht && (
                    <td className="text-center">
                      {termin.inTravelParty
                        ? <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5b9bd5' }} title={t('availability.booked')}>✓</span>
                        : termin.isRejected
                          ? <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#c07070' }} title={t('availability.rejected')}>✗</span>
                          : <span style={{ fontSize: '0.8rem', color: '#d1d5db' }} title={t('availability.open')}>–</span>
                      }
                    </td>
                    )}
                  </tr>
                ))
                })()}
              </tbody>
            </table>
          </div>}
        </>
      )}

      {/* ---- Modal: Neuer Termin ---- */}
      {isModalOpen && (
        <TerminModal
          termin={editingTermin}
          onClose={closeModal}
          onSaved={saved => {
            if (editingTermin) {
              setTermine(prev => prev.map(t => t.id === saved.id ? { ...t, ...saved } : t))
            } else {
              setTermine(prev => [...prev, saved])
            }
            window.dispatchEvent(new CustomEvent('termin-list-changed'))
          }}
          onDeleted={id => {
            setTermine(prev => prev.filter(t => t.id !== id))
            closeModal()
          }}
          allowAddAnother
        />
      )}

      {/* ---- Comment popup ---- */}
      {commentPopup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold mb-3 text-gray-800">{t('availability.maybe')}</h3>
            <textarea
              value={commentPopup.comment}
              onChange={e => setCommentPopup(prev => prev ? { ...prev, comment: e.target.value } : null)}
              placeholder="z.B. Bin erst ab 18 Uhr da…"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              autoFocus
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => setCommentPopup(null)} className="text-sm text-gray-500 hover:text-gray-700">{t('general.cancel')}</button>
              <button onClick={saveComment} disabled={commentSaving}
                className="flex items-center gap-1 bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-yellow-600 disabled:opacity-50">
                {commentSaving ? <Loader2 size={12} className="animate-spin" /> : null} {t('general.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
