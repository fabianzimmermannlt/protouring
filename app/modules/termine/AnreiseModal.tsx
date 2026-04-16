'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2, Car, Train, Plane, MoreHorizontal, Check, Copy, type LucideIcon } from 'lucide-react'
import { RichTextEditorField, type RichTextEditorFieldHandle } from '@/app/components/shared/RichTextEditor'
import SearchableDropdown from '@/app/components/shared/SearchableDropdown'
import {
  createTravelLeg,
  updateTravelLeg,
  deleteTravelLeg,
  updateTravelLegPersons,
  getVehicles,
  type TravelLeg,
  type TravelLegFormData,
  type TravelPartyMember,
  type Vehicle,
  type LegType,
  type TransportType,
} from '@/lib/api-client'
import VehicleFormModal from '@/app/modules/vehicles/VehicleFormModal'

interface AnreiseModalProps {
  terminId: number
  leg: TravelLeg | null           // null = neu anlegen
  legType: LegType
  travelParty: TravelPartyMember[]
  assignedElsewhere: Set<number>  // memberIds die in anderen Legs desselben Typs stecken
  terminDate: string              // für Datum-Defaults (YYYY-MM-DD)
  terminCity: string              // aktuelles Venue
  prevTerminCity?: string         // Venue vom Vortag (nur bei anreise relevant)
  nextTerminCity?: string         // Venue vom Folgetag (nur bei abreise/weiterreise relevant)
  abreiseLegs?: TravelLeg[]                       // aktuelle Abreise-Einträge (für Duplikat-Prüfung)
  onClose: () => void
  onSaved: (leg: TravelLeg) => void
  onDeleted: (legId: number) => void
  onCopiedToAbreise?: (leg: TravelLeg) => void   // nur relevant wenn legType === 'anreise'
}

const TRANSPORT_TABS: { type: TransportType; label: string; Icon: LucideIcon }[] = [
  { type: 'fahrzeug', label: 'Fahrzeug', Icon: Car },
  { type: 'bahn',     label: 'Bahn',     Icon: Train },
  { type: 'flugzeug', label: 'Flugzeug', Icon: Plane },
  { type: 'sonstiges',label: 'Sonstiges',Icon: MoreHorizontal },
]

function emptyForm(legType: LegType, terminDate: string): TravelLegFormData {
  return {
    legType,
    transportType: 'fahrzeug',
    vehicleId: null,
    departureLocation: '',
    arrivalLocation: '',
    departureDate: terminDate,
    departureTime: '',
    arrivalDate: terminDate,
    arrivalTime: '',
    distanceKm: null,
    travelDurationMin: null,
    trainNumber: '',
    bookingCode: '',
    platform: '',
    flightNumber: '',
    terminal: '',
    otherTransport: '',
    notes: '',
    visibility: 'all',
    sortOrder: 0,
  }
}

function legToForm(leg: TravelLeg): TravelLegFormData {
  return {
    legType: leg.legType,
    transportType: leg.transportType,
    vehicleId: leg.vehicleId,
    departureLocation: leg.departureLocation,
    arrivalLocation: leg.arrivalLocation,
    departureDate: leg.departureDate,
    departureTime: leg.departureTime,
    arrivalDate: leg.arrivalDate,
    arrivalTime: leg.arrivalTime,
    distanceKm: leg.distanceKm,
    travelDurationMin: leg.travelDurationMin,
    trainNumber: leg.trainNumber,
    bookingCode: leg.bookingCode,
    platform: leg.platform,
    flightNumber: leg.flightNumber,
    terminal: leg.terminal,
    otherTransport: leg.otherTransport,
    notes: leg.notes,
    visibility: leg.visibility,
    sortOrder: leg.sortOrder,
  }
}

function formatDuration(min: number | null): string {
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

// ── Routing ──────────────────────────────────────────────────
// Multiplikatoren auf PKW-Fahrtzeit (OSRM liefert Pkw-Basis)
const VEHICLE_PROFILES = [
  { key: 'pkw',       label: 'PKW / Van',           factor: 1.1 },
  { key: 'nightliner',label: 'Nightliner',           factor: 1.3 },
  { key: 'lkw',       label: 'Nightliner + Trailer', factor: 1.5 },
] as const

async function geocode(location: string): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`
    const res = await fetch(url, { headers: { 'Accept-Language': 'de-DE,de;q=0.9' } })
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    return [parseFloat(data[0].lon), parseFloat(data[0].lat)]
  } catch { return null }
}

async function getRoute(
  from: [number, number],
  to: [number, number]
): Promise<{ distanceKm: number; baseDurationMin: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=false`
    const res = await fetch(url)
    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes?.[0]) return null
    return {
      distanceKm: Math.round(data.routes[0].distance / 1000),
      baseDurationMin: Math.round(data.routes[0].duration / 60),
    }
  } catch { return null }
}

export default function AnreiseModal({
  terminId, leg, legType, travelParty, assignedElsewhere, terminDate, terminCity,
  prevTerminCity, nextTerminCity,
  abreiseLegs = [],
  onClose, onSaved, onDeleted, onCopiedToAbreise,
}: AnreiseModalProps) {
  const isNew = leg === null
  const [form, setForm] = useState<TravelLegFormData>(
    isNew ? emptyForm(legType, terminDate) : legToForm(leg!)
  )
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(
    new Set(leg?.persons.map(p => p.travelPartyMemberId) ?? [])
  )
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehicleFormModalOpen, setVehicleFormModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calcLoading, setCalcLoading] = useState<string | null>(null) // key des gerade berechnenden Profils
  const [calcError, setCalcError] = useState<string | null>(null)
  const notesRef = useRef<RichTextEditorFieldHandle>(null)

  const calcRoute = async (profileKey: typeof VEHICLE_PROFILES[number]['key']) => {
    if (!form.departureLocation || !form.arrivalLocation) {
      setCalcError('Bitte erst Von und Nach eingeben.')
      return
    }
    setCalcLoading(profileKey)
    setCalcError(null)
    try {
      const [fromCoord, toCoord] = await Promise.all([
        geocode(form.departureLocation),
        geocode(form.arrivalLocation),
      ])
      if (!fromCoord) { setCalcError(`„${form.departureLocation}" nicht gefunden.`); return }
      if (!toCoord)   { setCalcError(`„${form.arrivalLocation}" nicht gefunden.`); return }
      const route = await getRoute(fromCoord, toCoord)
      if (!route) { setCalcError('Route konnte nicht berechnet werden.'); return }
      const profile = VEHICLE_PROFILES.find(p => p.key === profileKey)!
      const durationMin = Math.round(route.baseDurationMin * profile.factor)
      setForm(prev => ({ ...prev, distanceKm: route.distanceKm, travelDurationMin: durationMin }))
    } finally {
      setCalcLoading(null)
    }
  }

  useEffect(() => {
    getVehicles().then(setVehicles).catch(() => setVehicles([]))
  }, [])

  const set = <K extends keyof TravelLegFormData>(field: K, value: TravelLegFormData[K]) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const togglePerson = (memberId: number) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      // Bemerkungen aus dem RichTextEditor auslesen
      const formWithNotes = { ...form, notes: notesRef.current?.getHTML() ?? form.notes }
      let saved: TravelLeg
      if (isNew) {
        saved = await createTravelLeg(terminId, formWithNotes)
      } else {
        saved = await updateTravelLeg(terminId, leg!.id, formWithNotes)
      }
      // Personen synchronisieren
      saved = await updateTravelLegPersons(terminId, saved.id, Array.from(selectedMemberIds))
      onSaved(saved)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleCopyToAbreise = async () => {
    if (copying) return
    setCopying(true)
    setError(null)
    try {
      const formWithNotes = {
        ...form,
        notes: notesRef.current?.getHTML() ?? form.notes,
        legType: 'abreise' as LegType,
        departureLocation: form.arrivalLocation,
        arrivalLocation: form.departureLocation,
      }
      let copied = await createTravelLeg(terminId, formWithNotes)
      copied = await updateTravelLegPersons(terminId, copied.id, Array.from(selectedMemberIds))
      onCopiedToAbreise?.(copied)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Kopieren')
    } finally {
      setCopying(false)
    }
  }

  const handleDelete = async () => {
    if (!leg || !confirm('Diesen Eintrag wirklich löschen?')) return
    setDeleting(true)
    try {
      await deleteTravelLeg(terminId, leg.id)
      onDeleted(leg.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen')
    } finally {
      setDeleting(false)
    }
  }

  const legTypeLabel =
    legType === 'anreise' ? 'Anreise' :
    legType === 'abreise' ? 'Abreise / Weiterreise' : 'Weiterreise'

  // Copy-Button: verstecken wenn das Fahrzeug bereits in Abreise vorhanden ist
  const vehicleAlreadyInAbreise =
    legType === 'anreise' &&
    form.transportType === 'fahrzeug' &&
    form.vehicleId != null &&
    abreiseLegs.some(l => l.vehicleId === form.vehicleId)
  const showCopyButton = legType === 'anreise' && !!onCopiedToAbreise && !isNew && !vehicleAlreadyInAbreise && !copySuccess

  // Nicht verplant = weder in diesem Leg noch in einem anderen Leg desselben Typs
  const unplannedCount = travelParty.filter(m =>
    !selectedMemberIds.has(m.id) && !assignedElsewhere.has(m.id)
  ).length

  // Sitzplatz-Info für gewähltes Fahrzeug
  const selectedVehicle = form.vehicleId ? vehicles.find(v => v.id === form.vehicleId) : null
  const totalSeats = selectedVehicle?.seats ? Number(selectedVehicle.seats) : null
  const occupiedSeats = selectedMemberIds.size
  const freeSeats = totalSeats != null ? totalSeats - occupiedSeats : null
  const seatFillPct = totalSeats ? Math.min(100, (occupiedSeats / totalSeats) * 100) : 0
  const seatBarClass = seatFillPct >= 100 ? 'pt-leg-seat-bar-fill--full'
    : seatFillPct >= 75 ? 'pt-leg-seat-bar-fill--warn'
    : ''

  return (
    <>
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <h2 className="modal-title">{isNew ? `${legTypeLabel} hinzufügen` : `${legTypeLabel} bearbeiten`}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="modal-body space-y-4">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>
          )}

          {/* Transport-Typ Tabs */}
          <div className="pt-leg-transport-tabs">
            {TRANSPORT_TABS.map(({ type, label, Icon }) => (
              <button
                key={type}
                className={`pt-leg-transport-tab ${form.transportType === type ? 'pt-leg-transport-tab--active' : ''}`}
                onClick={() => set('transportType', type)}
                type="button"
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          {/* Route */}
          <div className="pt-leg-grid-2">
            <div>
              <label className="form-label">
                Von
                {/* Abreise/Weiterreise: aktuelles Venue als Abfahrtsort */}
                {legType !== 'anreise' && terminCity && (
                  <button
                    type="button"
                    className="text-xs text-blue-400 hover:text-blue-300 ml-2"
                    onClick={() => set('departureLocation', terminCity)}
                    title={terminCity}
                  >
                    ← aktuelles Venue
                  </button>
                )}
                {/* Anreise: vorheriges Venue als Abfahrtsort (nur wenn Vortag) */}
                {legType === 'anreise' && prevTerminCity && (
                  <button
                    type="button"
                    className="text-xs text-blue-400 hover:text-blue-300 ml-2"
                    onClick={() => set('departureLocation', prevTerminCity)}
                    title={prevTerminCity}
                  >
                    ← vorheriges Venue
                  </button>
                )}
              </label>
              <input
                type="text"
                className="form-input"
                value={form.departureLocation}
                onChange={e => set('departureLocation', e.target.value)}
                placeholder="Abfahrtsort"
              />
            </div>
            <div>
              <label className="form-label">
                Nach
                {/* Anreise: aktuelles Venue als Ankunftsort */}
                {legType === 'anreise' && terminCity && (
                  <button
                    type="button"
                    className="text-xs text-blue-400 hover:text-blue-300 ml-2"
                    onClick={() => set('arrivalLocation', terminCity)}
                    title={terminCity}
                  >
                    ← Venue
                  </button>
                )}
                {/* Abreise/Weiterreise: nächstes Venue als Ankunftsort (nur wenn Folgetag) */}
                {legType !== 'anreise' && nextTerminCity && (
                  <button
                    type="button"
                    className="text-xs text-blue-400 hover:text-blue-300 ml-2"
                    onClick={() => set('arrivalLocation', nextTerminCity)}
                    title={nextTerminCity}
                  >
                    → nächstes Venue
                  </button>
                )}
              </label>
              <input
                type="text"
                className="form-input"
                value={form.arrivalLocation}
                onChange={e => set('arrivalLocation', e.target.value)}
                placeholder="Ankunftsort"
              />
            </div>
          </div>

          {/* Zeiten */}
          <div className="pt-leg-grid-2">
            <div>
              <label className="form-label">Abfahrt</label>
              <div className="pt-leg-grid-2" style={{ gap: '0.4rem' }}>
                <input type="date" className="form-input" value={form.departureDate} onChange={e => set('departureDate', e.target.value)} />
                <input type="time" className="form-input" value={form.departureTime} onChange={e => set('departureTime', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="form-label">Ankunft</label>
              <div className="pt-leg-grid-2" style={{ gap: '0.4rem' }}>
                <input type="date" className="form-input" value={form.arrivalDate} onChange={e => set('arrivalDate', e.target.value)} />
                <input type="time" className="form-input" value={form.arrivalTime} onChange={e => set('arrivalTime', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Fahrzeug (nur bei transportType = fahrzeug) */}
          {form.transportType === 'fahrzeug' && (
            <div className="pt-leg-grid-2">
              <div>
                <label className="form-label">Fahrzeug</label>
                <SearchableDropdown<Vehicle>
                  value={vehicles.find(v => v.id === form.vehicleId) ?? null}
                  placeholder="– kein Fahrzeug –"
                  items={vehicles}
                  filterFn={(v, q) =>
                    v.designation.toLowerCase().includes(q.toLowerCase()) ||
                    v.vehicleType.toLowerCase().includes(q.toLowerCase())
                  }
                  renderValue={v => [v.designation, v.vehicleType ? `(${v.vehicleType})` : '', v.seats ? `· ${v.seats} Sitze` : ''].filter(Boolean).join(' ')}
                  renderItem={(v, selected) => (
                    <div>
                      <div style={{ fontSize: '0.85rem', color: selected ? '#1d4ed8' : '#111827', fontWeight: selected ? 500 : 400 }}>
                        {v.designation}{v.vehicleType ? ` · ${v.vehicleType}` : ''}
                      </div>
                      {(v.seats || v.licensePlate) && (
                        <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                          {[v.seats ? `${v.seats} Sitze` : '', v.licensePlate].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  )}
                  onSelect={v => { set('vehicleId', v?.id ?? null); if (v) setVehicles(prev => prev.find(x => x.id === v.id) ? prev : [...prev, v]) }}
                  clearable
                  createLabel="Neues Fahrzeug anlegen"
                  onCreateClick={() => setVehicleFormModalOpen(true)}
                />
                {/* Sitzplatz-Auslastung */}
                {selectedVehicle && totalSeats != null && (
                  <div className="pt-leg-seat-indicator">
                    <span>
                      {occupiedSeats}/{totalSeats} Sitze belegt
                      {freeSeats != null && freeSeats > 0 && (
                        <span style={{ color: '#6b7280' }}> · {freeSeats} frei</span>
                      )}
                      {freeSeats != null && freeSeats < 0 && (
                        <span style={{ color: '#dc2626' }}> · {Math.abs(freeSeats)} zu viele!</span>
                      )}
                    </span>
                    <div className="pt-leg-seat-bar">
                      <div
                        className={`pt-leg-seat-bar-fill ${seatBarClass}`}
                        style={{ width: `${seatFillPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="form-label">Distanz &amp; Fahrzeit</label>
                <div className="pt-leg-grid-2" style={{ gap: '0.4rem' }}>
                  {/* km-Feld mit Einheit */}
                  <div className="pt-leg-unit-input">
                    <input
                      type="number"
                      className="form-input"
                      placeholder="–"
                      value={form.distanceKm ?? ''}
                      onChange={e => set('distanceKm', e.target.value ? Number(e.target.value) : null)}
                    />
                    <span className="pt-leg-unit-suffix">km</span>
                  </div>
                  {/* Fahrtzeit: zeigt formatierte Zeit, intern Minuten */}
                  <div className="pt-leg-unit-input">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="–"
                      value={form.travelDurationMin != null && form.travelDurationMin > 0
                        ? formatDuration(form.travelDurationMin)
                        : ''}
                      onFocus={e => {
                        // Beim Editieren rohe Minuten anzeigen
                        if (form.travelDurationMin != null)
                          e.currentTarget.value = String(form.travelDurationMin)
                      }}
                      onBlur={e => {
                        const num = parseInt(e.currentTarget.value, 10)
                        set('travelDurationMin', !isNaN(num) && num > 0 ? num : null)
                      }}
                      onChange={() => {/* wird in onBlur ausgelesen */}}
                    />
                  </div>
                </div>
                {/* Auto-Berechnen Buttons */}
                <div className="pt-leg-calc-row">
                  {VEHICLE_PROFILES.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      className="pt-leg-calc-btn"
                      onClick={() => calcRoute(p.key)}
                      disabled={calcLoading !== null}
                      title={`Berechnen für ${p.label}`}
                    >
                      {calcLoading === p.key && <Loader2 size={11} className="animate-spin" />}
                      {p.label}
                    </button>
                  ))}
                </div>
                {calcError && (
                  <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.25rem' }}>{calcError}</div>
                )}
              </div>
            </div>
          )}

          {/* Bahn-spezifisch */}
          {form.transportType === 'bahn' && (
            <div className="pt-leg-grid-3">
              <div>
                <label className="form-label">Zugnummer</label>
                <input type="text" className="form-input" placeholder="z.B. ICE 123" value={form.trainNumber} onChange={e => set('trainNumber', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Buchungscode</label>
                <input type="text" className="form-input" placeholder="ABC123" value={form.bookingCode} onChange={e => set('bookingCode', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Gleis</label>
                <input type="text" className="form-input" placeholder="Gleis 7" value={form.platform} onChange={e => set('platform', e.target.value)} />
              </div>
            </div>
          )}

          {/* Flugzeug-spezifisch */}
          {form.transportType === 'flugzeug' && (
            <div className="pt-leg-grid-3">
              <div>
                <label className="form-label">Flugnummer</label>
                <input type="text" className="form-input" placeholder="LH 456" value={form.flightNumber} onChange={e => set('flightNumber', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Buchungscode</label>
                <input type="text" className="form-input" placeholder="ABCDEF" value={form.bookingCode} onChange={e => set('bookingCode', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Terminal</label>
                <input type="text" className="form-input" placeholder="T2" value={form.terminal} onChange={e => set('terminal', e.target.value)} />
              </div>
            </div>
          )}

          {/* Sonstiges: Beschreibung + Distanz & Fahrzeit */}
          {form.transportType === 'sonstiges' && (
            <div className="pt-leg-grid-2">
              <div>
                <label className="form-label">Transportmittel / Beschreibung</label>
                <input type="text" className="form-input" placeholder="Taxi, Shuttle, Mietwagen …" value={form.otherTransport} onChange={e => set('otherTransport', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Distanz &amp; Fahrzeit</label>
                <div className="pt-leg-grid-2" style={{ gap: '0.4rem' }}>
                  <div className="pt-leg-unit-input">
                    <input
                      type="number"
                      className="form-input"
                      placeholder="–"
                      value={form.distanceKm ?? ''}
                      onChange={e => set('distanceKm', e.target.value ? Number(e.target.value) : null)}
                    />
                    <span className="pt-leg-unit-suffix">km</span>
                  </div>
                  <div className="pt-leg-unit-input">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="–"
                      value={form.travelDurationMin != null && form.travelDurationMin > 0
                        ? formatDuration(form.travelDurationMin)
                        : ''}
                      onFocus={e => {
                        if (form.travelDurationMin != null)
                          e.currentTarget.value = String(form.travelDurationMin)
                      }}
                      onBlur={e => {
                        const num = parseInt(e.currentTarget.value, 10)
                        set('travelDurationMin', !isNaN(num) && num > 0 ? num : null)
                      }}
                      onChange={() => {}}
                    />
                  </div>
                </div>
                <div className="pt-leg-calc-row">
                  {VEHICLE_PROFILES.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      className="pt-leg-calc-btn"
                      onClick={() => calcRoute(p.key)}
                      disabled={calcLoading !== null}
                    >
                      {calcLoading === p.key && <Loader2 size={11} className="animate-spin" />}
                      {p.label}
                    </button>
                  ))}
                </div>
                {calcError && (
                  <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.25rem' }}>{calcError}</div>
                )}
              </div>
            </div>
          )}

          {/* Personen */}
          {travelParty.length > 0 && (
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Personen</span>
                {unplannedCount > 0 && (
                  <span className="pt-leg-unplanned-hint">{unplannedCount} noch nicht eingeplant</span>
                )}
              </label>
              <div className="pt-leg-person-picker">
                {travelParty.map(m => {
                  const selected = selectedMemberIds.has(m.id)
                  const blocked = assignedElsewhere.has(m.id)
                  return (
                    <div
                      key={m.id}
                      className={`pt-leg-person-picker-row ${selected ? 'pt-leg-person-picker-row--selected' : ''} ${blocked ? 'pt-leg-person-picker-row--blocked' : ''}`}
                      onClick={() => !blocked && togglePerson(m.id)}
                    >
                      <div className="pt-leg-person-picker-check">
                        {selected && <Check size={10} color="white" />}
                      </div>
                      <div className="pt-leg-person-name">
                        {m.firstName} {m.lastName}
                      </div>
                      <div className="pt-leg-person-role">
                        {blocked ? 'bereits eingeplant' : (m.role1 || m.function1 || '')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Bemerkungen */}
          <div>
            <label className="form-label">Bemerkungen</label>
            <RichTextEditorField
              ref={notesRef}
              initialContent={form.notes}
              minHeight="min-h-20"
            />
          </div>

          {/* Sichtbarkeit */}
          <div>
            <label className="form-label">Sichtbarkeit</label>
            <select className="form-input" value={form.visibility} onChange={e => set('visibility', e.target.value as 'all' | 'admin')}>
              <option value="all">Alle Mitglieder</option>
              <option value="admin">Nur Admins</option>
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!isNew && (
              <button onClick={handleDelete} disabled={deleting} className="btn btn-danger">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : 'Löschen'}
              </button>
            )}
            {showCopyButton && (
              <button
                onClick={handleCopyToAbreise}
                disabled={copying}
                className="btn btn-ghost"
                title="Alle Daten als Abreise-Eintrag kopieren"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                {copying
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Copy size={13} />}
                Als Abreise kopieren
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Speichern…</> : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>

    {vehicleFormModalOpen && (
      <VehicleFormModal
        vehicle={null}
        onClose={() => setVehicleFormModalOpen(false)}
        onSaved={v => {
          setVehicles(prev => [...prev, v])
          set('vehicleId', v.id)
          setVehicleFormModalOpen(false)
        }}
      />
    )}
  </>
  )
}
