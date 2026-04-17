'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, X, Loader2, AlertCircle, MessageSquare, Check, ChevronLeft, ChevronRight, Edit2, Trash2 } from 'lucide-react'
import TerminFileCard from './TerminFileCard'
import TerminModal from './TerminModal'
import VenueModal from '../venues/VenueModal'
import PartnerModal from '../partners/PartnerModal'
import LokaleKontakteCard from './LokaleKontakteCard'
import ZeitplaeneCard from './ZeitplaeneCard'
import ReisegruppeView from './ReisegruppeView'
import AdvanceSheetView from './AdvanceSheetView'
import KalenderView from './KalenderView'
import AnreiseCard from './AnreiseCard'
import HotelCard from './HotelCard'
import ContentBoard from '@/app/components/shared/ContentBoard'
import TerminChatCard from './TerminChatCard'
import ToDoCard from './ToDoCard'
import CateringCard from './CateringCard'
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

const AVAIL_ICON: Record<string, { label: string; color: string; symbol: string }> = {
  available:   { label: 'Verfügbar',       color: '#22c55e', symbol: '✓' },
  maybe:       { label: 'Vielleicht',      color: '#eab308', symbol: '?' },
  unavailable: { label: 'Nicht verfügbar', color: '#ef4444', symbol: '✗' },
  null:        { label: 'Keine Angabe',    color: '#9ca3af', symbol: '–' },
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

function formatDateLong(dateStr: string, withWeekday = true) {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    ...(withWeekday ? { weekday: 'long' } : {}),
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

function formatDateTable(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ============================================================
// Veranstaltung-Card (detail view, editable)
// ============================================================

function VeranstaltungCard({ termin, isAdmin, onEditClick }: {
  termin: Termin
  isAdmin: boolean
  onEditClick: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Veranstaltung</span>
        {isAdmin && (
          <button onClick={onEditClick} className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
            <Edit2 size={12} />
          </button>
        )}
      </div>
      <div className="px-5 py-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
          <dt className="text-gray-400 font-medium whitespace-nowrap">Datum</dt>
          <dd className="text-gray-800">{formatDateLong(termin.date)}</dd>
          <dt className="text-gray-400 font-medium">Titel</dt>
          <dd className="text-gray-800 font-semibold">{termin.title}</dd>
          {(termin.art || termin.artSub) && (
            <>
              <dt className="text-gray-400 font-medium">Art</dt>
              <dd className="text-gray-800">
                {termin.art}{termin.artSub && <span className="text-gray-400 ml-1">· {termin.artSub}</span>}
              </dd>
            </>
          )}
          {termin.statusBooking && (
            <>
              <dt className="text-gray-400 font-medium">Status</dt>
              <dd><span className={STATUS_BOOKING_COLOR[termin.statusBooking] || 'badge badge-gray'}>{termin.statusBooking}</span></dd>
            </>
          )}
          {termin.statusPublic && (
            <>
              <dt className="text-gray-400 font-medium">Öffentlich</dt>
              <dd><span className={STATUS_PUBLIC_COLOR[termin.statusPublic] || 'badge badge-gray'}>{termin.statusPublic}</span></dd>
            </>
          )}
        </dl>
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
  }
}

const EMPTY_VENUE = { name: '', city: '', postalCode: '', capacity: '', street: '', state: '', country: '', website: '', arrival: '', arrivalStreet: '', arrivalPostalCode: '', arrivalCity: '', capacitySeated: '', stageDimensions: '', clearanceHeight: '', merchandiseFee: '', merchandiseStand: '', wardrobe: '', showers: '', wifi: '', parking: '', nightlinerParking: '', loadingPath: '', notes: '' }

function SpielstaetteCard({ termin, isAdmin, onUpdated }: {
  termin: Termin
  isAdmin: boolean
  onUpdated: (t: Termin) => void
}) {
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
      setCardError(e instanceof Error ? e.message : 'Fehler beim Speichern')
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
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Spielstätte & Ort</span>
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
              placeholder="Name oder Ort suchen…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {termin.venueId && (
                <button onClick={() => linkVenue(null)} disabled={saving}
                  className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors">
                  Spielstätte entfernen
                </button>
              )}
              <button onClick={() => { setVenueToEdit(null); setVenueModalOpen(true); setSelecting(false) }}
                className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1">
                <Plus size={11} /> Neue Spielstätte anlegen
              </button>
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-xs text-gray-400 text-center">Keine Treffer</div>
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
                <dt className="text-gray-400 font-medium">Ort</dt>
                <dd className="text-gray-800">
                  {[currentVenue?.postalCode, currentVenue?.city || termin.city].filter(Boolean).join(' ')}
                </dd>
              </>
            )}
            {currentVenue?.capacity && (
              <>
                <dt className="text-gray-400 font-medium">Kapazität</dt>
                <dd className="text-gray-800">{Number(currentVenue.capacity).toLocaleString('de-DE')}</dd>
              </>
            )}
            {currentVenue?.website && (
              <>
                <dt className="text-gray-400 font-medium">Website</dt>
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
            Keine Spielstätte verknüpft
            {isAdmin && <span className="block text-xs mt-1">→ „Verknüpfen" oben rechts</span>}
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
      setCardError(e instanceof Error ? e.message : 'Fehler beim Speichern')
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
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Partner</span>
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
            <input type="text" autoFocus placeholder="Firma, Ort oder Ansprechpartner…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {termin.partnerId && (
                <button onClick={() => linkPartner(null)} disabled={saving}
                  className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors">
                  Partner entfernen
                </button>
              )}
              <button
                onClick={() => { setPartnerToEdit(null); setPartnerModalOpen(true); setSelecting(false) }}
                className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1">
                <Plus size={11} /> Neuen Partner anlegen
              </button>
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-xs text-gray-400 text-center">Keine Treffer</div>
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
            Kein Partner verknüpft
            {isAdmin && <span className="block text-xs mt-1">→ „Verknüpfen" oben rechts</span>}
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
// Detail view (inline, SPA)
// ============================================================

// Neighbour termin button (prev/next, with distance-based opacity/size)
function TerminDatumzeile({ termin, termine, onNavigate }: {
  termin: Termin
  termine: Termin[]
  onNavigate: (id: number) => void
}) {
  const idx = termine.findIndex(t => t.id === termin.id)
  const prev2 = idx >= 2 ? termine[idx - 2] : null
  const prev1 = idx >= 1 ? termine[idx - 1] : null
  const next1 = idx < termine.length - 1 ? termine[idx + 1] : null
  const next2 = idx < termine.length - 2 ? termine[idx + 2] : null

  const locationLabel = [termin.city, termin.venueName].filter(Boolean).join(' · ')
  const pageTitle = termin.showTitleAsHeader ? termin.title : locationLabel || termin.title

  return (
    <div className="pt-datumzeile">
      <div className="pt-datumzeile-neighbors--left">
        {prev1 && (
          <>
            {prev2 && <NeighbourBtn t={prev2} distance={2} dir="prev" onClick={() => onNavigate(prev2.id)} />}
            <NeighbourBtn t={prev1} distance={1} dir="prev" onClick={() => onNavigate(prev1.id)} />
          </>
        )}
      </div>
      <div className="pt-datumzeile-center">
        <div className="pt-datumzeile-center-date">{formatDateLong(termin.date)}</div>
        <div className="pt-datumzeile-center-label">{pageTitle}</div>
      </div>
      <div className="pt-datumzeile-neighbors--right">
        {next1 && <NeighbourBtn t={next1} distance={1} dir="next" onClick={() => onNavigate(next1.id)} />}
        {next2 && <NeighbourBtn t={next2} distance={2} dir="next" onClick={() => onNavigate(next2.id)} />}
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
  const cityLabel = t.city || ''

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

function TerminDetail({
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
            onEditClick={() => setModalOpen(true)}
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
          <PlaceholderCard title="Sonstiges" />
          <PlaceholderCard title="Setlist" />
        </div>

      </div>

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
// Main component
// ============================================================

export default function TerminePage({
  initialSelectedId,
  onNavigated,
}: {
  initialSelectedId?: number | null
  onNavigated?: () => void
} = {}) {
  const [termine, setTermine] = useState<Termin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Filter + View (synced with Navigation SubMenu)
  const [termineFilter, setTermineFilter] = useState<'aktuell' | 'vergangen' | 'alle'>('aktuell')
  const [listView, setListView] = useState<'list' | 'calendar'>('list')

  // Detail view
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailView, setDetailView] = useState<'details' | 'travelparty' | 'advance-sheet'>('details')

  // Reset sub-view when switching termin or leaving detail
  useEffect(() => {
    if (selectedId === null) {
      setDetailView('details')
      loadData()
    }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Notify Navigation when detail view changes; listen for "go to list" event
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('termine-view-changed', {
      detail: { inDetail: selectedId !== null, view: detailView }
    }))
  }, [selectedId, detailView])

  useEffect(() => {
    const handler = () => setSelectedId(null)
    window.addEventListener('termine-go-to-list', handler)
    return () => window.removeEventListener('termine-go-to-list', handler)
  }, [])

  // Von Schreibtisch: direkt zu einem Termin springen
  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId)
      onNavigated?.()
    }
  }, [initialSelectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ view: 'details' | 'travelparty' | 'advance-sheet' }>).detail
      if (detail?.view) setDetailView(detail.view)
    }
    window.addEventListener('termine-set-view', handler)
    return () => window.removeEventListener('termine-set-view', handler)
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

  // New/edit modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTermin, setEditingTermin] = useState<Termin | null>(null)

  // Availability comment popup
  const [commentPopup, setCommentPopup] = useState<{ terminId: number; comment: string } | null>(null)
  const [commentSaving, setCommentSaving] = useState(false)

  const currentUser = getCurrentUser()
  const effectiveRole = getEffectiveRole()
  const isAdmin  = isAdminRole(effectiveRole)                        // admin + tourmanagement
  const isEditor = isEditorRole(effectiveRole)                       // admin + agency + tourmanagement (CAN_EDIT)
  const canCreate    = canDo(effectiveRole, CAN_CREATE_TERMIN)       // admin + agency
  const canSeeGebucht = canDo(effectiveRole, CAN_SEE_GEBUCHT)        // admin + tourmanagement + agency
  const canSeeFiles   = canDo(effectiveRole, CAN_SEE_FILES_TERMIN)   // admin + tourmanagement + agency + artist + crew_plus

  // ---- Load data ----

  const loadData = useCallback(async () => {
    if (!isAuthenticated()) { setAuthError(true); setLoading(false); return }
    try {
      setLoading(true)
      setError(null)
      const t = await getTermine()
      setTermine(t)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verbindung zum Server fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ---- Modal helpers ----

  const openNew = () => { setEditingTermin(null); setIsModalOpen(true) }
  const openEdit = (t: Termin) => { setEditingTermin(t); setIsModalOpen(true) }
  const closeModal = () => { setIsModalOpen(false); setEditingTermin(null) }

  const handleDelete = async (id: number) => {
    if (!confirm('Termin wirklich löschen?')) return
    try {
      await deleteTermin(id)
      setTermine(prev => prev.filter(t => t.id !== id))
      if (selectedId === id) setSelectedId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Löschen fehlgeschlagen')
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
  const filteredTermine = sortedTermine.filter(t => {
    if (termineFilter === 'aktuell')   { if (t.date < today) return false }
    if (termineFilter === 'vergangen') { if (t.date >= today) return false }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      if (![t.title, t.city, t.venueName, t.art].some(v => v?.toLowerCase().includes(q))) return false
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

  // ---- Detail navigation helpers ----
  const selectedTermin = selectedId !== null ? termine.find(t => t.id === selectedId) ?? null : null

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
      <p>Lade Termine…</p>
    </div>
  )

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="module-content">

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* ---- DETAIL VIEW ---- */}
      {selectedTermin ? (
        <>
          {/* Datumzeile bleibt in beiden Sub-Views sichtbar */}
          <TerminDatumzeile
            termin={selectedTermin}
            termine={sortedTermine}
            onNavigate={id => setSelectedId(id)}
          />
          {detailView === 'travelparty' ? (
            <ReisegruppeView terminId={selectedTermin.id} isAdmin={isAdmin} />
          ) : detailView === 'advance-sheet' ? (
            <AdvanceSheetView terminId={selectedTermin.id} />
          ) : (
            <TerminDetail
              termin={selectedTermin}
              termine={sortedTermine}
              isAdmin={isEditor}
              canSeeFiles={canSeeFiles}
              onUpdated={updated => {
                setTermine(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
              }}
              onDeleted={() => {
                setTermine(prev => prev.filter(t => t.id !== selectedId))
                setSelectedId(null)
              }}
            />
          )}
        </>
      ) : (
        /* ---- LIST VIEW ---- */
        <>
          {/* Header */}
          {canCreate && (
            <button onClick={openNew} className="btn btn-primary">
              <Plus size={16} /> Neuer Termin
            </button>
          )}

          {/* Search */}
          {listView === 'list' && (
            <input
              type="text"
              placeholder="Termine durchsuchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          )}

          {/* Kalender-View */}
          {listView === 'calendar' && (
            <KalenderView
              termine={filteredTermine}
              onSelectTermin={id => setSelectedId(id)}
            />
          )}

          {/* Table */}
          {listView === 'list' && <div className="data-table-wrapper">
            <table className="data-table data-table--termine">
              <thead>
                <tr>
                  {([
                    ['Datum', 'date', '7rem'],
                    ['Art', 'art', '8rem'],
                    ['Status', 'statusBooking', '11rem'],
                    ['Öffentlich', 'statusPublic', '8rem'],
                    ['Titel', 'title', '14rem'],
                    ['Ort', 'city', '8rem'],
                    ['Spielstätte', 'venueName', '11rem'],
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
                  <th className="text-center" style={{ width: '5.5rem' }}>Verf.</th>
                  {canSeeGebucht && <th className="text-center" style={{ width: '4rem' }}>Gebucht</th>}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = tableRows.filter(t =>
                    `${t.title} ${t.city} ${t.art} ${t.artSub} ${t.date}`.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  if (filtered.length === 0) return (
                    <tr>
                      <td colSpan={canSeeGebucht ? 9 : 8} className="text-center" style={{ padding: '3rem 1rem', color: '#9ca3af' }}>
                        {termine.length === 0 ? 'Noch keine Termine. Mit „+ Neuer Termin" starten.' : 'Keine Treffer'}
                      </td>
                    </tr>
                  )
                  return filtered.map(termin => (
                  <tr key={termin.id} className="clickable" onClick={() => setSelectedId(termin.id)}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTable(termin.date)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {termin.art
                        ? <><span className="font-medium text-gray-800">{termin.art}</span>{termin.artSub && <span className="text-gray-400 text-xs ml-1">· {termin.artSub}</span>}</>
                        : <span className="text-gray-400">–</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {termin.statusBooking
                        ? <span className={STATUS_BOOKING_COLOR[termin.statusBooking] || 'badge badge-gray'}>{termin.statusBooking}</span>
                        : <span className="text-gray-400">–</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {termin.statusPublic
                        ? <span className={STATUS_PUBLIC_COLOR[termin.statusPublic] || 'badge badge-gray'}>{termin.statusPublic}</span>
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
                              title={cfg.label}
                              className="w-4 h-4 rounded-full font-bold text-white transition-transform hover:scale-110 flex items-center justify-center text-xs"
                              style={{ backgroundColor: active ? cfg.color : '#d1d5db' }}>
                              {cfg.symbol}
                            </button>
                          )
                        })}
                        {termin.myAvailability === 'maybe' && (
                          <button
                            onClick={e => { e.stopPropagation(); setCommentPopup({ terminId: termin.id, comment: termin.myComment || '' }) }}
                            title={termin.myComment || 'Kommentar hinzufügen'}
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
                        ? <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#3b82f6' }} title="Gebucht – in Reisegruppe">✓</span>
                        : termin.isRejected
                          ? <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#ef4444' }} title="Abgesagt">✗</span>
                          : <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#e5e7eb', color: '#9ca3af' }} title="Offen">–</span>
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

      {/* ---- Modal: Neuer/Edit Termin ---- */}
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
          }}
          onDeleted={id => {
            setTermine(prev => prev.filter(t => t.id !== id))
            if (selectedId === id) setSelectedId(null)
            closeModal()
          }}
          allowAddAnother
        />
      )}

      {/* ---- Comment popup ---- */}
      {commentPopup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold mb-3 text-gray-800">Kommentar zu „Vielleicht"</h3>
            <textarea
              value={commentPopup.comment}
              onChange={e => setCommentPopup(prev => prev ? { ...prev, comment: e.target.value } : null)}
              placeholder="z.B. Bin erst ab 18 Uhr da…"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              autoFocus
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => setCommentPopup(null)} className="text-sm text-gray-500 hover:text-gray-700">Abbrechen</button>
              <button onClick={saveComment} disabled={commentSaving}
                className="flex items-center gap-1 bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-yellow-600 disabled:opacity-50">
                {commentSaving ? <Loader2 size={12} className="animate-spin" /> : null} Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
