'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Check, Loader2, Trash2, Search, Building2, Plus } from 'lucide-react'
import {
  createTermin,
  updateTermin,
  deleteTermin,
  getVenues,
  createVenue,
  TERMIN_ART,
  TERMIN_ART_SUB,
  TERMIN_STATUS_BOOKING,
  TERMIN_STATUS_PUBLIC,
  type Termin,
  type TerminFormData,
  type Venue,
} from '@/lib/api-client'
import { useT } from '@/app/lib/i18n/LanguageContext'

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
  venue_id: null,
}

export default function TerminModal({
  termin,
  onClose,
  onSaved,
  onDeleted,
  allowAddAnother = false,
}: TerminModalProps) {
  const t = useT()
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
          venue_id: termin!.venueId ?? null,
        }
      : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Venue picker state
  const [venues, setVenues] = useState<Venue[]>([])
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [venueSearch, setVenueSearch] = useState('')
  const [venueDropdownOpen, setVenueDropdownOpen] = useState(false)
  const [quickCreate, setQuickCreate] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickCity, setQuickCity] = useState('')
  const [quickCreating, setQuickCreating] = useState(false)
  const venueRef = useRef<HTMLDivElement>(null)

  useEffect(() => { containerRef.current?.scrollTo(0, 0) }, [])

  // Load venues once
  useEffect(() => {
    getVenues().then(list => {
      setVenues(list)
      // If edit mode with existing venue_id, pre-select it
      if (isEdit && termin!.venueId) {
        const found = list.find(v => String(v.id) === String(termin!.venueId))
        if (found) setSelectedVenue(found)
      }
    }).catch(() => {})
  }, [])

  // Close venue dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (venueRef.current && !venueRef.current.contains(e.target as Node)) {
        setVenueDropdownOpen(false)
        setQuickCreate(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredVenues = venues.filter(v =>
    `${v.name} ${v.city}`.toLowerCase().includes(venueSearch.toLowerCase())
  )

  const selectVenue = (v: Venue) => {
    setSelectedVenue(v)
    setForm(prev => ({ ...prev, venue_id: Number(v.id), show_title_as_header: false }))
    setVenueDropdownOpen(false)
    setVenueSearch('')
    setQuickCreate(false)
  }

  const clearVenue = () => {
    setSelectedVenue(null)
    setForm(prev => ({ ...prev, venue_id: null, show_title_as_header: false }))
  }

  const handleQuickCreate = async () => {
    if (!quickName.trim()) return
    setQuickCreating(true)
    try {
      const empty = ''
      const newVenue = await createVenue({
        name: quickName.trim(),
        city: quickCity.trim(),
        street: empty, postalCode: empty, state: empty, country: empty,
        website: empty, arrival: empty, arrivalStreet: empty,
        arrivalPostalCode: empty, arrivalCity: empty,
        capacity: empty, capacitySeated: empty, stageDimensions: empty,
        clearanceHeight: empty, merchandiseFee: empty, merchandiseStand: empty,
        wardrobe: empty, showers: empty, wifi: empty, parking: empty,
        nightlinerParking: empty, loadingPath: empty, notes: empty,
        latitude: empty, longitude: empty,
      })
      setVenues(prev => [...prev, newVenue])
      selectVenue(newVenue)
      setQuickName('')
      setQuickCity('')
    } catch {
      // ignore
    } finally {
      setQuickCreating(false)
    }
  }

  const field = (key: keyof TerminFormData, value: string | number | boolean | null) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = async (andNew = false) => {
    if (!form.date || !form.title) return
    setSaving(true)
    setError(null)
    try {
      let saved: Termin
      if (isEdit) {
        saved = await updateTermin(termin!.id, {
          ...form,
          city: termin!.city,
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
        setSelectedVenue(null)
        setVenueSearch('')
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
      <div className="modal-container max-w-lg">

        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? t('termin.edit') : t('termin.new')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div ref={containerRef} className="modal-body space-y-4">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
              {error}
            </div>
          )}

          {/* Datum */}
          <div>
            <label className="form-label">{t('quickCreate.date')}</label>
            <input
              type="date"
              value={form.date}
              onChange={e => field('date', e.target.value)}
              className="form-input"
            />
          </div>

          {/* Art */}
          <div>
            <label className="form-label">{t('termin.type')}</label>
            <div className="grid grid-cols-2 gap-2">
              <select value={form.art || ''} onChange={e => field('art', e.target.value)}
                className="form-select">
                <option value="">{t('termin.selectPlaceholder')}</option>
                {TERMIN_ART.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={form.art_sub || ''} onChange={e => field('art_sub', e.target.value)}
                className="form-select">
                <option value="">{t('termin.selectPlaceholder')}</option>
                {TERMIN_ART_SUB.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="form-label">{t('termin.status')}</label>
            <div className="grid grid-cols-2 gap-2">
              <select value={form.status_booking || ''} onChange={e => field('status_booking', e.target.value)}
                className="form-select">
                <option value="">{t('termin.selectPlaceholder')}</option>
                {TERMIN_STATUS_BOOKING.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={form.status_public || ''} onChange={e => field('status_public', e.target.value)}
                className="form-select">
                <option value="">{t('termin.selectPlaceholder')}</option>
                {TERMIN_STATUS_PUBLIC.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Venue Picker */}
          <div>
            <label className="form-label">{t('termin.venue')}</label>
            <div ref={venueRef} className="relative">
              {selectedVenue ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
                  <Building2 size={14} className="text-indigo-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">{selectedVenue.name}</div>
                    {selectedVenue.city && (
                      <div className="text-xs text-gray-500 truncate">{selectedVenue.city}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={clearVenue}
                    className="text-gray-400 hover:text-gray-600 shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setVenueDropdownOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600 bg-white text-left"
                >
                  <Search size={14} />
                  {t('termin.venueSearch')}
                </button>
              )}

              {venueDropdownOpen && (
                <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {!quickCreate ? (
                    <>
                      <div className="p-2 border-b border-gray-100">
                        <input
                          autoFocus
                          type="text"
                          placeholder={t('termin.venueSearchPlaceholder')}
                          value={venueSearch}
                          onChange={e => setVenueSearch(e.target.value)}
                          className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredVenues.length === 0 && (
                          <div className="px-3 py-2 text-xs text-gray-400">{t('general.noResults')}</div>
                        )}
                        {filteredVenues.map(v => (
                          <button
                            key={v.id}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); selectVenue(v) }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                          >
                            <Building2 size={13} className="text-gray-400 shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-800">{v.name}</div>
                              {v.city && <div className="text-xs text-gray-400">{v.city}</div>}
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-gray-100">
                        <button
                          type="button"
                          onMouseDown={e => { e.preventDefault(); setQuickCreate(true) }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 text-indigo-600 text-sm font-medium"
                        >
                          <Plus size={14} />
                          {t('termin.venueNew')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-3 space-y-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('termin.venueNewLabel')}</div>
                      <input
                        autoFocus
                        type="text"
                        placeholder={t('termin.venueName')}
                        value={quickName}
                        onChange={e => setQuickName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleQuickCreate()}
                        className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:border-indigo-400"
                      />
                      <input
                        type="text"
                        placeholder={t('termin.venueCity')}
                        value={quickCity}
                        onChange={e => setQuickCity(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleQuickCreate()}
                        className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:border-indigo-400"
                      />
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setQuickCreate(false)}
                          className="flex-1 text-xs py-1.5 border border-gray-200 rounded hover:bg-gray-50 text-gray-600"
                        >
                          {t('general.back')}
                        </button>
                        <button
                          type="button"
                          onClick={handleQuickCreate}
                          disabled={!quickName.trim() || quickCreating}
                          className="flex-1 text-xs py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {quickCreating ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          {t('general.create')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Titel */}
          <div>
            <label className="form-label">{t('general.title')} *</label>
            <input
              type="text"
              placeholder={t('termin.titlePlaceholder')}
              value={form.title}
              onChange={e => field('title', e.target.value)}
              className="form-input"
            />
          </div>

          {/* Haken: Titel als Header — nur wenn Venue verknüpft */}
          {selectedVenue && (
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!form.show_title_as_header}
                onChange={e => field('show_title_as_header', e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">
                {t('termin.showTitleAsHeader')}
              </span>
            </label>
          )}
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
                <span className="hidden md:inline">{t('termin.delete')}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn btn-ghost">
              {t('general.cancel')}
            </button>
            {!isEdit && allowAddAnother && (
              <button
                onClick={() => handleSave(true)}
                disabled={saving || !form.date || !form.title}
                className="btn btn-secondary disabled:opacity-50"
              >
                {t('termin.saveAndNew')}
              </button>
            )}
            <button
              onClick={() => handleSave(false)}
              disabled={saving || !form.date || !form.title}
              className="btn btn-primary disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {t('general.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
