'use client'

import { useState } from 'react'
import { Trash2, Save, X } from 'lucide-react'
import { createHotel, updateHotel, deleteHotel, type Hotel, type HotelFormData } from '@/lib/api-client'
import { NameAddressAutocomplete } from '@/app/components/shared/AddressAutocomplete'

const EMPTY_FORM: HotelFormData = {
  name: '',
  street: '',
  postalCode: '',
  city: '',
  state: '',
  country: '',
  email: '',
  phone: '',
  website: '',
  reception: '',
  checkIn: '',
  checkOut: '',
  earlyCheckIn: '',
  lateCheckOut: '',
  breakfast: '',
  breakfastWeekend: '',
  additionalInfo: '',
}

interface HotelFormModalProps {
  hotel: Hotel | null
  onClose: () => void
  onSaved: (h: Hotel) => void
  onDeleted?: (id: string) => void
}

export default function HotelFormModal({ hotel, onClose, onSaved, onDeleted }: HotelFormModalProps) {
  const [formData, setFormData] = useState<HotelFormData>(
    hotel
      ? {
          name: hotel.name,
          street: hotel.street,
          postalCode: hotel.postalCode,
          city: hotel.city,
          state: hotel.state,
          country: hotel.country,
          email: hotel.email,
          phone: hotel.phone,
          website: hotel.website,
          reception: hotel.reception,
          checkIn: hotel.checkIn,
          checkOut: hotel.checkOut,
          earlyCheckIn: hotel.earlyCheckIn,
          lateCheckOut: hotel.lateCheckOut,
          breakfast: hotel.breakfast,
          breakfastWeekend: hotel.breakfastWeekend,
          additionalInfo: hotel.additionalInfo,
        }
      : { ...EMPTY_FORM }
  )

  const set = (patch: Partial<HotelFormData>) => setFormData(prev => ({ ...prev, ...patch }))

  const handleSave = async () => {
    if (!formData.name.trim()) { alert('Bitte einen Hotelnamen eingeben.'); return }
    try {
      if (hotel) {
        const updated = await updateHotel(hotel.id, formData)
        onSaved(updated)
      } else {
        const created = await createHotel(formData)
        onSaved(created)
      }
      onClose()
    } catch { alert('Speichern fehlgeschlagen.') }
  }

  const handleDelete = async () => {
    if (!hotel) return
    if (!confirm('Möchten Sie dieses Hotel wirklich löschen?')) return
    try {
      await deleteHotel(hotel.id)
      onDeleted?.(hotel.id)
      onClose()
    } catch { alert('Löschen fehlgeschlagen.') }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-4xl">
        <div className="modal-header">
          <h2 className="modal-title">{hotel ? 'Hotel bearbeiten' : 'Neues Hotel'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="modal-body">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Linke Spalte */}
            <div className="space-y-3">
              <NameAddressAutocomplete
                label="Name des Hotels"
                variant="modal"
                value={formData.name}
                onChange={v => set({ name: v })}
                placeholder="Hotelname"
                onAddressSelect={a => set({
                  ...(a.name ? { name: a.name } : {}),
                  ...(a.street ? { street: a.street } : {}),
                  ...(a.postalCode ? { postalCode: a.postalCode } : {}),
                  ...(a.city ? { city: a.city } : {}),
                  ...(a.state ? { state: a.state } : {}),
                  ...(a.country ? { country: a.country } : {}),
                })}
              />

              <div>
                <label className="form-label">Straße</label>
                <input
                  type="text"
                  value={formData.street}
                  onChange={e => set({ street: e.target.value })}
                  className="form-input"
                  placeholder="Straße und Hausnummer"
                />
              </div>

              <div>
                <label className="form-label">PLZ</label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={e => set({ postalCode: e.target.value })}
                  className="form-input"
                  placeholder="Postleitzahl"
                />
              </div>

              <div>
                <label className="form-label">Ort</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={e => set({ city: e.target.value })}
                  className="form-input"
                  placeholder="Stadt"
                />
              </div>

              <div>
                <label className="form-label">Bundesland</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={e => set({ state: e.target.value })}
                  className="form-input"
                  placeholder="Bundesland/Region"
                />
              </div>

              <div>
                <label className="form-label">Land</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={e => set({ country: e.target.value })}
                  className="form-input"
                  placeholder="Land"
                />
              </div>

              <div>
                <label className="form-label">E-Mail</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => set({ email: e.target.value })}
                  className="form-input"
                  placeholder="hotel@beispiel.de"
                />
              </div>

              <div>
                <label className="form-label">Telefon</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => set({ phone: e.target.value })}
                  className="form-input"
                  placeholder="+49 123 456789"
                />
              </div>

              <div>
                <label className="form-label">Website</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={e => set({ website: e.target.value })}
                  className="form-input"
                  placeholder="https://www.hotel.de"
                />
              </div>
            </div>

            {/* Rechte Spalte */}
            <div className="space-y-3">
              <div>
                <label className="form-label">Rezeption</label>
                <input
                  type="text"
                  value={formData.reception}
                  onChange={e => set({ reception: e.target.value })}
                  className="form-input"
                  placeholder="Rezeption/Ankunft"
                />
              </div>

              <div>
                <label className="form-label">Check-in</label>
                <input
                  type="text"
                  value={formData.checkIn}
                  onChange={e => set({ checkIn: e.target.value })}
                  className="form-input"
                  placeholder="15:00 Uhr"
                />
              </div>

              <div>
                <label className="form-label">Check-out</label>
                <input
                  type="text"
                  value={formData.checkOut}
                  onChange={e => set({ checkOut: e.target.value })}
                  className="form-input"
                  placeholder="11:00 Uhr"
                />
              </div>

              <div>
                <label className="form-label">Early Check-in</label>
                <input
                  type="text"
                  value={formData.earlyCheckIn}
                  onChange={e => set({ earlyCheckIn: e.target.value })}
                  className="form-input"
                  placeholder="14:00 Uhr"
                />
              </div>

              <div>
                <label className="form-label">Late Check-out</label>
                <input
                  type="text"
                  value={formData.lateCheckOut}
                  onChange={e => set({ lateCheckOut: e.target.value })}
                  className="form-input"
                  placeholder="12:00 Uhr"
                />
              </div>

              <div>
                <label className="form-label">Frühstück</label>
                <input
                  type="text"
                  value={formData.breakfast}
                  onChange={e => set({ breakfast: e.target.value })}
                  className="form-input"
                  placeholder="7:00 - 10:00 Uhr"
                />
              </div>

              <div>
                <label className="form-label">Frühstück WE</label>
                <input
                  type="text"
                  value={formData.breakfastWeekend}
                  onChange={e => set({ breakfastWeekend: e.target.value })}
                  className="form-input"
                  placeholder="8:00 - 11:00 Uhr"
                />
              </div>

              <div>
                <label className="form-label">Weitere Informationen</label>
                <textarea
                  value={formData.additionalInfo}
                  onChange={e => set({ additionalInfo: e.target.value })}
                  rows={4}
                  className="form-textarea"
                  placeholder="Zusätzliche Informationen, Hinweise, Besonderheiten..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="flex items-center gap-3">
            {hotel && (
              <button onClick={handleDelete} className="btn btn-danger">
                <Trash2 className="h-4 w-4" />
                Löschen
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
            <button onClick={handleSave} className="btn btn-primary">
              <Save className="h-4 w-4" />
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
