'use client'

import { useState } from 'react'
import { createVenue, type Venue } from '@/lib/api-client'
import { QuickCreateModal, QField, inputCls } from '@/app/components/shared/QuickCreateModal'
import { NameAddressAutocomplete } from '@/app/components/shared/AddressAutocomplete'

interface Props {
  onClose: () => void
  onCreated: (venue: Venue) => void
}

export function QuickCreateVenueModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [street, setStreet] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name ist erforderlich'); return }
    setSaving(true); setError('')
    try {
      const venue = await createVenue({
        name: name.trim(), street, postalCode, city, state, country,
        latitude, longitude,
        website: '', arrival: '', arrivalStreet: '', arrivalPostalCode: '', arrivalCity: '',
        capacity: '', capacitySeated: '', stageDimensions: '', clearanceHeight: '',
        merchandiseFee: '', merchandiseStand: '', wardrobe: '', showers: '', wifi: '',
        parking: '', nightlinerParking: '', loadingPath: '', notes: '',
      })
      onCreated(venue)
      onClose()
    } catch (e) {
      setError((e as Error).message || 'Fehler beim Anlegen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <QuickCreateModal
      title="Neue Spielstätte"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={saving}
      disabled={!name.trim()}
      error={error}
    >
      <NameAddressAutocomplete
        label="Name *"
        variant="modal"
        value={name}
        onChange={setName}
        placeholder="z.B. Batschkapp Frankfurt"
        withLatLon
        onAddressSelect={a => {
          if (a.name) setName(a.name)
          if (a.street) setStreet(a.street)
          if (a.postalCode) setPostalCode(a.postalCode)
          if (a.city) setCity(a.city)
          if (a.state) setState(a.state)
          if (a.country) setCountry(a.country)
          if (a.latitude) setLatitude(a.latitude)
          if (a.longitude) setLongitude(a.longitude)
        }}
      />
      {(street || city || country) && (
        <p className="text-xs text-gray-400 -mt-2">
          {[street, postalCode, city, country].filter(Boolean).join(', ')}
        </p>
      )}
    </QuickCreateModal>
  )
}
