'use client'

import { useState } from 'react'
import { createPartner, type Partner } from '@/lib/api-client'
import { QuickCreateModal, QField, inputCls } from '@/app/components/shared/QuickCreateModal'

interface Props {
  onClose: () => void
  onCreated: (partner: Partner) => void
}

export function QuickCreatePartnerModal({ onClose, onCreated }: Props) {
  const [companyName, setCompanyName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!companyName.trim()) { setError('Firmenname ist erforderlich'); return }
    setSaving(true); setError('')
    try {
      const partner = await createPartner({
        companyName: companyName.trim(), type: '', street: '', postalCode: '', city: '', state: '', country: '',
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
      <QField label="Firmenname *">
        <input
          type="text"
          value={companyName}
          onChange={e => setCompanyName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="z.B. Jolly Roger Concerts"
          autoFocus
          className={inputCls}
        />
      </QField>
    </QuickCreateModal>
  )
}
