'use client'

import { useState } from 'react'
import { X, Save, Trash2, Loader2 } from 'lucide-react'
import {
  createTerminContact,
  updateTerminContact,
  deleteTerminContact,
  type TerminContact,
} from '@/lib/api-client'

interface KontaktModalProps {
  terminId: number
  contact?: TerminContact | null
  sortOrder?: number
  onClose: () => void
  onSaved: (c: TerminContact) => void
  onDeleted?: () => void
}

export default function KontaktModal({
  terminId,
  contact,
  sortOrder = 0,
  onClose,
  onSaved,
  onDeleted,
}: KontaktModalProps) {
  const isEdit = !!contact
  const [label, setLabel]         = useState(contact?.label ?? '')
  const [firstName, setFirstName] = useState(contact?.firstName ?? '')
  const [name, setName]           = useState(contact?.name ?? '')
  const [phone, setPhone]         = useState(contact?.phone ?? '')
  const [email, setEmail]         = useState(contact?.email ?? '')
  const [notes, setNotes]         = useState(contact?.notes ?? '')
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const data = { label, firstName, name, phone, email, notes, sortOrder: contact?.sortOrder ?? sortOrder }
      const saved = isEdit
        ? await updateTerminContact(terminId, contact!.id, data)
        : await createTerminContact(terminId, data)
      onSaved(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Kontakt „${label || name || 'Ansprechpartner'}" löschen?`)) return
    setDeleting(true)
    try {
      await deleteTerminContact(terminId, contact!.id)
      onDeleted?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-md">

        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? 'Ansprechpartner bearbeiten' : 'Neuer Ansprechpartner'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body space-y-4">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>
          )}

          <div>
            <label className="form-label">Funktion / Rolle</label>
            <input
              autoFocus
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="z.B. Venue Manager, Security, Catering"
              className="form-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Vorname</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Vorname"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Nachname</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nachname"
                className="form-input"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Telefon</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+49 …"
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Bemerkung / Hinweis</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Interne Hinweise zum Kontakt…"
              rows={3}
              className="form-input resize-none"
            />
          </div>
        </div>

        <div className="modal-footer">
          {isEdit ? (
            <button onClick={handleDelete} disabled={deleting} className="btn btn-danger disabled:opacity-50">
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Löschen
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Speichern
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
