'use client'

import { useState } from 'react'
import { createPartner, type Partner } from '@/lib/api-client'
import { QuickCreateModal, QField } from '@/app/components/shared/QuickCreateModal'
import { NameAddressAutocomplete, type AddressResult } from '@/app/components/shared/AddressAutocomplete'

interface Props {
  onClose: () => void
  onCreated: (partner: Partner) => void
}

export function QuickCreatePartnerModal({ onClose, onCreated }: Props) {
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
    const companyName = selectedAddress?.name || displayValue.split(',')[0].trim()
    if (!companyName) { setError('Firmenname ist erforderlich'); return }
    setSaving(true); setError('')
    try {
      const partner = await createPartner({
        companyName,
        type: '',
        street: selectedAddress?.street || '',
        postalCode: selectedAddress?.postalCode || '',
        city: selectedAddress?.city || '',
        state: selectedAddress?.state || '',
        country: selectedAddress?.country || '',
        contactPerson: '', email: '', phone: '', taxId: '', billingAddress: '', notes: '',
      })
      onCreated(partner)
      onClose()
    } catch (e) {
      setError((e as Error).message || 'Fehler beim Anlegen')
      setSaving(false)
    }
  }

  return (
    <QuickCreateModal
      title="Neuer Partner"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={saving}
      disabled={!displayValue.trim()}
      error={error}
    >
      <QField label="Firmenname" required>
        <NameAddressAutocomplete
          label=""
          value={displayValue}
          onChange={v => { setDisplayValue(v); setSelectedAddress(null) }}
          onAddressSelect={handleAddressSelect}
          placeholder="z.B. Jolly Roger Concerts"
          autoFocus
          variant="modal"
        />
      </QField>
    </QuickCreateModal>
  )
}
