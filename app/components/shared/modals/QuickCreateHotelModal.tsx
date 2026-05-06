'use client'

import { useState } from 'react'
import { createHotel, type Hotel } from '@/lib/api-client'
import { QuickCreateModal } from '@/app/components/shared/QuickCreateModal'
import { NameAddressAutocomplete } from '@/app/components/shared/AddressAutocomplete'

interface Props {
  onClose: () => void
  onCreated: (hotel: Hotel) => void
}

export function QuickCreateHotelModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [street, setStreet] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name ist erforderlich'); return }
    setSaving(true); setError('')
    try {
      const hotel = await createHotel({
        name: name.trim(), street, postalCode, city, state, country,
        email: '', phone: '', website: '', reception: '',
        checkIn: '', checkOut: '', earlyCheckIn: '', lateCheckOut: '',
        breakfast: '', breakfastWeekend: '', additionalInfo: '',
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
      <NameAddressAutocomplete
        label="Name *"
        variant="modal"
        value={name}
        onChange={setName}
        placeholder="z.B. Ibis München Hauptbahnhof"
        onAddressSelect={a => {
          if (a.name) setName(a.name)
          if (a.street) setStreet(a.street)
          if (a.postalCode) setPostalCode(a.postalCode)
          if (a.city) setCity(a.city)
          if (a.state) setState(a.state)
          if (a.country) setCountry(a.country)
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
