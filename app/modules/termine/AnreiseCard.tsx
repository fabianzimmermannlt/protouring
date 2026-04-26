'use client'

import { useState, useEffect } from 'react'
import { Plus, Loader2, Car, Train, Plane, MoreHorizontal, type LucideIcon } from 'lucide-react'
import {
  getTravelLegs,
  getTravelParty,
  type TravelLeg,
  type TravelPartyMember,
  type LegType,
  type TransportType,
} from '@/lib/api-client'
import { renderBoardContent } from '@/app/components/shared/ContentBoard'
import AnreiseModal from './AnreiseModal'

interface AnreiseCardProps {
  terminId: number
  legType: LegType
  isAdmin: boolean
  terminDate: string
  terminCity: string
  prevTerminCity?: string   // nur relevant für legType="anreise" (Vortag-Venue)
  nextTerminCity?: string   // nur relevant für legType="abreise/weiterreise" (Folgetag-Venue)
  refreshKey?: number       // inkrementieren triggert Neu-Laden (z.B. nach Kopieren)
  onCopiedToAbreise?: (leg: TravelLeg) => void  // nur für legType="anreise"
  onLegDeleted?: () => void // Callback wenn ein Leg gelöscht wird (für externe Reaktion)
}

const TRANSPORT_ICON: Record<TransportType, LucideIcon> = {
  fahrzeug: Car,
  bahn: Train,
  flugzeug: Plane,
  sonstiges: MoreHorizontal,
}

const TRANSPORT_LABEL: Record<TransportType, string> = {
  fahrzeug: 'Fahrzeug',
  bahn: 'Bahn',
  flugzeug: 'Flug',
  sonstiges: 'Sonstiges',
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

function formatTime(date: string, time: string): string {
  const parts: string[] = []
  if (date) parts.push(new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }))
  if (time) parts.push(time.slice(0, 5))
  return parts.join(' ')
}

export default function AnreiseCard({
  terminId, legType, isAdmin, terminDate, terminCity, prevTerminCity, nextTerminCity,
  refreshKey, onCopiedToAbreise, onLegDeleted,
}: AnreiseCardProps) {
  const [allLegs, setAllLegs] = useState<TravelLeg[]>([])
  const [travelParty, setTravelParty] = useState<TravelPartyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editLeg, setEditLeg] = useState<TravelLeg | null>(null)

  const legs = allLegs.filter(l => l.legType === legType)
  const abreiseLegs = allLegs.filter(l => l.legType === 'abreise')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getTravelLegs(terminId).catch(() => [] as TravelLeg[]),
      getTravelParty(terminId).catch(() => [] as TravelPartyMember[]),
    ]).then(([fetched, members]) => {
      setAllLegs(fetched)
      setTravelParty(members)
    }).finally(() => setLoading(false))
  }, [terminId, legType, refreshKey])

  const openNew = () => { setEditLeg(null); setModalOpen(true) }
  const openEdit = (leg: TravelLeg) => { setEditLeg(leg); setModalOpen(true) }

  const handleSaved = (leg: TravelLeg) => {
    setAllLegs(prev => {
      const idx = prev.findIndex(l => l.id === leg.id)
      if (idx >= 0) return prev.map(l => l.id === leg.id ? leg : l)
      return [...prev, leg]
    })
  }

  const handleDeleted = (legId: number) => {
    setAllLegs(prev => prev.filter(l => l.id !== legId))
    onLegDeleted?.()
  }

  const handleCopiedToAbreise = (leg: TravelLeg) => {
    setAllLegs(prev => [...prev, leg])
    onCopiedToAbreise?.(leg)
  }

  const sectionTitle =
    legType === 'anreise' ? 'Anreise' :
    legType === 'abreise' ? 'Abreise' : 'Weiterreise'

  const allAssigned = new Set(legs.flatMap(l => l.persons.map(p => p.travelPartyMemberId)))
  const unplannedCount = travelParty.filter(m => !allAssigned.has(m.id)).length

  return (
    <div className="pt-card">
      {/* Kachel-Header */}
      <div className="pt-card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span className="pt-card-title">{sectionTitle}</span>
          {isAdmin && (
            <button onClick={openNew} className="pt-card-add-btn" title="Hinzufügen">
              <Plus size={14} />
            </button>
          )}
        </div>
        {!loading && legs.length > 0 && unplannedCount > 0 && (
          <span className="pt-leg-unplanned-hint">{unplannedCount} nicht eingeplant</span>
        )}
      </div>

      {/* Kachel-Body */}
      <div className="pt-card-body" style={{ padding: '0.75rem 1rem' }}>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={16} className="animate-spin text-gray-400" />
          </div>
        ) : legs.length === 0 ? (
          <div className="pt-leg-empty">Noch keine {sectionTitle} eingetragen.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {legs.map(leg => {
              const Icon = TRANSPORT_ICON[leg.transportType] ?? Car
              const depStr = formatTime(leg.departureDate, leg.departureTime)
              const arrStr = formatTime(leg.arrivalDate, leg.arrivalTime)
              return (
                <div
                  key={leg.id}
                  className="pt-leg-card"
                  onClick={() => isAdmin && openEdit(leg)}
                  style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                >
                  {/* Zeile 1: Transport-Headline */}
                  <div className="pt-leg-card-headline">
                    <Icon size={12} />
                    {leg.transportType === 'sonstiges'
                      ? (leg.otherTransport || TRANSPORT_LABEL[leg.transportType])
                      : (leg.vehicleLabel || TRANSPORT_LABEL[leg.transportType])}
                  </div>
                  {/* Zeile 2: Route */}
                  <div className="pt-leg-route">
                    {leg.departureLocation || '–'}
                    <span className="pt-leg-route-arrow"> → </span>
                    {leg.arrivalLocation || '–'}
                  </div>
                  {/* Zeile 3: Zeiten */}
                  {(depStr || arrStr) && (
                    <div className="pt-leg-card-meta">
                      {depStr && <span>{depStr}</span>}
                      {depStr && arrStr && <span className="pt-leg-route-arrow">→</span>}
                      {arrStr && <span>{arrStr}</span>}
                    </div>
                  )}
                  {/* Zeile 4: Distanz / Fahrzeit */}
                  {(leg.distanceKm != null || leg.travelDurationMin != null) && (
                    <div className="pt-leg-card-meta">
                      {leg.distanceKm != null && <span>{leg.distanceKm} km</span>}
                      {leg.distanceKm != null && leg.travelDurationMin != null && (
                        <span className="pt-leg-route-arrow">/</span>
                      )}
                      {leg.travelDurationMin != null && <span>{formatDuration(leg.travelDurationMin)}</span>}
                    </div>
                  )}
                  {/* Zeile 4: Personen */}
                  {leg.persons.length > 0 && (
                    <div className="pt-leg-persons-list">
                      {leg.persons.map((p, i) => (
                        <span key={p.id}>
                          {p.firstName} {p.lastName}{i < leg.persons.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Zeile 5: Bemerkungen (Rich Text) */}
                  {leg.notes && (
                    <div className="rich-content pt-leg-card-notes">
                      {renderBoardContent(leg.notes)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <AnreiseModal
          terminId={terminId}
          leg={editLeg}
          legType={legType}
          travelParty={travelParty}
          assignedElsewhere={
            new Set(
              legs
                .filter(l => l.id !== editLeg?.id)
                .flatMap(l => l.persons.map(p => p.travelPartyMemberId))
            )
          }
          terminDate={terminDate}
          terminCity={terminCity}
          prevTerminCity={prevTerminCity}
          nextTerminCity={nextTerminCity}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          abreiseLegs={abreiseLegs}
          onCopiedToAbreise={handleCopiedToAbreise}
        />
      )}
    </div>
  )
}
