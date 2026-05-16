'use client'

import { useState } from 'react'
import { createHotel, type Hotel } from '@/lib/api-client'
import { QuickCreateModal, QField, inputCls } from '@/app/components/shared/QuickCreateModal'

interface Props {
  onClose: () => void
  onCreated: (hotel: Hotel) => void
}

export function QuickCreateHotelModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name ist erforderlich'); return }
    setSaving(true); setError('')
    try {
      const hotel = await createHotel({
        name: name.trim(), street: '', postalCode: '', city: '', state: '', country: '',
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
      <QField label="Name *">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="z.B. Ibis München Hauptbahnhof"
          autoFocus
          className={inputCls}
        />
      </QField>
    </QuickCreateModal>
  )
}
