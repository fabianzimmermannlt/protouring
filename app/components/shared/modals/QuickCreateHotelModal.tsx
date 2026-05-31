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
  const [displayValue, setDisplayValue] = useState('')
  const [selectedAddress, setSelectedAddress] = useState<Partial<AddressResult> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleAddressSelect = (a: AddressResult) => {
    // Vollständige Adresse als Anzeigetext im Input
    const parts = [a.name, a.street, [a.postalCode, a.city].filter(Boolean).join(' ')].filter(Boolean)
    setDisplayValue(parts.join(', '))
    setSelectedAddress(a)
  }

  const handleSubmit = async () => {
    const hotelName = selectedAddress?.name || displayValue.split(',')[0].trim()
    if (!hotelName) { setError('Name ist erforderlich'); return }
    setSaving(true); setError('')
    try {
      const hotel = await createHotel({
        name: hotelName,
        street: selectedAddress?.street || '',
        postalCode: selectedAddress?.postalCode || '',
        city: selectedAddress?.city || '',
        state: selectedAddress?.state || '',
        country: selectedAddress?.country || '',
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
          placeholder="z.B. Ibis München Hauptbahnhof"
          autoFocus
          variant="inline"
        />
      </QField>
    </QuickCreateModal>
  )
}
