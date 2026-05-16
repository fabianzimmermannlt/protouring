'use client'

import { useState } from 'react'
import { createVenue, type Venue } from '@/lib/api-client'
import { QuickCreateModal, QField, inputCls } from '@/app/components/shared/QuickCreateModal'

interface Props {
  onClose: () => void
  onCreated: (venue: Venue) => void
}

export function QuickCreateVenueModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name ist erforderlich'); return }
    setSaving(true); setError('')
    try {
      const venue = await createVenue({
        name: name.trim(), street: '', postalCode: '', city: '', state: '', country: '',
        latitude: '', longitude: '',
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
      <QField label="Name *">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="z.B. Batschkapp Frankfurt"
          autoFocus
          className={inputCls}
        />
      </QField>
    </QuickCreateModal>
  )
}
