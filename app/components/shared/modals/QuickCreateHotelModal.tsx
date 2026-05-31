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
  const [address, setAddress] = useState<Partial<AddressResult>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name ist erforderlich'); return }
    setSaving(true); setError('')
    try {
      const hotel = await createHotel({
        name: name.trim(),
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
    } finally {
      setSaving(false)
    }
  }

  return (
    <QuickCreateModal
      title="Neues Hotel"
      onClose={onClose}
      onSubmit={handleSubmit}
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
            if (a.name) setName(a.name)
            setAddress(a)
          }}
          placeholder="z.B. Ibis München Hauptbahnhof"
          autoFocus
          variant="inline"
        />
      </QField>
    </QuickCreateModal>
  )
}
