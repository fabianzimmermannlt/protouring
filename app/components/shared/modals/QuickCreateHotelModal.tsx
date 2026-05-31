'use client'

import { useState } from 'react'
import { createHotel, type Hotel } from '@/lib/api-client'
import { QuickCreateModal, QField } from '@/app/components/shared/QuickCreateModal'
import { NameAddressAutocomplete, type AddressResult } from '@/app/components/shared/AddressAutocomplete'

interface Props {
  onClose: () => void
  onCreated: (hotel: Hotel) => void
}

export function QuickCreateHotelModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async (hotelName: string, address: Partial<AddressResult> = {}) => {
    if (!hotelName.trim()) { setError('Name ist erforderlich'); return }
    setSaving(true); setError('')
    try {
      const hotel = await createHotel({
        name: hotelName.trim(),
        street: address.street || '',
        postalCode: address.postalCode || '',
        city: address.city || '',
        state: address.state || '',
        country: address.country || '',
        email: '', phone: '', website: '', reception: '',
        checkIn: '', checkOut: '', earlyCheckIn: '', lateCheckOut: '',
        breakfast: '', breakfastWeekend: '', parking: '', additionalInfo: '',
      })
      onCreated(hotel)
      onClose()
    } catch (e) {
      setError((e as Error).message || 'Fehler beim Anlegen')
      setSaving(false)
    }
  }

  return (
    <QuickCreateModal
      title="Neues Hotel"
      onClose={onClose}
      onSubmit={() => save(name)}
      submitting={saving}
      disabled={!name.trim()}
      error={error}
    >
      <QField label="Name" required>
        <NameAddressAutocomplete
          label=""
          value={name}
          onChange={setName}
          onAddressSelect={a => {
            const hotelName = a.name || name
            setName(hotelName)
            // Direkt speichern und zur Detailseite navigieren
            save(hotelName, a)
          }}
          placeholder="z.B. Ibis München Hauptbahnhof"
          autoFocus
          variant="inline"
        />
      </QField>
    </QuickCreateModal>
  )
}
