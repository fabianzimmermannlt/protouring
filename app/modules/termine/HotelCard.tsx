'use client'

import { useState, useEffect } from 'react'
import { Plus, Loader2, Building2, BedDouble, BedSingle, ChevronRight, ChevronDown } from 'lucide-react'
import {
  getHotelStays,
  getTravelParty,
  getAuthToken,
  getCurrentTenant,
  API_BASE,
  type HotelStay,
  type TravelPartyMember,
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
}: {
  terminId: number
  isAdmin: boolean
  terminDate: string
}) {
  const [stays, setStays] = useState<HotelStay[]>([])
  const [travelParty, setTravelParty] = useState<TravelPartyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editStay, setEditStay] = useState<HotelStay | null>(null)
  const [expandedRooms, setExpandedRooms] = useState<Set<number>>(new Set())

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
    Promise.all([
      getHotelStays(terminId),
      getTravelParty(terminId),
    ]).then(([s, tp]) => {
      setStays(s)
      setTravelParty(tp)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [terminId])

  const openNew = () => { setEditStay(null); setModalOpen(true) }
  const openEdit = (stay: HotelStay) => { setEditStay(stay); setModalOpen(true) }

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

  // Ungeplante Personen = in keinem Zimmer eines Stays
  const allAssigned = new Set(
    stays.flatMap(s => s.rooms.flatMap(r => r.persons.map(p => p.travelPartyMemberId)))
  )
  const unplannedCount = travelParty.filter(m => !allAssigned.has(m.id)).length

  return (
    <div className="pt-card">
      <div className="pt-card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span className="pt-card-title">Hotels</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {stays.length > 0 && (
              <button
                onClick={openHotelPdf}
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
              <button className="pt-card-add-btn" onClick={openNew} title="Hotel hinzufügen">
                <Plus size={14} />
              </button>
            )}
          </div>
        </div>
        {!loading && stays.length > 0 && unplannedCount > 0 && (
          <span className="pt-leg-unplanned-hint" style={{ marginTop: 0, marginBottom: '-0.4rem' }}>{unplannedCount} nicht eingeplant</span>
        )}
      </div>

      <div className="pt-card-body">
        {loading && (
          <div className="pt-leg-empty">
            <Loader2 size={16} className="animate-spin" style={{ display: 'inline' }} />
          </div>
        )}

        {!loading && stays.length === 0 && (
          <div className="pt-leg-empty">Noch keine Hotels erfasst.</div>
        )}

        {!loading && stays.map(stay => (
          <div
            key={stay.id}
            className="pt-leg-card"
            onClick={() => isAdmin && openEdit(stay)}
            style={{ cursor: isAdmin ? 'pointer' : 'default' }}
          >
            {/* Hotel-Name als Headline */}
            <div className="pt-leg-card-headline">
              <Building2 size={11} style={{ display: 'inline', marginRight: '0.3rem' }} />
              {stay.hotelName || '– kein Hotel gewählt –'}
              {stay.hotelCity && <span style={{ color: '#9ca3af', marginLeft: '0.3rem' }}>· {stay.hotelCity}</span>}
            </div>

            {/* Anschrift, Telefon, E-Mail, Website */}
            {(stay.hotelStreet || stay.hotelPhone || stay.hotelEmail || stay.hotelWebsite) && (
              <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.2rem', lineHeight: 1.6 }}>
                {stay.hotelStreet && (
                  <div>{stay.hotelStreet}{stay.hotelPostalCode || stay.hotelCity ? `, ${[stay.hotelPostalCode, stay.hotelCity].filter(Boolean).join(' ')}` : ''}</div>
                )}
                {stay.hotelPhone && (
                  <div>
                    <a href={`tel:${stay.hotelPhone}`} onClick={e => e.stopPropagation()} style={{ color: '#6b7280', textDecoration: 'none' }}>
                      📞 {stay.hotelPhone}
                    </a>
                  </div>
                )}
                {stay.hotelEmail && (
                  <div>
                    <a href={`mailto:${stay.hotelEmail}`} onClick={e => e.stopPropagation()} style={{ color: '#6b7280', textDecoration: 'none' }}>
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
                      style={{ color: '#6b7280', textDecoration: 'none' }}
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
                <span style={{ color: '#9ca3af' }}>· #{stay.bookingCode}</span>
              )}
            </div>

            {/* Zimmer – aufklappbar */}
            {stay.rooms.length > 0 && (
              <div style={{ marginTop: '0.4rem' }}>
                <button
                  onClick={e => toggleRooms(stay.id, e)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    fontSize: '0.72rem', color: '#6b7280', background: 'none',
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
                                ? <span style={{ color: '#dc2626', marginLeft: '0.35rem' }}>⚠ {room.persons.length}/{cap}</span>
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
