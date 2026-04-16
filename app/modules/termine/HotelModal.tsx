'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Loader2, Plus, Trash2, ChevronDown } from 'lucide-react'
import { RichTextEditorField, type RichTextEditorFieldHandle } from '@/app/components/shared/RichTextEditor'
import SearchableDropdown from '@/app/components/shared/SearchableDropdown'
import {
  createHotelStay,
  updateHotelStay,
  deleteHotelStay,
  getHotels,
  type HotelStay,
  type HotelStayFormData,
  type HotelRoomDraft,
  type TravelPartyMember,
  type Hotel,
  type RoomType,
} from '@/lib/api-client'
import HotelFormModal from '@/app/modules/hotels/HotelFormModal'
import { ROOM_TYPE_LABELS } from './HotelCard'

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

// ── Kompakter Personen-Dropdown ──────────────────────────────
function PersonDropdown({
  travelParty,
  selectedIds,
  blockedIds,
  onChange,
}: {
  travelParty: TravelPartyMember[]
  selectedIds: number[]
  blockedIds: Set<number>
  onChange: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
  }, [])

  useEffect(() => {
    if (open) document.addEventListener('mousedown', handleOutsideClick)
    else document.removeEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open, handleOutsideClick])

  const selectedNames = travelParty
    .filter(m => selectedIds.includes(m.id))
    .map(m => `${m.firstName} ${m.lastName}`)

  return (
    <div ref={ref} style={{ position: 'relative', marginTop: '0.4rem' }}>
      {/* Trigger */}
      <button
        type="button"
        className="form-input"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', width: '100%' }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ fontSize: '0.8rem', color: selectedNames.length ? '#374151' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedNames.length > 0 ? selectedNames.join(', ') : 'Personen auswählen …'}
        </span>
        <ChevronDown size={13} style={{ flexShrink: 0, marginLeft: '0.4rem', color: '#6b7280', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {/* Dropdown-Liste */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '220px', overflowY: 'auto',
        }}>
          {travelParty.map(m => {
            const selected = selectedIds.includes(m.id)
            const blocked = blockedIds.has(m.id)
            return (
              <div
                key={m.id}
                onClick={() => !blocked && onChange(m.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.45rem 0.65rem', cursor: blocked ? 'not-allowed' : 'pointer',
                  opacity: blocked ? 0.4 : 1,
                  background: selected ? '#eff6ff' : 'transparent',
                  borderBottom: '1px solid #f3f4f6',
                }}
              >
                <span style={{ fontSize: '0.8rem', color: selected ? '#1d4ed8' : '#374151', flex: 1, fontWeight: selected ? 500 : 400 }}>
                  {m.firstName} {m.lastName}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                  {blocked ? 'bereits eingeplant' : (m.role1 || m.function1 || '')}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
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
  const notesRef = useRef<RichTextEditorFieldHandle>(null)

  useEffect(() => {
    getHotels().then(setHotels).catch(() => setHotels([]))
  }, [])

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
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
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
                    <div style={{ fontSize: '0.85rem', color: selected ? '#1d4ed8' : '#111827', fontWeight: selected ? 500 : 400 }}>
                      {h.name}
                    </div>
                    {(h.city || h.phone) && (
                      <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
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

                    {/* Personen-Dropdown für dieses Zimmer */}
                    {travelParty.length > 0 && (
                      <PersonDropdown
                        travelParty={travelParty}
                        selectedIds={room.memberIds}
                        blockedIds={blocked}
                        onChange={memberId => togglePersonInRoom(idx, memberId)}
                      />
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
            />
          </div>

          {/* Sichtbarkeit */}
          <div>
            <label className="form-label">Sichtbarkeit</label>
            <select
              className="form-input"
              value={form.visibility}
              onChange={e => set('visibility', e.target.value as 'all' | 'admin')}
            >
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

    {hotelFormModalOpen && (
      <HotelFormModal
        hotel={null}
        onClose={() => setHotelFormModalOpen(false)}
        onSaved={h => {
          setHotels(prev => [...prev, h])
          set('hotelId', Number(h.id))
          setHotelFormModalOpen(false)
        }}
      />
    )}
    </>
  )
}
