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

  const inputCls = "w-full text-sm outline-none"
  const inputStyle = { background: 'transparent', border: 'none', borderBottom: '1px solid #555', borderRadius: 0, padding: '4px 0', color: '#e0e0e0' }
  const dateInputStyle = { ...inputStyle, colorScheme: 'dark' as const }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="shadow-2xl w-full max-w-sm mx-4 overflow-hidden" style={{ background: '#2d2d2d' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #3c3c3c' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#e0e0e0' }}>
            {isEdit ? t('termin.edit') : t('termin.new')}
          </h3>
          <button onClick={onClose} className="transition-colors" style={{ color: '#9ca3af' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
              {error}
            </div>
          )}

          {/* Datum */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#9ca3af' }}>
              {t('quickCreate.date')}<span style={{ color: '#f87171', marginLeft: '2px' }}>*</span>
            </label>
            <input
              type="date"
              value={form.date}
              onChange={e => field('date', e.target.value)}
              autoFocus={!isEdit}
              className={inputCls}
              style={dateInputStyle}
            />
          </div>

          {/* Titel */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#9ca3af' }}>{t('general.title')}</label>
            <input
              type="text"
              placeholder={t('termin.titlePlaceholder')}
              value={form.title}
              onChange={e => field('title', e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </div>

          {/* Ort */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#9ca3af' }}>Ort</label>
            <input
              type="text"
              placeholder="Stadt"
              value={form.city || ''}
              onChange={e => field('city', e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: '1px solid #3c3c3c' }}>
          <div>
            {isEdit && (
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                {t('termin.delete')}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-lg transition-colors" style={{ background: '#3c3c3c', color: '#b0b0b0' }}>
              {t('general.cancel')}
            </button>
            {!isEdit && allowAddAnother && (
              <button onClick={() => handleSave(true)} disabled={saving || !canSave}
                className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">
                {t('termin.saveAndNew')}
              </button>
            )}
            <button onClick={() => handleSave(false)} disabled={saving || !canSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {t('general.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
