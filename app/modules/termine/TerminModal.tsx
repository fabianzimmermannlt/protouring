'use client'

import { useState } from 'react'
import { X, Check, Loader2, Trash2 } from 'lucide-react'
import {
  createTermin,
  updateTermin,
  deleteTermin,
  TERMIN_ART,
  TERMIN_ART_SUB,
  TERMIN_STATUS_BOOKING,
  TERMIN_STATUS_PUBLIC,
  type Termin,
  type TerminFormData,
} from '@/lib/api-client'

interface TerminModalProps {
  /** null = Neuer Termin, Termin = Bearbeiten */
  termin?: Termin | null
  onClose: () => void
  onSaved: (t: Termin) => void
  onDeleted?: (id: number) => void
  /** Nur im Create-Modus: nach Speichern Formular leeren statt schließen */
  allowAddAnother?: boolean
}

const EMPTY_FORM: TerminFormData = {
  date: '',
  title: '',
  art: '',
  art_sub: '',
  status_booking: 'Idee',
  status_public: 'nicht öffentlich',
  show_title_as_header: false,
}

export default function TerminModal({
  termin,
  onClose,
  onSaved,
  onDeleted,
  allowAddAnother = false,
}: TerminModalProps) {
  const isEdit = !!termin

  const [form, setForm] = useState<TerminFormData>(
    isEdit
      ? {
          date: termin!.date,
          title: termin!.title,
          art: termin!.art || '',
          art_sub: termin!.artSub || '',
          status_booking: termin!.statusBooking || 'Idee',
          status_public: termin!.statusPublic || 'nicht öffentlich',
          show_title_as_header: termin!.showTitleAsHeader || false,
        }
      : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const field = (key: keyof TerminFormData, value: string | number | boolean | null) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = async (andNew = false) => {
    if (!form.date || !form.title) return
    setSaving(true)
    setError(null)
    try {
      let saved: Termin
      if (isEdit) {
        // Preserve fields not in this form (city, venue_id, partner_id, etc.)
        saved = await updateTermin(termin!.id, {
          ...form,
          city: termin!.city,
          venue_id: termin!.venueId ?? null,
          partner_id: termin!.partnerId ?? null,
          announcement: termin!.announcement,
          capacity: termin!.capacity ?? null,
          notes: termin!.notes,
        })
      } else {
        saved = await createTermin(form)
      }
      onSaved(saved)
      if (andNew) {
        setForm({ ...EMPTY_FORM })
      } else {
        onClose()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!termin || !confirm('Termin wirklich löschen?')) return
    setDeleting(true)
    try {
      await deleteTermin(termin.id)
      onDeleted?.(termin.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Löschen fehlgeschlagen')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-lg">

        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? 'Termin bearbeiten' : 'Neuer Termin'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body space-y-4">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
              {error}
            </div>
          )}

          {/* Datum */}
          <div>
            <label className="form-label">Datum *</label>
            <input
              type="date"
              value={form.date}
              onChange={e => field('date', e.target.value)}
              className="form-input"
            />
          </div>

          {/* Art */}
          <div>
            <label className="form-label">Art</label>
            <div className="grid grid-cols-2 gap-2">
              <select value={form.art || ''} onChange={e => field('art', e.target.value)}
                className="form-select">
                <option value="">– wählen –</option>
                {TERMIN_ART.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={form.art_sub || ''} onChange={e => field('art_sub', e.target.value)}
                className="form-select">
                <option value="">– wählen –</option>
                {TERMIN_ART_SUB.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="form-label">Status</label>
            <div className="grid grid-cols-2 gap-2">
              <select value={form.status_booking || ''} onChange={e => field('status_booking', e.target.value)}
                className="form-select">
                <option value="">– wählen –</option>
                {TERMIN_STATUS_BOOKING.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={form.status_public || ''} onChange={e => field('status_public', e.target.value)}
                className="form-select">
                <option value="">– wählen –</option>
                {TERMIN_STATUS_PUBLIC.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Titel */}
          <div>
            <label className="form-label">Titel *</label>
            <input
              type="text"
              placeholder="z.B. Betontod Live"
              value={form.title}
              onChange={e => field('title', e.target.value)}
              className="form-input"
              autoFocus
            />
          </div>

          {/* Haken: Titel als Header */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!form.show_title_as_header}
              onChange={e => field('show_title_as_header', e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Titel in der Überschrift an Stelle von „Ort · Spielstätte" anzeigen
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div>
            {isEdit && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn btn-danger disabled:opacity-50"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={13} />}
                <span className="hidden md:inline">Termin löschen</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn btn-ghost">
              Abbrechen
            </button>
            {!isEdit && allowAddAnother && (
              <button
                onClick={() => handleSave(true)}
                disabled={saving || !form.date || !form.title}
                className="btn btn-secondary disabled:opacity-50"
              >
                Speichern + Weiterer
              </button>
            )}
            <button
              onClick={() => handleSave(false)}
              disabled={saving || !form.date || !form.title}
              className="btn btn-primary disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
