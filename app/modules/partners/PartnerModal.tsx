'use client'

import { useState, useEffect } from 'react'
import { X, Save, Trash2, Loader2 } from 'lucide-react'
import {
  createPartner,
  updatePartner,
  deletePartner,
  getPartnerTypes,
  type Partner,
  type PartnerFormData,
  type PartnerType,
} from '@/lib/api-client'

const EMPTY: PartnerFormData = {
  type: '', companyName: '', street: '', postalCode: '', city: '', state: '',
  country: '', contactPerson: '', email: '', phone: '', taxId: '', billingAddress: '', notes: '',
}

const FALLBACK_TYPES = [
  'Autovermietung', 'Backline-Firma', 'Booking', 'Booking Agentur', 'Brand',
  'Catering', 'Catering-Firma', 'Endorser', 'Label', 'Management',
  'Marketing', 'Medien-/Videoproduktion', 'Merchandise', 'Merchandise-Dienstleister',
  'Organizer', 'Press / PR', 'Production', 'Promoter', 'Publisher', 'Reisebüro',
  'Sicherheits-Firma', 'Studio', 'Support-Band', 'Technik-Lieferant',
  'Ticketing-Dienstleister', 'Transport', 'Trucking-Firma', 'Zulieferer Sonstiges', 'Other',
]

interface PartnerModalProps {
  partner?: Partner | null
  onClose: () => void
  onSaved: (partner: Partner) => void
  onDeleted?: () => void
}

export default function PartnerModal({ partner, onClose, onSaved, onDeleted }: PartnerModalProps) {
  const isEdit = !!partner

  const [partnerTypes, setPartnerTypes] = useState<string[]>(FALLBACK_TYPES)
  useEffect(() => {
    getPartnerTypes()
      .then(data => {
        const visible = data.filter(t => t.visible !== 0 && t.visible !== false as any).map(t => t.name)
        setPartnerTypes(visible.length > 0 ? visible : data.map(t => t.name))
      })
      .catch(() => {})
  }, [])

  const [form, setForm] = useState<PartnerFormData>(
    isEdit
      ? {
          type: partner.type ?? '',
          companyName: partner.companyName ?? '',
          street: partner.street ?? '',
          postalCode: partner.postalCode ?? '',
          city: partner.city ?? '',
          state: partner.state ?? '',
          country: partner.country ?? '',
          contactPerson: partner.contactPerson ?? '',
          email: partner.email ?? '',
          phone: partner.phone ?? '',
          taxId: partner.taxId ?? '',
          billingAddress: partner.billingAddress ?? '',
          notes: partner.notes ?? '',
        }
      : EMPTY
  )

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const f = (key: keyof PartnerFormData, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    if (!form.companyName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const saved = isEdit
        ? await updatePartner(partner!.id, form)
        : await createPartner(form)
      onSaved(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Partner „${partner!.companyName}" wirklich löschen?`)) return
    setDeleting(true)
    try {
      await deletePartner(partner!.id)
      onDeleted?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-4xl">

        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? 'Partner bearbeiten' : 'Neuen Partner anlegen'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {error && (
            <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Linke Spalte */}
            <div className="space-y-4">
              <div>
                <label className="form-label">Art</label>
                <select value={form.type} onChange={e => f('type', e.target.value)} className="form-select">
                  <option value="">– wählen –</option>
                  {partnerTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">Firmenname *</label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={e => f('companyName', e.target.value)}
                  className="form-input"
                  autoFocus
                  placeholder="z.B. Jolly Roger Concerts"
                />
              </div>

              <div>
                <label className="form-label">Straße</label>
                <input type="text" value={form.street} onChange={e => f('street', e.target.value)}
                  className="form-input" />
              </div>

              <div className="grid grid-cols-[auto_1fr] gap-2">
                <div>
                  <label className="form-label">PLZ</label>
                  <input type="text" value={form.postalCode} onChange={e => f('postalCode', e.target.value)}
                    maxLength={10} className="form-input !w-20" placeholder="12345" />
                </div>
                <div>
                  <label className="form-label">Ort</label>
                  <input type="text" value={form.city} onChange={e => f('city', e.target.value)}
                    className="form-input" />
                </div>
              </div>

              <div>
                <label className="form-label">Bundesland</label>
                <input type="text" value={form.state} onChange={e => f('state', e.target.value)}
                  className="form-input" />
              </div>

              <div>
                <label className="form-label">Land</label>
                <input type="text" value={form.country} onChange={e => f('country', e.target.value)}
                  className="form-input" />
              </div>
            </div>

            {/* Rechte Spalte */}
            <div className="space-y-4">
              <div>
                <label className="form-label">Ansprechpartner</label>
                <input type="text" value={form.contactPerson} onChange={e => f('contactPerson', e.target.value)}
                  className="form-input" placeholder="Max Mustermann" />
              </div>

              <div>
                <label className="form-label">E-Mail</label>
                <input type="email" value={form.email} onChange={e => f('email', e.target.value)}
                  className="form-input" placeholder="info@example.com" />
              </div>

              <div>
                <label className="form-label">Telefon</label>
                <input type="tel" value={form.phone} onChange={e => f('phone', e.target.value)}
                  className="form-input" placeholder="+49 40 …" />
              </div>

              <div>
                <label className="form-label">Steuer-ID</label>
                <input type="text" value={form.taxId} onChange={e => f('taxId', e.target.value)}
                  className="form-input" />
              </div>

              <div>
                <label className="form-label">Abweichende Rechnungsanschrift</label>
                <textarea value={form.billingAddress} onChange={e => f('billingAddress', e.target.value)}
                  rows={3} className="form-textarea" placeholder="Falls abweichend von der Hauptadresse…" />
              </div>

              <div>
                <label className="form-label">Bemerkung</label>
                <textarea value={form.notes} onChange={e => f('notes', e.target.value)}
                  rows={3} className="form-textarea" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {isEdit ? (
            <button onClick={handleDelete} disabled={deleting} className="btn btn-danger disabled:opacity-50">
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Löschen
            </button>
          ) : <div />}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
            <button onClick={handleSave} disabled={saving || !form.companyName.trim()}
              className="btn btn-primary disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Speichern
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
