'use client'

import { useState } from 'react'
import { X, Save, Loader2, Trash2 } from 'lucide-react'
import {
  createVenue,
  updateVenue,
  deleteVenue,
  type Venue,
  type VenueFormData,
} from '@/lib/api-client'

const EMPTY_FORM: VenueFormData = {
  name: '', street: '', postalCode: '', city: '', state: '', country: '',
  website: '', arrival: '', arrivalStreet: '', arrivalPostalCode: '', arrivalCity: '',
  capacity: '', capacitySeated: '', stageDimensions: '', clearanceHeight: '',
  merchandiseFee: '', merchandiseStand: '', wardrobe: '', showers: '', wifi: '',
  parking: '', nightlinerParking: '', loadingPath: '', notes: '',
  latitude: '', longitude: '',
}

function venueToForm(v: Venue): VenueFormData {
  return {
    name: v.name, street: v.street, postalCode: v.postalCode, city: v.city,
    state: v.state, country: v.country, website: v.website,
    arrival: v.arrival, arrivalStreet: v.arrivalStreet,
    arrivalPostalCode: v.arrivalPostalCode, arrivalCity: v.arrivalCity,
    capacity: v.capacity, capacitySeated: v.capacitySeated,
    stageDimensions: v.stageDimensions, clearanceHeight: v.clearanceHeight,
    merchandiseFee: v.merchandiseFee, merchandiseStand: v.merchandiseStand,
    wardrobe: v.wardrobe, showers: v.showers, wifi: v.wifi,
    parking: v.parking, nightlinerParking: v.nightlinerParking,
    loadingPath: v.loadingPath, notes: v.notes,
    latitude: v.latitude, longitude: v.longitude,
  }
}

function Field({ label, value, onChange, type = 'text', placeholder = '', maxLength, className = '' }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; maxLength?: number; className?: string
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} maxLength={maxLength}
        className={`form-input ${className}`} />
    </div>
  )
}

function TextareaField({ label, value, onChange, placeholder = '', rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        className="form-textarea" />
    </div>
  )
}

interface VenueModalProps {
  /** null/undefined = Neue Spielstätte, Venue = Bearbeiten */
  venue?: Venue | null
  onClose: () => void
  onSaved: (venue: Venue) => void
  onDeleted?: (id: string) => void
}

export default function VenueModal({ venue, onClose, onSaved, onDeleted }: VenueModalProps) {
  const isEdit = !!venue
  const [form, setForm] = useState<VenueFormData>(isEdit ? venueToForm(venue!) : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const f = (key: keyof VenueFormData, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      let saved: Venue
      if (isEdit) {
        saved = await updateVenue(venue!.id, form)
      } else {
        saved = await createVenue(form)
      }
      onSaved(saved)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!venue || !confirm(`Spielstätte "${venue.name}" wirklich löschen?`)) return
    try {
      await deleteVenue(venue.id)
      onDeleted?.(venue.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Löschen fehlgeschlagen')
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-4xl">

        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? 'Spielstätte bearbeiten' : 'Neue Spielstätte anlegen'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        {/* Form */}
        <div className="modal-body">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
          )}
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left */}
              <div className="space-y-4">
                <Field label="Name *" value={form.name} onChange={v => f('name', v)} />
                <Field label="Straße" value={form.street} onChange={v => f('street', v)} />
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <Field label="PLZ" value={form.postalCode} onChange={v => f('postalCode', v)} maxLength={10} className="!w-24" />
                  <Field label="Ort" value={form.city} onChange={v => f('city', v)} />
                </div>
                <Field label="Bundesland" value={form.state} onChange={v => f('state', v)} />
                <Field label="Land" value={form.country} onChange={v => f('country', v)} />
                <Field label="Website" value={form.website} onChange={v => f('website', v)} type="url" placeholder="https://..." />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Latitude" value={form.latitude} onChange={v => f('latitude', v)} placeholder="48.137154" />
                  <Field label="Longitude" value={form.longitude} onChange={v => f('longitude', v)} placeholder="11.576124" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Kapazität" value={form.capacity} onChange={v => f('capacity', v)} placeholder="z.B. 5000" />
                  <Field label="Kapazität (bestuhlt)" value={form.capacitySeated} onChange={v => f('capacitySeated', v)} placeholder="z.B. 3000" />
                </div>
                <TextareaField label="W-LAN" value={form.wifi} onChange={v => f('wifi', v)} placeholder="SSID / Passwort..." />
                <TextareaField label="Garderoben" value={form.wardrobe} onChange={v => f('wardrobe', v)} />
                <Field label="Duschen" value={form.showers} onChange={v => f('showers', v)} placeholder="z.B. 4 im Backstage" />
              </div>

              {/* Right */}
              <div className="space-y-4">
                <Field label="Anfahrt" value={form.arrival} onChange={v => f('arrival', v)} placeholder="z.B. Auto / Bahn..." />
                <Field label="Anfahrt – Straße" value={form.arrivalStreet} onChange={v => f('arrivalStreet', v)} />
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <Field label="Anfahrt – PLZ" value={form.arrivalPostalCode} onChange={v => f('arrivalPostalCode', v)} maxLength={10} className="!w-24" />
                  <Field label="Anfahrt – Ort" value={form.arrivalCity} onChange={v => f('arrivalCity', v)} />
                </div>
                <div className="grid grid-cols-[2fr_1fr] gap-2">
                  <Field label="Bühnenmaße" value={form.stageDimensions} onChange={v => f('stageDimensions', v)} placeholder="z.B. 12x8m" />
                  <Field label="Lichte Höhe" value={form.clearanceHeight} onChange={v => f('clearanceHeight', v)} placeholder="z.B. 6m" />
                </div>
                <Field label="Merchandise-Fee" value={form.merchandiseFee} onChange={v => f('merchandiseFee', v)} placeholder="z.B. 15% oder 500€" />
                <TextareaField label="Merchandise-Stand" value={form.merchandiseStand} onChange={v => f('merchandiseStand', v)} />
                <TextareaField label="Parkplatz" value={form.parking} onChange={v => f('parking', v)} />
                <TextareaField label="Nightliner-Stellplatz" value={form.nightlinerParking} onChange={v => f('nightlinerParking', v)} />
                <TextareaField label="Ladeweg" value={form.loadingPath} onChange={v => f('loadingPath', v)} />
                <TextareaField label="Bemerkung" value={form.notes} onChange={v => f('notes', v)} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {isEdit ? (
            <button onClick={handleDelete} className="btn btn-danger">
              <Trash2 size={14} /> Löschen
            </button>
          ) : <div />}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn btn-primary disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
