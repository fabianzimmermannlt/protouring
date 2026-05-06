'use client'

import { useState } from 'react'
import { createContact, type Contact } from '@/lib/api-client'
import { QuickCreateModal, QField, inputCls } from '@/app/components/shared/QuickCreateModal'

interface Props {
  onClose: () => void
  onCreated: (contact: Contact) => void
}

export function QuickCreateContactModal({ onClose, onCreated }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!firstName.trim() && !lastName.trim()) { setError('Vor- oder Nachname erforderlich'); return }
    setSaving(true); setError('')
    try {
      const contact = await createContact({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: '', phone: '', mobile: '', address: '', city: '', country: '',
        notes: '', birthday: '', nationality: '', passportNumber: '', passportExpiry: '',
        shirtSize: '', dietaryRestrictions: '', emergencyContact: '', emergencyPhone: '',
        bank: '', iban: '', bic: '', taxId: '',
        instruments: '', skills: '', languages: '',
      } as any)
      onCreated(contact)
      onClose()
    } catch (e) {
      setError((e as Error).message || 'Fehler beim Anlegen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <QuickCreateModal
      title="Kontakt anlegen"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={saving}
      disabled={!firstName.trim() && !lastName.trim()}
      error={error}
    >
      <div className="grid grid-cols-2 gap-3">
        <QField label="Vorname *">
          <input
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="Max"
            autoFocus
            className={inputCls}
          />
        </QField>
        <QField label="Nachname *">
          <input
            type="text"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Mustermann"
            className={inputCls}
          />
        </QField>
      </div>
    </QuickCreateModal>
  )
}
