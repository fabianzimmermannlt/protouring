'use client'

import { useState } from 'react'
import { createPartner, type Partner } from '@/lib/api-client'
import { QuickCreateModal } from '@/app/components/shared/QuickCreateModal'
import { NameAddressAutocomplete } from '@/app/components/shared/AddressAutocomplete'

interface Props {
  onClose: () => void
  onCreated: (partner: Partner) => void
}

export function QuickCreatePartnerModal({ onClose, onCreated }: Props) {
  const [companyName, setCompanyName] = useState('')
  const [street, setStreet] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!companyName.trim()) { setError('Firmenname ist erforderlich'); return }
    setSaving(true); setError('')
    try {
      const partner = await createPartner({
        companyName: companyName.trim(), type: '', street, postalCode, city, state, country,
        contactPerson: '', email: '', phone: '', taxId: '', billingAddress: '', notes: '',
      })
      onCreated(partner)
      onClose()
    } catch (e) {
      setError((e as Error).message || 'Fehler beim Anlegen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <QuickCreateModal
      title="Neuer Partner"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={saving}
      disabled={!companyName.trim()}
      error={error}
    >
      <NameAddressAutocomplete
        label="Firmenname *"
        variant="modal"
        value={companyName}
        onChange={setCompanyName}
        placeholder="z.B. Jolly Roger Concerts"
        onAddressSelect={a => {
          if (a.name) setCompanyName(a.name)
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
