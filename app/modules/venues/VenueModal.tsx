'use client'

import { useState } from 'react'
import { X, Save, Loader2, Trash2 } from 'lucide-react'
import { useT } from '@/app/lib/i18n/LanguageContext'
import {
  createVenue,
  updateVenue,
  deleteVenue,
  type Venue,
  type VenueFormData,
} from '@/lib/api-client'
import { NameAddressAutocomplete } from '@/app/components/shared/AddressAutocomplete'

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
  const t = useT()
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
      setError(e instanceof Error ? e.message : t('general.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!venue || !confirm(t('venues.deleteVenueConfirm').replace('{name}', venue.name))) return
    try {
      await deleteVenue(venue.id)
      onDeleted?.(venue.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('general.deleteFailed'))
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-4xl">

        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? t('venues.editVenue') : t('venues.newVenue')}
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
                <NameAddressAutocomplete
                  label={`${t('general.name')} *`}
                  variant="modal"
                  withLatLon
                  value={form.name}
                  onChange={v => f('name', v)}
                  onAddressSelect={a => setForm(prev => ({
                    ...prev,
                    ...(a.name ? { name: a.name } : {}),
                    ...(a.street ? { street: a.street } : {}),
                    ...(a.postalCode ? { postalCode: a.postalCode } : {}),
                    ...(a.city ? { city: a.city } : {}),
                    ...(a.state ? { state: a.state } : {}),
                    ...(a.country ? { country: a.country } : {}),
                    ...(a.latitude ? { latitude: a.latitude } : {}),
                    ...(a.longitude ? { longitude: a.longitude } : {}),
                  }))}
                />
                <Field label={t('address.street')} value={form.street} onChange={v => f('street', v)} />
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <Field label={t('address.postalCode')} value={form.postalCode} onChange={v => f('postalCode', v)} maxLength={10} className="!w-24" />
                  <Field label={t('address.city')} value={form.city} onChange={v => f('city', v)} />
                </div>
                <Field label={t('address.state')} value={form.state} onChange={v => f('state', v)} />
                <Field label={t('address.country')} value={form.country} onChange={v => f('country', v)} />
                <Field label={t('general.website')} value={form.website} onChange={v => f('website', v)} type="url" placeholder="https://..." />
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t('address.latitude')} value={form.latitude} onChange={v => f('latitude', v)} placeholder="48.137154" />
                  <Field label={t('address.longitude')} value={form.longitude} onChange={v => f('longitude', v)} placeholder="11.576124" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t('venues.capacity')} value={form.capacity} onChange={v => f('capacity', v)} placeholder={t('venues.capacityPlaceholder')} />
                  <Field label={t('venues.capacitySeated')} value={form.capacitySeated} onChange={v => f('capacitySeated', v)} placeholder={t('venues.capacitySeatedPlaceholder')} />
                </div>
                <TextareaField label={t('venues.wifi')} value={form.wifi} onChange={v => f('wifi', v)} placeholder={t('venues.wifiPlaceholder')} />
                <TextareaField label={t('venues.wardrobe')} value={form.wardrobe} onChange={v => f('wardrobe', v)} />
                <Field label={t('venues.showers')} value={form.showers} onChange={v => f('showers', v)} placeholder={t('venues.showersPlaceholder')} />
              </div>

              {/* Right */}
              <div className="space-y-4">
                <Field label={t('address.arrival')} value={form.arrival} onChange={v => f('arrival', v)} placeholder={t('venues.arrivalPlaceholder')} />
                <Field label={t('address.arrivalStreet')} value={form.arrivalStreet} onChange={v => f('arrivalStreet', v)} />
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <Field label={t('address.arrivalPostalCode')} value={form.arrivalPostalCode} onChange={v => f('arrivalPostalCode', v)} maxLength={10} className="!w-24" />
                  <Field label={t('address.arrivalCity')} value={form.arrivalCity} onChange={v => f('arrivalCity', v)} />
                </div>
                <div className="grid grid-cols-[2fr_1fr] gap-2">
                  <Field label={t('venues.stageDimensions')} value={form.stageDimensions} onChange={v => f('stageDimensions', v)} placeholder={t('venues.stageDimensionsPlaceholder')} />
                  <Field label={t('venues.clearanceHeight')} value={form.clearanceHeight} onChange={v => f('clearanceHeight', v)} placeholder={t('venues.clearanceHeightPlaceholder')} />
                </div>
                <Field label={t('venues.merchandiseFee')} value={form.merchandiseFee} onChange={v => f('merchandiseFee', v)} placeholder={t('venues.merchandiseFeePlaceholder')} />
                <TextareaField label={t('venues.merchandiseStand')} value={form.merchandiseStand} onChange={v => f('merchandiseStand', v)} />
                <TextareaField label={t('venues.parking')} value={form.parking} onChange={v => f('parking', v)} />
                <TextareaField label={t('venues.nightlinerParking')} value={form.nightlinerParking} onChange={v => f('nightlinerParking', v)} />
                <TextareaField label={t('venues.loadingPath')} value={form.loadingPath} onChange={v => f('loadingPath', v)} />
                <TextareaField label={t('venues.notes')} value={form.notes} onChange={v => f('notes', v)} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {isEdit ? (
            <button onClick={handleDelete} className="btn btn-danger">
              <Trash2 size={14} /> {t('general.delete')}
            </button>
          ) : <div />}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-ghost">{t('general.cancel')}</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn btn-primary disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('general.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
