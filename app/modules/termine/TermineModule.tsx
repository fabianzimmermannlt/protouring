'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { usePolling } from '@/app/hooks/usePolling'
import { useIsMobile } from '@/app/hooks/useIsMobile'
import { useT } from '@/app/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/app/lib/i18n/translations/de'
import { Plus, X, Loader2, AlertCircle, MessageSquare, Check, ChevronLeft, ChevronRight, Edit2, Trash2 } from 'lucide-react'
import TerminFileCard from './TerminFileCard'
import TerminModal from './TerminModal'
import VenueModal from '../venues/VenueModal'
import PartnerModal from '../partners/PartnerModal'
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

const STATUS_BOOKING_COLOR: Record<string, string> = {
  'Idee':                 'badge badge-gray',
  'Option':               'badge badge-yellow',
  'noch nicht bestätigt': 'badge badge-orange',
  'bestätigt':            'badge badge-green',
  'abgeschlossen':        'badge badge-blue',
  'abgesagt':             'badge badge-red',
}

const STATUS_PUBLIC_COLOR: Record<string, string> = {
  'nicht öffentlich': 'badge badge-gray',
  'tba':              'badge badge-yellow',
  'veröffentlicht':   'badge badge-green',
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
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<TerminFormData>(terminToFormData(termin))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!editing) setForm(terminToFormData(termin))
  }, [termin, editing])

  const startEdit = () => { setForm(terminToFormData(termin)); setEditing(true) }
  const cancelEdit = () => { setForm(terminToFormData(termin)); setEditing(false); setError('') }
  const f = (key: keyof TerminFormData, value: string | boolean | null) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      const updated = await updateTermin(termin.id, form)
      onUpdated(updated)
      setEditing(false)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const iCls = "w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('appointments.card.event')}</span>
        {isAdmin && !editing && (
          <button onClick={startEdit} className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
            <Edit2 size={12} />
          </button>
        )}
        {editing && (
          <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
        )}
      </div>

      {error && (
        <div className="mx-5 mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-center gap-2">
          <AlertCircle size={12} /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={12} /></button>
        </div>
      )}

      <div className="px-5 py-4">
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1">{t('appointments.card.date')}</label>
              <input type="date" className={iCls} value={form.date} onChange={e => f('date', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1">{t('appointments.card.title')}</label>
              <input type="text" className={iCls} value={form.title} onChange={e => f('title', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1">{t('appointments.card.type')}</label>
                <select className={iCls} value={form.art || ''} onChange={e => f('art', e.target.value)}>
                  <option value="">—</option>
                  {TERMIN_ART.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1">Sub-Typ</label>
                <select className={iCls} value={form.art_sub || ''} onChange={e => f('art_sub', e.target.value)}>
                  <option value="">—</option>
                  {TERMIN_ART_SUB.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1">{t('appointments.card.statusBooking')}</label>
                <select className={iCls} value={form.status_booking || ''} onChange={e => f('status_booking', e.target.value)}>
                  {TERMIN_STATUS_BOOKING.map(s => <option key={s} value={s}>{STATUS_BOOKING_TKEY[s] ? t(STATUS_BOOKING_TKEY[s]) : s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1">{t('appointments.card.statusPublic')}</label>
                <select className={iCls} value={form.status_public || ''} onChange={e => f('status_public', e.target.value)}>
                  {TERMIN_STATUS_PUBLIC.map(s => <option key={s} value={s}>{STATUS_PUBLIC_TKEY[s] ? t(STATUS_PUBLIC_TKEY[s]) : s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium disabled:opacity-50 transition-colors">
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                Speichern
              </button>
              <button onClick={cancelEdit} disabled={saving}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
            <dt className="text-gray-400 font-medium whitespace-nowrap">{t('appointments.card.date')}</dt>
            <dd className="text-gray-800">{formatDateLong(termin.date)}</dd>
            <dt className="text-gray-400 font-medium">{t('appointments.card.title')}</dt>
            <dd className="text-gray-800 font-semibold">{termin.title}</dd>
            {(termin.art || termin.artSub) && (
              <>
                <dt className="text-gray-400 font-medium">{t('appointments.card.type')}</dt>
                <dd className="text-gray-800">
                  {termin.art}{termin.artSub && <span className="text-gray-400 ml-1">· {termin.artSub}</span>}
                </dd>
              </>
            )}
            {termin.statusBooking && (
              <>
                <dt className="text-gray-400 font-medium">{t('appointments.card.statusBooking')}</dt>
                <dd>
                  <span className={STATUS_BOOKING_COLOR[termin.statusBooking] || 'badge badge-gray'}>
                    {STATUS_BOOKING_TKEY[termin.statusBooking] ? t(STATUS_BOOKING_TKEY[termin.statusBooking]) : termin.statusBooking}
                  </span>
                </dd>
              </>
            )}
            {termin.statusPublic && (
              <>
                <dt className="text-gray-400 font-medium">{t('appointments.card.statusPublic')}</dt>
                <dd>
                  <span className={STATUS_PUBLIC_COLOR[termin.statusPublic] || 'badge badge-gray'}>
                    {STATUS_PUBLIC_TKEY[termin.statusPublic] ? t(STATUS_PUBLIC_TKEY[termin.statusPublic]) : termin.statusPublic}
                  </span>
                </dd>
              </>
            )}
          </dl>
        )}
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('appointments.card.venue')}</span>
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

      <div className="px-5 py-4">
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
              <button onClick={() => { setVenueToEdit(null); setVenueModalOpen(true); setSelecting(false) }}
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('partners.title')}</span>
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

      <div className="px-5 py-4">
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
                onClick={() => { setPartnerToEdit(null); setPartnerModalOpen(true); setSelecting(false) }}
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

      {/* PartnerModal */}
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

  const locationLabel = [termin.city, termin.venueName].filter(Boolean).join(' · ')
  const pageTitle = termin.showTitleAsHeader ? termin.title : locationLabel || termin.title

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

      {/* Zeile 1: Event + Schnellzugriff */}
      <section>
        <SectionLabel label="Event" />
        <div className="grid grid-cols-3 gap-4">
          <VeranstaltungCard
            key={termin.id}
            termin={termin}
            isAdmin={isAdmin}
            onUpdated={onUpdated}
          />
          <ToDoCard terminId={termin.id} />
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
      </section>

      {/* Venue-Bereich: Verlinkung + Details + Lokale Ansprechpartner */}
      <section>
        <VenueInfoSection
          venueId={termin.venueId ?? null}
          venueName={termin.venueName}
          isAdmin={isAdmin}
          termin={termin}
          onTerminUpdated={onUpdated}
        />
        {termin.venueId && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-0.5">Lokale Ansprechpartner</div>
            <LokaleKontakteCard terminId={termin.id} isAdmin={isAdmin} layout="grid-3" />
          </div>
        )}
      </section>

      {/* Partner */}
      <section>
        <SectionLabel label="Partner" />
        <div className="grid grid-cols-3 gap-4">
          <PartnerCard
            key={`partner-${termin.id}`}
            termin={termin}
            isAdmin={isAdmin}
            onUpdated={onUpdated}
          />
        </div>
      </section>

      {/* Kommunikation */}
      <section>
        <SectionLabel label="Kommunikation" />
        <div className="grid grid-cols-3 gap-4">
          {canSeeFiles && <TerminFileCard terminId={String(termin.id)} className="min-h-[200px]" />}
          <div className={canSeeFiles ? 'col-span-2' : 'col-span-3'}>
            <TerminChatCard terminId={termin.id} />
          </div>
        </div>
      </section>

    </div>
  )
}

// ============================================================
// Main component
// ============================================================

export default function TerminePage() {
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

  // Notify Navigation: we are in list mode (only when no termin selected)
  useEffect(() => {
    if (!selectedTerminId) {
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
        {!isL3 && (
          <TerminDatumzeile
            termin={selectedTermin}
            termine={sortedTermine}
            onNavigate={id => selectTermin(id, selectedView)}
          />
        )}
        {selectedView === 'travelparty' ? (
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
          {/* Header: Neuer Termin + Filter-Buttons */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {canCreate ? (
              <button onClick={openNew} className="btn btn-primary">
                <Plus size={16} /> {t('appointments.new')}
              </button>
            ) : <div />}

            {/* Filter-Gruppe */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              {(['aktuell', 'vergangen', 'alle'] as const).map(f => {
                const labels = {
                  aktuell:  t('appointments.filter.current'),
                  vergangen: t('appointments.filter.past'),
                  alle:     t('appointments.filter.all'),
                }
                const active = listView === 'list' && termineFilter === f
                return (
                  <button
                    key={f}
                    onClick={() => {
                      setTermineFilter(f)
                      setListView('list')
                      window.dispatchEvent(new CustomEvent('termine-filter-changed', { detail: { filter: f } }))
                      window.dispatchEvent(new CustomEvent('termine-listview-changed', { detail: { view: 'list' } }))
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      active
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {labels[f]}
                  </button>
                )
              })}
              {canDo(effectiveRole, CAN_SEE_KALENDER) && (
                <button
                  onClick={() => {
                    setListView('calendar')
                    window.dispatchEvent(new CustomEvent('termine-listview-changed', { detail: { view: 'calendar' } }))
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    listView === 'calendar'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t('appointments.calendar')}
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          {listView === 'list' && (
            <input
              type="text"
              placeholder={t('appointments.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          )}

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
                        <span className={`${STATUS_BOOKING_COLOR[item.statusBooking] || 'badge badge-gray'} flex-shrink-0`}>
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
                            className="w-5 h-5 rounded-full font-bold text-white flex items-center justify-center text-xs transition-transform active:scale-110"
                            style={{ backgroundColor: active ? cfg.color : '#d1d5db' }}
                          >
                            {cfg.symbol}
                          </button>
                        )
                      })}
                    </div>
                    {/* Gebucht-Status: Admins sehen ihn immer, Crew sieht eigenen Status */}
                    {(canSeeGebucht || item.inTravelParty || item.isRejected) && (
                      item.inTravelParty
                        ? <span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: '#3b82f6' }} title={t('availability.booked')}>✓</span>
                        : item.isRejected
                          ? <span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: '#ef4444' }} title={t('availability.rejected')}>✗</span>
                          : canSeeGebucht
                            ? <span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#e5e7eb', color: '#9ca3af' }} title={t('availability.open')}>–</span>
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
                      {termin.statusBooking
                        ? <span className={STATUS_BOOKING_COLOR[termin.statusBooking] || 'badge badge-gray'}>
                            {STATUS_BOOKING_TKEY[termin.statusBooking] ? t(STATUS_BOOKING_TKEY[termin.statusBooking]) : termin.statusBooking}
                          </span>
                        : <span className="text-gray-400">–</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {termin.statusPublic
                        ? <span className={STATUS_PUBLIC_COLOR[termin.statusPublic] || 'badge badge-gray'}>
                            {STATUS_PUBLIC_TKEY[termin.statusPublic] ? t(STATUS_PUBLIC_TKEY[termin.statusPublic]) : termin.statusPublic}
                          </span>
                        : <span className="text-gray-400">–</span>}
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
                              className="w-4 h-4 rounded-full font-bold text-white transition-transform hover:scale-110 flex items-center justify-center text-xs"
                              style={{ backgroundColor: active ? cfg.color : '#d1d5db' }}>
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
                        ? <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#3b82f6' }} title={t('availability.booked')}>✓</span>
                        : termin.isRejected
                          ? <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#ef4444' }} title={t('availability.rejected')}>✗</span>
                          : <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#e5e7eb', color: '#9ca3af' }} title={t('availability.open')}>–</span>
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
