'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertCircle, Save, Loader2, Building2, Clock, Coffee, X } from 'lucide-react'
import { useT } from '@/app/lib/i18n/LanguageContext'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'
import {
  isEditorRole, getEffectiveRole,
  getHotel, updateHotel, type Hotel, type HotelFormData,
} from '@/lib/api-client'

function IField({ label, value, onChange, placeholder = '', readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="detail-label">{label}</label>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} readOnly={readOnly}
        className="detail-input"
      />
    </div>
  )
}

function ITextarea({ label, value, onChange, placeholder = '', readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="detail-label">{label}</label>
      <textarea
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={3} readOnly={readOnly}
        className="detail-input resize-none"
      />
    </div>
  )
}

export function HotelDetailContent({ hotelId, onNotFound }: { hotelId: string; onNotFound?: () => void }) {
  const t = useT()
  const { layout } = useLayout()
  const isL2 = layout === 'L2'
  const isEditor = isEditorRole(getEffectiveRole())

  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState<Record<string, string>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const originalRef = useRef<Record<string, string>>({})

  const loadHotel = useCallback(async () => {
    setLoading(true)
    try {
      const h = await getHotel(hotelId)
      setHotel(h)
      const data = h as unknown as Record<string, string>
      setForm(data)
      originalRef.current = data
      setIsDirty(false)
    } catch {
      if (onNotFound) { onNotFound(); return }
      setLoadError(t('hotels.notFound'))
    } finally {
      setLoading(false)
    }
  }, [hotelId, onNotFound, t])

  useEffect(() => { loadHotel() }, [loadHotel])

  const f = (key: string, val: string) => {
    const next = { ...form, [key]: val }
    setForm(next)
    const orig = originalRef.current
    setIsDirty(Object.keys(next).some(k => next[k] !== (orig[k] ?? '')))
  }

  const cancelEdit = () => {
    setForm(originalRef.current)
    setIsDirty(false)
    setSaveError('')
  }

  const saveEdit = async () => {
    if (!hotel) return
    setSaving(true); setSaveError('')
    try {
      const updated = await updateHotel(hotelId, form as unknown as HotelFormData)
      setHotel(updated)
      const data = updated as unknown as Record<string, string>
      setForm(data)
      originalRef.current = data
      setIsDirty(false)
      window.dispatchEvent(new CustomEvent('hotel-updated', { detail: updated }))
    } catch (e) {
      setSaveError((e as Error).message || t('general.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const ro = !isEditor

  const titleColor = isL2 ? '#e0e0e0' : '#111827'
  const dirtyColor = isL2 ? '#b0b0b0' : '#6b7280'

  return (
    <div className="module-content">

      {/* Header */}
      <div className="flex items-center justify-between mb-4" style={{ minHeight: '32px', gap: '12px' }}>
        <h2 style={{ color: titleColor, fontSize: '17px', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loading ? '' : (form.name || hotel?.name || '')}
        </h2>
        {isDirty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '12px', color: dirtyColor }}>Ungespeicherte Änderungen</span>
            <button
              onClick={cancelEdit}
              style={{ padding: '5px 12px', fontSize: '13px', color: dirtyColor, background: 'none', border: `1px solid ${isL2 ? '#555' : '#d1d5db'}`, borderRadius: '4px', cursor: 'pointer' }}
            >
              <X className="w-3 h-3 inline mr-1" />{t('general.cancel')}
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              style={{ padding: '5px 12px', fontSize: '13px', fontWeight: 500, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {t('general.save')}
            </button>
          </div>
        )}
      </div>

      {loadError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />{loadError}
        </div>
      )}
      {saveError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />{saveError}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="pt-card">
              <div className="pt-card-header"><div className="h-3 w-24 bg-gray-100 animate-pulse rounded" /></div>
              <div className="pt-card-body space-y-3">
                {[...Array(4)].map((_, j) => <div key={j} className="h-7 bg-gray-100 animate-pulse rounded" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Allgemein */}
          <div className="pt-card">
            <div className="pt-card-header">
              <span className="pt-card-title"><Building2 className="w-3.5 h-3.5 inline mr-1" />{t('hotels.cardGeneral')}</span>
            </div>
            <div className="pt-card-body">
              <div className="space-y-2">
                <IField label={t('general.name')} value={form.name ?? ''} onChange={v => f('name', v)} readOnly={ro} />
                <IField label={t('address.street')} value={form.street ?? ''} onChange={v => f('street', v)} readOnly={ro} />
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <IField label={t('address.postalCode')} value={form.postalCode ?? ''} onChange={v => f('postalCode', v)} readOnly={ro} />
                  <IField label={t('address.city')} value={form.city ?? ''} onChange={v => f('city', v)} readOnly={ro} />
                </div>
                <IField label={t('address.country')} value={form.country ?? ''} onChange={v => f('country', v)} readOnly={ro} />
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('general.phone')} value={form.phone ?? ''} onChange={v => f('phone', v)} readOnly={ro} />
                  <IField label={t('general.email')} value={form.email ?? ''} onChange={v => f('email', v)} readOnly={ro} />
                </div>
                <IField label={t('general.website')} value={form.website ?? ''} onChange={v => f('website', v)} placeholder="https://..." readOnly={ro} />
                <IField label={t('hotels.reception')} value={form.reception ?? ''} onChange={v => f('reception', v)} placeholder={t('hotels.receptionPlaceholder')} readOnly={ro} />
              </div>
            </div>
          </div>

          {/* Check-in / Check-out */}
          <div className="pt-card">
            <div className="pt-card-header">
              <span className="pt-card-title"><Clock className="w-3.5 h-3.5 inline mr-1" />{t('hotels.cardCheckin')}</span>
            </div>
            <div className="pt-card-body">
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('hotels.checkin')} value={form.checkIn ?? ''} onChange={v => f('checkIn', v)} placeholder={t('hotels.checkinPlaceholder')} readOnly={ro} />
                  <IField label={t('hotels.checkout')} value={form.checkOut ?? ''} onChange={v => f('checkOut', v)} placeholder={t('hotels.checkoutPlaceholder')} readOnly={ro} />
                </div>
                <IField label={t('hotels.earlyCheckin')} value={form.earlyCheckIn ?? ''} onChange={v => f('earlyCheckIn', v)} placeholder={t('hotels.earlyCheckinPlaceholder')} readOnly={ro} />
                <IField label={t('hotels.lateCheckout')} value={form.lateCheckOut ?? ''} onChange={v => f('lateCheckOut', v)} placeholder={t('hotels.lateCheckoutPlaceholder')} readOnly={ro} />
              </div>
            </div>
          </div>

          {/* Services */}
          <div className="pt-card md:col-span-2">
            <div className="pt-card-header">
              <span className="pt-card-title"><Coffee className="w-3.5 h-3.5 inline mr-1" />{t('hotels.cardServices')}</span>
            </div>
            <div className="pt-card-body">
              <div className="space-y-2">
                <IField label={t('hotels.breakfast')} value={form.breakfast ?? ''} onChange={v => f('breakfast', v)} placeholder={t('hotels.breakfastPlaceholder')} readOnly={ro} />
                <IField label={t('hotels.breakfastWeekend')} value={form.breakfastWeekend ?? ''} onChange={v => f('breakfastWeekend', v)} readOnly={ro} />
                <ITextarea label={t('hotels.additionalInfo')} value={form.additionalInfo ?? ''} onChange={v => f('additionalInfo', v)} readOnly={ro} />
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
