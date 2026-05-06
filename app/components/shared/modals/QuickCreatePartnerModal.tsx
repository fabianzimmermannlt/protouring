'use client'

import { useState, useEffect } from 'react'
import { createPartner, getPartnerTypes, type Partner } from '@/lib/api-client'
import { QuickCreateModal, QField, selectCls } from '@/app/components/shared/QuickCreateModal'
import { NameAddressAutocomplete } from '@/app/components/shared/AddressAutocomplete'

const FALLBACK_TYPES = [
  'Autovermietung', 'Backline-Firma', 'Booking', 'Booking Agentur', 'Brand',
  'Catering', 'Catering-Firma', 'Endorser', 'Label', 'Management',
  'Marketing', 'Medien-/Videoproduktion', 'Merchandise', 'Merchandise-Dienstleister',
  'Organizer', 'Press / PR', 'Production', 'Promoter', 'Publisher', 'Reisebüro',
  'Sicherheits-Firma', 'Studio', 'Support-Band', 'Technik-Lieferant',
  'Ticketing-Dienstleister', 'Transport', 'Trucking-Firma', 'Zulieferer Sonstiges', 'Other',
]

interface Props {
  onClose: () => void
  onCreated: (partner: Partner) => void
}

export function QuickCreatePartnerModal({ onClose, onCreated }: Props) {
  const [companyName, setCompanyName] = useState('')
  const [type, setType] = useState('')
  const [street, setStreet] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('')
  const [types, setTypes] = useState<string[]>(FALLBACK_TYPES)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getPartnerTypes().then(data => {
      const visible = data.filter(t => t.visible !== 0 && t.visible !== false as any).map(t => t.name)
      setTypes(visible.length > 0 ? visible : data.map(t => t.name))
    }).catch(() => {})
  }, [])

  const handleSubmit = async () => {
    if (!companyName.trim()) { setError('Firmenname ist erforderlich'); return }
    setSaving(true); setError('')
    try {
      const partner = await createPartner({
        companyName: companyName.trim(), type, street, postalCode, city, state, country,
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
      <QField label="Art">
        <select value={type} onChange={e => setType(e.target.value)} className={selectCls}>
          <option value="">– wählen –</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </QField>

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
