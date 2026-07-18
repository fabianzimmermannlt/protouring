'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2, Plus, Trash2, Check, Star } from 'lucide-react'
import { RichTextEditorField, type RichTextEditorFieldHandle } from '@/app/components/shared/RichTextEditor'
import SearchableDropdown from '@/app/components/shared/SearchableDropdown'
import {
  createHotelStay,
  updateHotelStay,
  deleteHotelStay,
  getHotels,
  getHotelSuggestions,
  type HotelStay,
  type HotelStayFormData,
  type HotelRoomDraft,
  type TravelPartyMember,
  type Hotel,
  type HotelSuggestion,
  type RoomType,
} from '@/lib/api-client'
import TravelHotelQuickCreate from './TravelHotelQuickCreate'
import { ROOM_TYPE_LABELS } from './HotelCard'
import { useEscapeKey } from '@/app/hooks/useEscapeKey'

interface HotelModalProps {
  terminId: number
  stay: HotelStay | null
  travelParty: TravelPartyMember[]
  assignedInOtherStays: Set<number>
  terminDate: string
  onClose: () => void
  onSaved: (stay: HotelStay) => void
  onDeleted: (stayId: number) => void
}

const ROOM_TYPES: RoomType[] = ['einzelzimmer', 'doppelzimmer', 'twin', 'suite', 'duschzimmer', 'sonstiges']

// null = kein Limit (Suite, Sonstiges)
const ROOM_CAPACITY: Record<RoomType, number | null> = {
  einzelzimmer: 1,
  doppelzimmer:  2,
  twin:          2,
  suite:         null,
  duschzimmer:   1,
  sonstiges:     null,
}

function emptyRoom(): HotelRoomDraft {
  return { roomType: 'einzelzimmer', roomLabel: '', memberIds: [] }
}

function emptyForm(terminDate: string): HotelStayFormData {
  return {
    hotelId: null,
    checkInDate: terminDate,
    checkOutDate: '',
    bookingCode: '',
    notes: '',
    visibility: 'all',
    sortOrder: 0,
    rooms: [emptyRoom()],
  }
}

function stayToForm(stay: HotelStay): HotelStayFormData {
  return {
    hotelId: stay.hotelId,
    checkInDate: stay.checkInDate,
    checkOutDate: stay.checkOutDate,
    bookingCode: stay.bookingCode,
    notes: stay.notes,
    visibility: stay.visibility,
    sortOrder: stay.sortOrder,
    rooms: stay.rooms.length > 0
      ? stay.rooms.map(r => ({
          roomType: r.roomType,
          roomLabel: r.roomLabel,
          memberIds: r.persons.map(p => p.travelPartyMemberId),
        }))
      : [emptyRoom()],
  }
}


export default function HotelModal({
  terminId, stay, travelParty, assignedInOtherStays, terminDate,
  onClose, onSaved, onDeleted,
}: HotelModalProps) {
  const isNew = stay === null
  const [form, setForm] = useState<HotelStayFormData>(
    isNew ? emptyForm(terminDate) : stayToForm(stay!)
  )
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [hotelFormModalOpen, setHotelFormModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [personPickerRoom, setPersonPickerRoom] = useState<number | null>(null) // roomIdx mit offenem Popover
  const notesRef = useRef<RichTextEditorFieldHandle>(null)

  // Dirty-Guard: Snapshot des Formulars beim Öffnen, Notiz separat über onInput
  const [initialFormJson] = useState(() => JSON.stringify(isNew ? emptyForm(terminDate) : stayToForm(stay!)))
  const [notesDirty, setNotesDirty] = useState(false)
  const [showDirty, setShowDirty] = useState(false)
  const isDirty = () => notesDirty || JSON.stringify(form) !== initialFormJson
  const requestClose = () => { if (isDirty()) setShowDirty(true); else onClose() }
  useEscapeKey(requestClose)

  const [suggestions, setSuggestions] = useState<HotelSuggestion[]>([])

  useEffect(() => {
    getHotels().then(setHotels).catch(() => setHotels([]))
    getHotelSuggestions(terminId).then(r => setSuggestions(r.suggestions || [])).catch(() => setSuggestions([]))
  }, [terminId])

  const set = <K extends keyof HotelStayFormData>(field: K, value: HotelStayFormData[K]) =>
    setForm(prev => ({ ...prev, [field]: value }))

  // --- Zimmer-Operationen ---

  const addRoom = () => {
    setForm(prev => ({ ...prev, rooms: [...prev.rooms, emptyRoom()] }))
  }

  const removeRoom = (idx: number) => {
    setForm(prev => ({ ...prev, rooms: prev.rooms.filter((_, i) => i !== idx) }))
  }

  const updateRoom = (idx: number, patch: Partial<HotelRoomDraft>) => {
    setForm(prev => {
      const rooms = [...prev.rooms]
      rooms[idx] = { ...rooms[idx], ...patch }
      return { ...prev, rooms }
    })
  }

  const togglePersonInRoom = (idx: number, memberId: number) => {
    setForm(prev => {
      const rooms = [...prev.rooms]
      const room = rooms[idx]
      const ids = room.memberIds.includes(memberId)
        ? room.memberIds.filter(id => id !== memberId)
        : [...room.memberIds, memberId]
      rooms[idx] = { ...room, memberIds: ids }
      return { ...prev, rooms }
    })
  }

  // Alle Personen die in einem anderen Zimmer *dieses* Stays oder in anderen Stays stecken
  const blockedInOtherRoom = (currentRoomIdx: number): Set<number> => {
    const blocked = new Set(assignedInOtherStays)
    form.rooms.forEach((r, i) => {
      if (i !== currentRoomIdx) r.memberIds.forEach(id => blocked.add(id))
    })
    return blocked
  }

  // Ungeplante: weder in diesem Stay noch in anderen Stays
  const allPlanned = new Set([
    ...Array.from(assignedInOtherStays),
    ...form.rooms.flatMap(r => r.memberIds),
  ])
  const unplannedCount = travelParty.filter(m => !allPlanned.has(m.id)).length

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const formWithNotes = { ...form, notes: notesRef.current?.getHTML() ?? form.notes }
      let saved: HotelStay
      if (isNew) {
        saved = await createHotelStay(terminId, formWithNotes)
      } else {
        saved = await updateHotelStay(terminId, stay!.id, formWithNotes)
      }
      onSaved(saved)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!stay || !confirm('Diesen Hotel-Eintrag wirklich löschen?')) return
    setDeleting(true)
    try {
      await deleteHotelStay(terminId, stay.id)
      onDeleted(stay.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen')
    } finally {
      setDeleting(false)
    }
  }

  const selectedHotel = form.hotelId ? hotels.find(h => Number(h.id) === form.hotelId) : null

  return (
    <>
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <h2 className="modal-title">{isNew ? 'Hotel hinzufügen' : 'Hotel bearbeiten'}</h2>
          <button onClick={requestClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="modal-body space-y-4">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>
          )}

          {/* Hotel + Buchungscode */}
          <div className="pt-leg-grid-2">
            <div>
              <label className="form-label">Hotel</label>
              <SearchableDropdown<Hotel>
                value={selectedHotel ?? null}
                placeholder="– Hotel wählen –"
                items={hotels}
                filterFn={(h, q) =>
                  h.name.toLowerCase().includes(q.toLowerCase()) ||
                  h.city.toLowerCase().includes(q.toLowerCase())
                }
                renderValue={h => [h.name, h.city].filter(Boolean).join(' · ')}
                renderItem={(h, selected) => (
                  <div>
                    <div style={{ fontSize: '0.85rem', color: selected ? '#60a5fa' : '#e0e0e0', fontWeight: selected ? 500 : 400, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      {h.recommended && <Star size={12} fill="#f5c518" color="#f5c518" style={{ flexShrink: 0 }} />}
                      {h.name}
                    </div>
                    {(h.city || h.phone) && (
                      <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                        {[h.city, h.phone].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                )}
                onSelect={h => { set('hotelId', h ? Number(h.id) : null); if (h) setHotels(prev => prev.find(x => x.id === h.id) ? prev : [...prev, h]) }}
                clearable
                createLabel="Neues Hotel anlegen"
                onCreateClick={() => setHotelFormModalOpen(true)}
              />
              {/* Empfohlene Hotels in der Nähe des Venues */}
              {suggestions.filter(sg => sg.hotel.id !== String(form.hotelId ?? '')).length > 0 && (
                <div style={{ marginTop: '0.4rem', background: 'rgba(245,197,24,0.08)', border: '1px solid rgba(245,197,24,0.35)', borderRadius: '6px', padding: '0.5rem 0.6rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#f5c518', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.35rem' }}>
                    <Star size={12} fill="#f5c518" color="#f5c518" /> Empfohlenes Hotel in der Nähe
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {suggestions.filter(sg => sg.hotel.id !== String(form.hotelId ?? '')).slice(0, 3).map(sg => (
                      <div key={sg.hotel.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#e0e0e0', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sg.hotel.name}
                          <span style={{ color: '#9ca3af' }}> · {sg.distanceKm} km vom Venue</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => { set('hotelId', Number(sg.hotel.id)); setHotels(prev => prev.find(x => x.id === sg.hotel.id) ? prev : [...prev, sg.hotel]) }}
                          style={{ flexShrink: 0, fontSize: '0.72rem', fontWeight: 500, background: '#f5c518', color: '#1a1a1a', border: 'none', borderRadius: '4px', padding: '0.25rem 0.6rem', cursor: 'pointer' }}
                        >
                          Auswählen
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedHotel && (selectedHotel.checkIn || selectedHotel.checkOut) && (
                <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.2rem' }}>
                  Standard: Check-in {selectedHotel.checkIn || '–'} · Check-out {selectedHotel.checkOut || '–'}
                </div>
              )}
            </div>
            <div>
              <label className="form-label">Buchungscode / Referenz</label>
              <input
                type="text"
                className="form-input"
                placeholder="Reservierungsnummer …"
                value={form.bookingCode}
                onChange={e => set('bookingCode', e.target.value)}
              />
            </div>
          </div>

          {/* Check-in / Check-out */}
          <div className="pt-leg-grid-2">
            <div>
              <label className="form-label">Check-in</label>
              <input
                type="date"
                className="form-input"
                value={form.checkInDate}
                onChange={e => set('checkInDate', e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Check-out</label>
              <input
                type="date"
                className="form-input"
                value={form.checkOutDate}
                onChange={e => set('checkOutDate', e.target.value)}
              />
            </div>
          </div>

          {/* ── Zimmer ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                Zimmer
                {unplannedCount > 0 && (
                  <span className="pt-leg-unplanned-hint" style={{ marginLeft: '0.5rem' }}>
                    {unplannedCount} noch nicht eingeplant
                  </span>
                )}
              </label>
              <button
                type="button"
                className="pt-leg-calc-btn"
                onClick={addRoom}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Plus size={11} /> Zimmer hinzufügen
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {form.rooms.map((room, idx) => {
                const blocked = blockedInOtherRoom(idx)
                return (
                  <div key={idx} className="pt-hotel-modal-room">
                    {/* Zimmertyp + Bezeichnung + Löschen-Button */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <label className="form-label">Zimmertyp</label>
                        <select
                          className="form-input"
                          value={room.roomType}
                          onChange={e => updateRoom(idx, { roomType: e.target.value as RoomType })}
                        >
                          {ROOM_TYPES.map(t => (
                            <option key={t} value={t}>{ROOM_TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="form-label">Bezeichnung / Nummer</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="z.B. 301, EZ-1 …"
                          value={room.roomLabel}
                          onChange={e => updateRoom(idx, { roomLabel: e.target.value })}
                        />
                      </div>
                      {form.rooms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRoom(idx)}
                          style={{ padding: '0.4rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                          title="Zimmer entfernen"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Personen — kompakt + Popover */}
                    {travelParty.length > 0 && (
                      <div style={{ marginTop: '0.4rem', position: 'relative' }}>
                        {personPickerRoom === idx && (
                          <div className="fixed inset-0 z-40" onClick={() => setPersonPickerRoom(null)} />
                        )}
                        {room.memberIds.length > 0 && (
                          <div className="text-sm mb-1" style={{ color: '#e6edf3' }}>
                            {travelParty
                              .filter(m => room.memberIds.includes(m.id))
                              .map(m => `${m.firstName} ${m.lastName}`)
                              .join(', ')}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setPersonPickerRoom(personPickerRoom === idx ? null : idx)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid #555', color: '#9ca3af', cursor: 'pointer', padding: '3px 8px', fontSize: '0.8rem' }}
                        >
                          <Plus size={11} />
                          {room.memberIds.length === 0 ? 'Personen hinzufügen' : 'Bearbeiten'}
                        </button>
                        {personPickerRoom === idx && (
                          <div className="pt-leg-person-picker" style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '4px', zIndex: 50, minWidth: '260px', maxHeight: '200px', overflowY: 'auto' }}>
                            {travelParty.map(m => {
                              const selected = room.memberIds.includes(m.id)
                              const isBlocked = blocked.has(m.id)
                              return (
                                <div
                                  key={m.id}
                                  className={`pt-leg-person-picker-row ${selected ? 'pt-leg-person-picker-row--selected' : ''} ${isBlocked && !selected ? 'pt-leg-person-picker-row--blocked' : ''}`}
                                  style={isBlocked ? { cursor: 'pointer' } : undefined}
                                  onClick={() => togglePersonInRoom(idx, m.id)}
                                >
                                  <div className="pt-leg-person-picker-check">
                                    {selected && <Check size={10} color="white" />}
                                  </div>
                                  <div className="pt-leg-person-name">{m.firstName} {m.lastName}</div>
                                  <div className="pt-leg-person-role">
                                    {isBlocked && !selected ? 'bereits eingeplant – trotzdem möglich' : (m.role1 || m.function1 || '')}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Kapazitäts-Warnung */}
                    {(() => {
                      const cap = ROOM_CAPACITY[room.roomType]
                      return cap !== null && room.memberIds.length > cap ? (
                        <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.25rem' }}>
                          ⚠ {room.memberIds.length} Personen für {ROOM_TYPE_LABELS[room.roomType]} (max. {cap})
                        </div>
                      ) : null
                    })()}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bemerkungen */}
          <div>
            <label className="form-label">Bemerkungen</label>
            <RichTextEditorField
              ref={notesRef}
              initialContent={form.notes}
              minHeight="min-h-20"
              onInput={() => setNotesDirty(true)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!isNew && (
              <button onClick={handleDelete} disabled={deleting} className="btn btn-danger">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : 'Löschen'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={requestClose} className="btn btn-ghost">Abbrechen</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Speichern…</> : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>

    {hotelFormModalOpen && (
      <TravelHotelQuickCreate
        onClose={() => setHotelFormModalOpen(false)}
        onCreated={h => {
          setHotels(prev => [...prev, h])
          set('hotelId', Number(h.id))
          setHotelFormModalOpen(false)
        }}
      />
    )}

    {showDirty && (
      <div className="modal-overlay" style={{ zIndex: 10000 }}>
        <div className="modal-container" style={{ maxWidth: '380px' }}>
          <div className="modal-header"><h2 className="modal-title">Ungespeicherte Änderungen</h2></div>
          <div className="modal-body">
            <p style={{ fontSize: '0.9rem', margin: 0 }}>Möchtest du die Änderungen speichern oder verwerfen?</p>
          </div>
          <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
            <button onClick={() => setShowDirty(false)} className="btn btn-ghost">Abbrechen</button>
            <button onClick={() => { setShowDirty(false); onClose() }} className="btn btn-ghost">Verwerfen</button>
            <button onClick={async () => { setShowDirty(false); await handleSave() }} disabled={saving} className="btn btn-primary">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Speichern…</> : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
