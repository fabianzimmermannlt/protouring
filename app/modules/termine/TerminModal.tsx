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
import { useT } from '@/app/lib/i18n/LanguageContext'
import { useEscapeKey } from '@/app/hooks/useEscapeKey'

interface TerminModalProps {
  termin?: Termin | null
  onClose: () => void
  onSaved: (t: Termin) => void
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

  const canSave = !!form.date && !!form.title.trim()

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
      onSaved(saved)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">
            {isEdit ? t('termin.edit') : t('termin.new')}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
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

          {/* Datum + Ort */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('quickCreate.date')} <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.date}
                onChange={e => field('date', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ort</label>
              <input
                type="text"
                placeholder="Stadt"
                value={form.city || ''}
                onChange={e => field('city', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Titel */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('general.title')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder={t('termin.titlePlaceholder')}
              value={form.title}
              onChange={e => field('title', e.target.value)}
              autoFocus={!isEdit}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Art */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('termin.type')}</label>
            <div className="grid grid-cols-2 gap-2">
              <select value={form.art || ''} onChange={e => field('art', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">—</option>
                {TERMIN_ART.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={form.art_sub || ''} onChange={e => field('art_sub', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">—</option>
                {TERMIN_ART_SUB.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('termin.status')}</label>
            <div className="grid grid-cols-2 gap-2">
              <select value={form.status_booking || ''} onChange={e => field('status_booking', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500">
                {TERMIN_STATUS_BOOKING.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={form.status_public || ''} onChange={e => field('status_public', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500">
                {TERMIN_STATUS_PUBLIC.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
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
              className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
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
