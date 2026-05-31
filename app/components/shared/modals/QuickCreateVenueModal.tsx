'use client'

import { useState } from 'react'
import { createVenue, type Venue } from '@/lib/api-client'
import { QuickCreateModal, QField } from '@/app/components/shared/QuickCreateModal'
import { NameAddressAutocomplete, type AddressResult } from '@/app/components/shared/AddressAutocomplete'

interface Props {
  onClose: () => void
  onCreated: (venue: Venue) => void
}

export function QuickCreateVenueModal({ onClose, onCreated }: Props) {
  const [displayValue, setDisplayValue] = useState('')
  const [selectedAddress, setSelectedAddress] = useState<Partial<AddressResult> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleAddressSelect = (a: AddressResult) => {
    const parts = [a.name, a.street, [a.postalCode, a.city].filter(Boolean).join(' ')].filter(Boolean)
    setDisplayValue(parts.join(', '))
    setSelectedAddress(a)
  }

  const handleSubmit = async () => {
    const venueName = selectedAddress?.name || displayValue.split(',')[0].trim()
    if (!venueName) { setError('Name ist erforderlich'); return }
    setSaving(true); setError('')
    try {
      const venue = await createVenue({
        name: venueName,
        street: selectedAddress?.street || '',
        postalCode: selectedAddress?.postalCode || '',
        city: selectedAddress?.city || '',
        state: selectedAddress?.state || '',
        country: selectedAddress?.country || '',
        latitude: selectedAddress?.latitude || '',
        longitude: selectedAddress?.longitude || '',
        website: '', arrival: '', arrivalStreet: '', arrivalPostalCode: '', arrivalCity: '',
        capacity: '', capacitySeated: '', stageDimensions: '', clearanceHeight: '',
        merchandiseFee: '', merchandiseStand: '', wardrobe: '', showers: '', wifi: '',
        parking: '', nightlinerParking: '', loadingPath: '', notes: '',
      })
      onCreated(venue)
      onClose()
    } catch (e) {
      setError((e as Error).message || 'Fehler beim Anlegen')
      setSaving(false)
    }
  }

  return (
    <QuickCreateModal
      title="Neue Spielstätte"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={saving}
      disabled={!displayValue.trim()}
      error={error}
    >
      <QField label="Name" required>
        <NameAddressAutocomplete
          label=""
          value={displayValue}
          onChange={v => { setDisplayValue(v); setSelectedAddress(null) }}
          onAddressSelect={handleAddressSelect}
          placeholder="z.B. Batschkapp Frankfurt"
          autoFocus
          variant="inline"
          withLatLon
        />
      </QField>
    </QuickCreateModal>
  )
}
