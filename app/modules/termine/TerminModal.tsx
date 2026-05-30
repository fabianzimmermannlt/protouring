'use client'

import { useState } from 'react'
import { X, Check, Loader2, Trash2 } from 'lucide-react'
import {
  createTermin,
  updateTermin,
  deleteTermin,
  type Termin,
  type TerminFormData,
} from '@/lib/api-client'
import { useT } from '@/app/lib/i18n/LanguageContext'
import { useEscapeKey } from '@/app/hooks/useEscapeKey'

interface TerminModalProps {
  termin?: Termin | null
  onClose: () => void
  onSaved: (t: Termin, andNew?: boolean) => void
  onDeleted?: (id: number) => void
  allowAddAnother?: boolean
}

const EMPTY_FORM: TerminFormData & { city?: string } = {
  date: '',
  title: '',
  art: '',
  art_sub: '',
  status_booking: 'Idee',
  status_public: 'nicht öffentlich',
  show_title_as_header: false,
  venue_id: null,
  city: '',
}

export default function TerminModal({
  termin,
  onClose,
  onSaved,
  onDeleted,
  allowAddAnother = false,
}: TerminModalProps) {
  useEscapeKey(onClose)
  const t = useT()
  const isEdit = !!termin

  const [form, setForm] = useState<typeof EMPTY_FORM>(
    isEdit
      ? {
          date: termin!.date,
          title: termin!.title,
          art: termin!.art || '',
          art_sub: termin!.artSub || '',
          status_booking: termin!.statusBooking || 'Idee',
          status_public: termin!.statusPublic || 'nicht öffentlich',
          show_title_as_header: termin!.showTitleAsHeader || false,
          venue_id: termin!.venueId ?? null,
          city: termin!.city || '',
        }
      : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const field = (key: keyof typeof EMPTY_FORM, value: string | number | boolean | null) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const canSave = !!form.date

  const handleSave = async (andNew = false) => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      let saved: Termin
      if (isEdit) {
        saved = await updateTermin(termin!.id, {
          ...form,
          city: form.city || termin!.city,
          partner_id: termin!.partnerId ?? null,
          announcement: termin!.announcement,
          capacity: termin!.capacity ?? null,
          notes: termin!.notes,
        })
      } else {
        saved = await createTermin({ ...form, city: form.city || '' })
      }
      onSaved(saved, andNew)
      if (andNew) {
        setForm({ ...EMPTY_FORM })
      } else {
        onClose()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('general.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!termin || !confirm(t('termin.deleteConfirm'))) return
    setDeleting(true)
    try {
      await deleteTermin(termin.id)
      onDeleted?.(termin.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('general.deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-sm">

        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? t('termin.edit') : t('termin.new')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body space-y-3">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>
          )}
          <div>
            <label className="form-label">
              {t('quickCreate.date')}<span className="req-star" style={{ marginLeft: '2px' }}>*</span>
            </label>
            <input type="date" value={form.date} onChange={e => field('date', e.target.value)}
              autoFocus={!isEdit} className="form-input" style={{ colorScheme: 'dark' }} />
          </div>
          <div>
            <label className="form-label">{t('general.title')}</label>
            <input type="text" placeholder={t('termin.titlePlaceholder')} value={form.title}
              onChange={e => field('title', e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">Ort</label>
            <input type="text" placeholder="Stadt" value={form.city || ''}
              onChange={e => field('city', e.target.value)} className="form-input" />
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div>
            {isEdit && (
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:text-red-400 disabled:opacity-50">
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                {t('termin.delete')}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-300">
              {t('general.cancel')}
            </button>
            {!isEdit && allowAddAnother && (
              <button onClick={() => handleSave(true)} disabled={saving || !canSave}
                className="px-3 py-1.5 text-sm bg-gray-600 text-gray-200 hover:bg-gray-500 disabled:opacity-50">
                {t('termin.saveAndNew')}
              </button>
            )}
            <button onClick={() => handleSave(false)} disabled={saving || !canSave}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {t('general.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
