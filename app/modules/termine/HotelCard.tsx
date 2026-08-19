'use client'

import { useState, useEffect } from 'react'
import { Plus, Loader2, Building2, BedDouble, BedSingle, ChevronRight, ChevronDown, Star } from 'lucide-react'
import {
  getHotelStays,
  getTravelParty,
  setTravelPartyNoHotel,
  reorderHotelStays,
  getTravelLegs,
  getTenantSetting,
  setHotelRecommended,
  getAuthToken,
  getCurrentTenant,
  API_BASE,
  type HotelStay,
  type TravelPartyMember,
  type TravelLeg,
  type RoomType,
} from '@/lib/api-client'
import { renderBoardContent } from '@/app/components/shared/ContentBoard'
import HotelModal from './HotelModal'

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  einzelzimmer: 'Einzelzimmer',
  doppelzimmer: 'Doppelzimmer',
  twin:         'Twin Room',
  suite:        'Suite',
  duschzimmer:  'Duschzimmer',
  sonstiges:    'Sonstiges',
}

const ROOM_CAPACITY: Record<RoomType, number | null> = {
  einzelzimmer: 1,
  doppelzimmer:  2,
  twin:          2,
  suite:         null,
  duschzimmer:   1,
  sonstiges:     null,
}

function formatDate(d: string): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return d }
}

export default function HotelCard({
  terminId,
  isAdmin,
  terminDate,
  legsRefreshKey = 0,
  collapsible = false,
}: {
  terminId: number
  isAdmin: boolean
  terminDate: string
  legsRefreshKey?: number
  collapsible?: boolean
}) {
  const [collapsed, setCollapsed] = useState(collapsible)
  const [stays, setStays] = useState<HotelStay[]>([])
  const [travelParty, setTravelParty] = useState<TravelPartyMember[]>([])
  const [travelLegs, setTravelLegs] = useState<TravelLeg[]>([])
  const [nlExcludeAnreise, setNlExcludeAnreise] = useState(true)
  const [nlExcludeAbreise, setNlExcludeAbreise] = useState(true)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editStay, setEditStay] = useState<HotelStay | null>(null)
  const [expandedRooms, setExpandedRooms] = useState<Set<number>>(new Set())
  const [showHomePanel, setShowHomePanel] = useState(false)

  // "Fährt heim (kein Hotel)" pro Person umschalten – optimistisch, revert bei Fehler.
  const toggleNoHotel = async (m: TravelPartyMember) => {
    const next = !m.noHotel
    setTravelParty(prev => prev.map(x => x.id === m.id ? { ...x, noHotel: next } : x))
    try { await setTravelPartyNoHotel(terminId, m.id, next) }
    catch { setTravelParty(prev => prev.map(x => x.id === m.id ? { ...x, noHotel: !next } : x)) }
  }

  const toggleRooms = (stayId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedRooms(prev => {
      const next = new Set(prev)
      if (next.has(stayId)) next.delete(stayId)
      else next.add(stayId)
      return next
    })
  }

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([
      getHotelStays(terminId),
      getTravelParty(terminId),
      getTravelLegs(terminId),
      getTenantSetting('nightliner_exclude_anreise'),
      getTenantSetting('nightliner_exclude_abreise'),
    ]).then(([s, tp, legs, nlAnr, nlAbr]) => {
      if (s.status === 'fulfilled') setStays(s.value)
      if (tp.status === 'fulfilled') setTravelParty(tp.value)
      if (legs.status === 'fulfilled') setTravelLegs(legs.value)
      // Default: aktiv (null = nicht gesetzt = Standard = aktiv)
      setNlExcludeAnreise(nlAnr.status === 'fulfilled' ? nlAnr.value !== '0' : true)
      setNlExcludeAbreise(nlAbr.status === 'fulfilled' ? nlAbr.value !== '0' : true)
    }).finally(() => setLoading(false))
  }, [terminId, legsRefreshKey])

  const openNew = () => { setEditStay(null); setModalOpen(true) }
  const openEdit = (stay: HotelStay) => { setEditStay(stay); setModalOpen(true) }

  // Drag & Drop zum Umsortieren der Hotel-Kacheln (optimistisch, revert bei Fehler).
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const doReorder = async (from: number | null, to: number) => {
    if (from == null || from === to) return
    const reordered = [...stays]
    const [x] = reordered.splice(from, 1)
    reordered.splice(to, 0, x)
    const snapshot = stays
    setStays(reordered)
    try { await reorderHotelStays(terminId, reordered.map(s => s.id)) }
    catch { setStays(snapshot) }
  }

  // Empfehlung-Flag am zugewiesenen Hotel umschalten (wirkt auf alle Stays mit demselben Hotel)
  const toggleRecommended = async (stay: HotelStay, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!stay.hotelId) return
    const next = !stay.hotelRecommended
    setStays(prev => prev.map(s => s.hotelId === stay.hotelId ? { ...s, hotelRecommended: next } : s))
    try { await setHotelRecommended(String(stay.hotelId), next) }
    catch { setStays(prev => prev.map(s => s.hotelId === stay.hotelId ? { ...s, hotelRecommended: !next } : s)) }
  }

  const openHotelPdf = () => {
    const token = getAuthToken()
    const tenant = getCurrentTenant()
    const params = new URLSearchParams()
    if (token) params.set('token', token)
    if (tenant?.slug) params.set('tenant', tenant.slug)
    window.open(`${API_BASE}/api/termine/${terminId}/hotel-pdf?${params}`, '_blank')
  }

  const handleSaved = (saved: HotelStay) => {
    setStays(prev => {
      const idx = prev.findIndex(s => s.id === saved.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [...prev, saved]
    })
  }

  const handleDeleted = (stayId: number) => {
    setStays(prev => prev.filter(s => s.id !== stayId))
  }

  // Alle verplanten Personen außerhalb des aktuellen Stays
  const assignedInOtherStays = (currentStayId: number | null) =>
    new Set(
      stays
        .filter(s => s.id !== currentStayId)
        .flatMap(s => s.rooms.flatMap(r => r.persons.map(p => p.travelPartyMemberId)))
    )

  // Nightliner-Passagiere: Union über An- und/oder Abreise-Legs (je nach Setting)
  const nightlinerExcluded = new Set<number>()
  for (const leg of travelLegs) {
    if (leg.vehicleType !== 'Nightliner') continue
    if (leg.legType === 'anreise' && nlExcludeAnreise) {
      leg.persons.forEach(p => nightlinerExcluded.add(p.travelPartyMemberId))
    }
    if (leg.legType === 'abreise' && nlExcludeAbreise) {
      leg.persons.forEach(p => nightlinerExcluded.add(p.travelPartyMemberId))
    }
  }

  // Ungeplante Personen = in keinem Zimmer eines Stays UND nicht im Nightliner (laut Settings)
  const allAssigned = new Set(
    stays.flatMap(s => s.rooms.flatMap(r => r.persons.map(p => p.travelPartyMemberId)))
  )
  // Personen ohne Zimmer & nicht im Nightliner: brauchen entweder ein Bett (offen)
  // oder fahren heim (no_hotel). "Fährt heim" zählt nicht als offen.
  const relevantForHotel = travelParty.filter(m => !allAssigned.has(m.id) && !nightlinerExcluded.has(m.id))
  const unplannedMembers = relevantForHotel.filter(m => !m.noHotel)
  const noHotelMembers = relevantForHotel.filter(m => m.noHotel)
  const unplannedCount = unplannedMembers.length
  const unplannedNames = unplannedMembers.map(m => `${m.firstName} ${m.lastName}`.trim()).filter(Boolean).join('\n')

  return (
    <div className="pt-card">
      <div className="pt-card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0' }}>
        <div
          onClick={collapsible ? () => setCollapsed(c => !c) : undefined}
          className={collapsible ? 'cursor-pointer md:cursor-default' : ''}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {collapsible && (
              <span className="md:hidden inline-flex items-center">
                {collapsed ? <ChevronRight size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </span>
            )}
            <span className="pt-card-title">Hotels</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {stays.length > 0 && (
              <button
                onClick={e => { e.stopPropagation(); openHotelPdf() }}
                className="text-gray-400 hover:text-blue-600 transition-colors"
                title="Hotelbelegung als PDF"
              >
                <svg width="13" height="16" viewBox="0 0 26 32" fill="none" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
                  <path d="M0 0H18L26 8V32H0V0Z" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <path d="M18 0V8H26" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <rect x="0" y="20" width="26" height="12" fill="currentColor"/>
                  <text x="3" y="29" fontSize="9" fontWeight="800" fill="white" fontFamily="Helvetica,Arial,sans-serif" letterSpacing="0.5">PDF</text>
                </svg>
              </button>
            )}
            {isAdmin && (
              <button className="pt-card-add-btn" onClick={e => { e.stopPropagation(); openNew() }} title="Hotel hinzufügen">
                <Plus size={14} />
              </button>
            )}
          </div>
        </div>
        {!loading && (unplannedCount > 0 || noHotelMembers.length > 0) && (
          <button type="button" onClick={e => { e.stopPropagation(); setShowHomePanel(v => !v) }}
            className="pt-leg-unplanned-hint"
            style={{ marginTop: 0, marginBottom: '-0.4rem', cursor: 'pointer', background: 'none', border: 'none', padding: 0, textAlign: 'left', textDecoration: 'underline dotted', textUnderlineOffset: 2 }}
            title={unplannedNames ? `Nicht eingeplant:\n${unplannedNames}\n\n(Klicken: „fährt heim" verwalten)` : 'Klicken: „fährt heim" verwalten'}>
            {unplannedCount > 0 ? `${unplannedCount} nicht eingeplant` : 'alle eingeplant'}{noHotelMembers.length > 0 ? ` · ${noHotelMembers.length} fährt heim` : ''}
          </button>
        )}
      </div>

      <div className={`pt-card-body ${collapsible && collapsed ? 'hidden md:block' : ''}`}>
        {loading && (
          <div className="pt-leg-empty">
            <Loader2 size={16} className="animate-spin" style={{ display: 'inline' }} />
          </div>
        )}

        {!loading && showHomePanel && relevantForHotel.length > 0 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginBottom: 10, background: 'var(--surface-2)' }}>
            <div className="text-xs" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
              Wer braucht <b>kein</b> Hotelzimmer (fährt nach der Show heim)? Haken setzen → zählt nicht mehr als offen.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {relevantForHotel.map(m => (
                <label key={m.id} className="flex items-center gap-2 text-sm"
                  style={{ padding: '3px 4px', borderRadius: 6, cursor: isAdmin ? 'pointer' : 'default', opacity: m.noHotel ? 0.7 : 1 }}>
                  <input type="checkbox" checked={!!m.noHotel} disabled={!isAdmin} onChange={() => toggleNoHotel(m)} style={{ width: 16, height: 16 }} />
                  <span style={{ color: 'var(--text)', textDecoration: m.noHotel ? 'line-through' : 'none' }}>
                    {`${m.firstName} ${m.lastName}`.trim() || '—'}
                  </span>
                  {m.isArtistMember && <span className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>Artist</span>}
                  {m.noHotel && <span className="text-[11px]" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>🏠 fährt heim</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        {!loading && stays.length === 0 && (
          <div className="pt-leg-empty">Noch keine Hotels erfasst.</div>
        )}

        {!loading && stays.map((stay, idx) => (
          <div
            key={stay.id}
            className="pt-leg-card"
            draggable={isAdmin && stays.length > 1}
            onClick={() => isAdmin && openEdit(stay)}
            onDragStart={() => setDragIdx(idx)}
            onDragOver={e => { if (dragIdx == null) return; e.preventDefault(); if (overIdx !== idx) setOverIdx(idx) }}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
            onDrop={e => { e.preventDefault(); if (dragIdx != null) doReorder(dragIdx, idx); setDragIdx(null); setOverIdx(null) }}
            style={{
              cursor: isAdmin ? (stays.length > 1 ? 'grab' : 'pointer') : 'default',
              opacity: dragIdx === idx ? 0.4 : 1,
              boxShadow: overIdx === idx && dragIdx != null && dragIdx !== idx ? 'inset 0 2px 0 0 var(--primary-2)' : undefined,
            }}
          >
            {/* Hotel-Name als Headline */}
            <div className="pt-leg-card-headline" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Building2 size={11} style={{ display: 'inline' }} />
              <span>{stay.hotelName || '– kein Hotel gewählt –'}</span>
              {stay.hotelCity && <span style={{ color: 'var(--text-muted)' }}>· {stay.hotelCity}</span>}
              {stay.hotelId && (isAdmin ? (
                <button
                  onClick={e => toggleRecommended(stay, e)}
                  title={stay.hotelRecommended ? 'Empfehlung entfernen' : 'Als Empfehlung merken (super Hotel)'}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', color: stay.hotelRecommended ? 'var(--accent)' : 'var(--text-subtle)' }}
                >
                  <Star size={13} fill={stay.hotelRecommended ? 'var(--accent)' : 'none'} />
                </button>
              ) : stay.hotelRecommended ? (
                <Star size={13} fill="#f5c518" color="#f5c518" style={{ marginLeft: 'auto' }} />
              ) : null)}
            </div>

            {/* Anschrift, Telefon, E-Mail, Website */}
            {(stay.hotelStreet || stay.hotelPhone || stay.hotelEmail || stay.hotelWebsite) && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '0.2rem', lineHeight: 1.6 }}>
                {stay.hotelStreet && (
                  <div>{stay.hotelStreet}{stay.hotelPostalCode || stay.hotelCity ? `, ${[stay.hotelPostalCode, stay.hotelCity].filter(Boolean).join(' ')}` : ''}</div>
                )}
                {stay.hotelPhone && (
                  <div>
                    <a href={`tel:${stay.hotelPhone}`} onClick={e => e.stopPropagation()} style={{ color: 'var(--text-subtle)', textDecoration: 'none' }}>
                      📞 {stay.hotelPhone}
                    </a>
                  </div>
                )}
                {stay.hotelEmail && (
                  <div>
                    <a href={`mailto:${stay.hotelEmail}`} onClick={e => e.stopPropagation()} style={{ color: 'var(--text-subtle)', textDecoration: 'none' }}>
                      ✉ {stay.hotelEmail}
                    </a>
                  </div>
                )}
                {stay.hotelWebsite && (
                  <div>
                    <a
                      href={stay.hotelWebsite.startsWith('http') ? stay.hotelWebsite : `https://${stay.hotelWebsite}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ color: 'var(--text-subtle)', textDecoration: 'none' }}
                    >
                      🌐 {stay.hotelWebsite.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Check-in / Check-out + Buchungscode */}
            <div className="pt-leg-card-meta" style={{ marginTop: '0.2rem' }}>
              {stay.checkInDate && stay.checkOutDate
                ? <span>{formatDate(stay.checkInDate)} – {formatDate(stay.checkOutDate)}</span>
                : stay.checkInDate
                  ? <span>ab {formatDate(stay.checkInDate)}</span>
                  : null
              }
              {stay.bookingCode && (
                <span style={{ color: 'var(--text-muted)' }}>· #{stay.bookingCode}</span>
              )}
            </div>

            {/* Zimmer – aufklappbar */}
            {stay.rooms.length > 0 && (
              <div style={{ marginTop: '0.4rem' }}>
                <button
                  onClick={e => toggleRooms(stay.id, e)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    fontSize: '0.72rem', color: 'var(--text-subtle)', background: 'none',
                    border: 'none', cursor: 'pointer', padding: '0', lineHeight: 1.4,
                  }}
                >
                  {expandedRooms.has(stay.id)
                    ? <ChevronDown size={12} />
                    : <ChevronRight size={12} />}
                  Zimmerbelegung · {stay.rooms.length} {stay.rooms.length === 1 ? 'Zimmer' : 'Zimmer'}
                </button>
                {expandedRooms.has(stay.id) && (
                  <div style={{ marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {stay.rooms.map((room, idx) => {
                      const names = room.persons.map(p => `${p.firstName} ${p.lastName}`).join(', ')
                      const isSingleBed = room.roomType === 'einzelzimmer' || room.roomType === 'duschzimmer'
                      return (
                        <div key={room.id ?? idx} className="pt-hotel-room-row">
                          <span className="pt-hotel-room-type">
                            {isSingleBed
                              ? <BedSingle size={11} style={{ display: 'inline', marginRight: '0.2rem' }} />
                              : <BedDouble size={11} style={{ display: 'inline', marginRight: '0.2rem' }} />
                            }
                            {ROOM_TYPE_LABELS[room.roomType]}
                            {room.roomLabel && <span className="pt-hotel-room-label"> · {room.roomLabel}</span>}
                            {(() => {
                              const cap = ROOM_CAPACITY[room.roomType]
                              return cap !== null && room.persons.length > cap
                                ? <span style={{ color: 'var(--danger)', marginLeft: '0.35rem' }}>⚠ {room.persons.length}/{cap}</span>
                                : null
                            })()}
                          </span>
                          {names && <span className="pt-hotel-room-persons">{names}</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Bemerkungen */}
            {stay.notes && stay.notes.trim() !== '' && stay.notes !== '<p></p>' && (
              <div className="rich-content pt-leg-card-notes" style={{ marginTop: '0.35rem' }}>
                {renderBoardContent(stay.notes)}
              </div>
            )}
          </div>
        ))}
      </div>

      {modalOpen && (
        <HotelModal
          terminId={terminId}
          stay={editStay}
          travelParty={travelParty}
          assignedInOtherStays={assignedInOtherStays(editStay?.id ?? null)}
          terminDate={terminDate}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
