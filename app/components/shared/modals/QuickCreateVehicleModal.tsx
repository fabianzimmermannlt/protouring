'use client'

import { useState } from 'react'
import { createVehicle, type Vehicle } from '@/lib/api-client'
import { QuickCreateModal, QField, inputCls } from '@/app/components/shared/QuickCreateModal'

interface Props {
  onClose: () => void
  onCreated: (vehicle: Vehicle) => void
}

export function QuickCreateVehicleModal({ onClose, onCreated }: Props) {
  const [designation, setDesignation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!designation.trim()) { setError('Bezeichnung ist erforderlich'); return }
    setSaving(true); setError('')
    try {
      const vehicle = await createVehicle({
        designation: designation.trim(), vehicleType: '', driver: '', licensePlate: '',
        dimensions: '', powerConnection: '', seats: '', sleepingPlaces: '',
        hasTrailer: false, trailerDimensions: '', trailerLicensePlate: '', notes: '',
      })
      onCreated(vehicle)
      onClose()
    } catch (e) {
      setError((e as Error).message || 'Fehler beim Anlegen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <QuickCreateModal
      title="Neues Fahrzeug"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={saving}
      disabled={!designation.trim()}
      error={error}
    >
      <QField label="Bezeichnung *">
        <input
          type="text"
          value={designation}
          onChange={e => setDesignation(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="z.B. Tourbus Mercedes Sprinter"
          autoFocus
          className={inputCls}
        />
      </QField>

    </QuickCreateModal>
  )
}
