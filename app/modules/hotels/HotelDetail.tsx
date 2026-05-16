'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, AlertCircle, Save, Loader2, Building2, Clock, Coffee, X } from 'lucide-react'
import { useT } from '@/app/lib/i18n/LanguageContext'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'
import {
  isEditorRole, getEffectiveRole,
  getHotel, updateHotel, type Hotel, type HotelFormData,
} from '@/lib/api-client'

function KV({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 text-sm py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-400 font-medium text-xs uppercase tracking-wide leading-5">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  )
}

function IField({ label, value, onChange, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</label>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 bg-white"
      />
    </div>
  )
}

function ITextarea({ label, value, onChange, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</label>
      <textarea
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={2}
        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 bg-white resize-none"
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
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const loadHotel = useCallback(async () => {
    setLoading(true)
    try {
      const h = await getHotel(hotelId)
      setHotel(h)
      setForm(h as unknown as Record<string, string>)
    } catch {
      if (onNotFound) { onNotFound(); return }
      setLoadError(t('hotels.notFound'))
    } finally {
      setLoading(false)
    }
  }, [hotelId, onNotFound, t])

  useEffect(() => { loadHotel() }, [loadHotel])

  const startEdit = () => {
    if (hotel) setForm(hotel as unknown as Record<string, string>)
    setSaveError('')
    setIsEditing(true)
  }

  const cancelEdit = () => {
    if (hotel) setForm(hotel as unknown as Record<string, string>)
    setIsEditing(false)
    setSaveError('')
  }

  const saveEdit = async () => {
    if (!hotel) return
    setSaving(true); setSaveError('')
    try {
      const updated = await updateHotel(hotelId, form as unknown as HotelFormData)
      setHotel(updated)
      setForm(updated as unknown as Record<string, string>)
      setIsEditing(false)
      window.dispatchEvent(new CustomEvent('hotel-updated', { detail: updated }))
    } catch (e) {
      setSaveError((e as Error).message || t('general.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const f = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }))

  const dark = isL2
  const cardBg = dark ? '#2d2d2d' : undefined
  const barBg = dark ? '#252525' : '#fff'
  const barBorder = dark ? '#4a4a4a' : '#e5e7eb'
  const titleColor = dark ? '#e0e0e0' : '#111827'

  return (
    <div className="module-content">

      {/* Header */}
      <div className="flex items-center justify-between mb-4" style={{ minHeight: '32px' }}>
        <h2 style={{ color: titleColor, fontSize: '17px', fontWeight: 600 }}>
          {loading ? '' : hotel?.name || ''}
        </h2>
        {isEditor && hotel && !isEditing && (
          <button
            onClick={startEdit}
            className="btn btn-ghost"
            style={{ borderRadius: '4px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Pencil className="w-3.5 h-3.5" /> Bearbeiten
          </button>
        )}
      </div>

      {loadError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />{loadError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Allgemein */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Building2 className="w-3.5 h-3.5 inline mr-1" />{t('hotels.cardGeneral')}</span>
          </div>
          <div className="pt-card-body">
            {loading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            ) : isEditing ? (
              <div className="space-y-2">
                <IField label={t('general.name')} value={form.name ?? ''} onChange={v => f('name', v)} />
                <IField label={t('address.street')} value={form.street ?? ''} onChange={v => f('street', v)} />
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <IField label={t('address.postalCode')} value={form.postalCode ?? ''} onChange={v => f('postalCode', v)} />
                  <IField label={t('address.city')} value={form.city ?? ''} onChange={v => f('city', v)} />
                </div>
                <IField label={t('address.country')} value={form.country ?? ''} onChange={v => f('country', v)} />
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('general.phone')} value={form.phone ?? ''} onChange={v => f('phone', v)} />
                  <IField label={t('general.email')} value={form.email ?? ''} onChange={v => f('email', v)} />
                </div>
                <IField label={t('general.website')} value={form.website ?? ''} onChange={v => f('website', v)} placeholder="https://..." />
                <IField label={t('hotels.reception')} value={form.reception ?? ''} onChange={v => f('reception', v)} placeholder={t('hotels.receptionPlaceholder')} />
              </div>
            ) : hotel ? (
              <>
                {hotel.name && (
                  <div className="grid grid-cols-[160px_1fr] gap-2 text-sm py-1.5 border-b border-gray-50">
                    <span className="text-gray-400 font-medium text-xs uppercase tracking-wide leading-5">{t('general.name')}</span>
                    <span className="text-gray-800 font-semibold">{hotel.name}</span>
                  </div>
                )}
                <KV label={t('address.street')} value={hotel.street || undefined} />
                <KV label={t('address.postalCodeCity')} value={[hotel.postalCode, hotel.city].filter(Boolean).join(' ') || undefined} />
                <KV label={t('address.country')} value={hotel.country || undefined} />
                <KV label={t('general.phone')} value={hotel.phone || undefined} />
                <KV label={t('general.email')} value={hotel.email || undefined} />
                <KV label={t('general.website')} value={hotel.website || undefined} />
                <KV label={t('hotels.reception')} value={hotel.reception || undefined} />
                {!hotel.name && !hotel.street && !hotel.city && !hotel.phone && !hotel.email && (
                  <p className="text-sm text-gray-400 py-2">{t('hotels.noData')}</p>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Check-in / Check-out */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Clock className="w-3.5 h-3.5 inline mr-1" />{t('hotels.cardCheckin')}</span>
          </div>
          <div className="pt-card-body">
            {loading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            ) : isEditing ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('hotels.checkin')} value={form.checkIn ?? ''} onChange={v => f('checkIn', v)} placeholder={t('hotels.checkinPlaceholder')} />
                  <IField label={t('hotels.checkout')} value={form.checkOut ?? ''} onChange={v => f('checkOut', v)} placeholder={t('hotels.checkoutPlaceholder')} />
                </div>
                <IField label={t('hotels.earlyCheckin')} value={form.earlyCheckIn ?? ''} onChange={v => f('earlyCheckIn', v)} placeholder={t('hotels.earlyCheckinPlaceholder')} />
                <IField label={t('hotels.lateCheckout')} value={form.lateCheckOut ?? ''} onChange={v => f('lateCheckOut', v)} placeholder={t('hotels.lateCheckoutPlaceholder')} />
              </div>
            ) : hotel ? (
              <>
                <KV label={t('hotels.checkin')} value={hotel.checkIn || undefined} />
                <KV label={t('hotels.checkout')} value={hotel.checkOut || undefined} />
                <KV label={t('hotels.earlyCheckin')} value={hotel.earlyCheckIn || undefined} />
                <KV label={t('hotels.lateCheckout')} value={hotel.lateCheckOut || undefined} />
                {!hotel.checkIn && !hotel.checkOut && !hotel.earlyCheckIn && !hotel.lateCheckOut && (
                  <p className="text-sm text-gray-400 py-2">{t('hotels.noCheckInData')}</p>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Services */}
        <div className="pt-card md:col-span-2">
          <div className="pt-card-header">
            <span className="pt-card-title"><Coffee className="w-3.5 h-3.5 inline mr-1" />{t('hotels.cardServices')}</span>
          </div>
          <div className="pt-card-body">
            {loading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            ) : isEditing ? (
              <div className="space-y-2">
                <IField label={t('hotels.breakfast')} value={form.breakfast ?? ''} onChange={v => f('breakfast', v)} placeholder={t('hotels.breakfastPlaceholder')} />
                <IField label={t('hotels.breakfastWeekend')} value={form.breakfastWeekend ?? ''} onChange={v => f('breakfastWeekend', v)} />
                <ITextarea label={t('hotels.additionalInfo')} value={form.additionalInfo ?? ''} onChange={v => f('additionalInfo', v)} />
              </div>
            ) : hotel ? (
              <>
                <KV label={t('hotels.breakfast')} value={hotel.breakfast || undefined} />
                <KV label={t('hotels.breakfastWeekendShort')} value={hotel.breakfastWeekend || undefined} />
                <KV label={t('hotels.additionalInfoShort')} value={hotel.additionalInfo || undefined} />
                {!hotel.breakfast && !hotel.breakfastWeekend && !hotel.additionalInfo && (
                  <p className="text-sm text-gray-400 py-2">{t('hotels.noServices')}</p>
                )}
              </>
            ) : null}
          </div>
        </div>

      </div>

      {/* Sticky Save Bar */}
      {isEditing && (
        <div style={{
          position: 'sticky', bottom: 0,
          background: barBg,
          borderTop: `1px solid ${barBorder}`,
          padding: '12px 0',
          marginTop: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px',
        }}>
          {saveError && (
            <span style={{ color: '#f87171', fontSize: '13px', marginRight: 'auto' }}>{saveError}</span>
          )}
          <button
            onClick={cancelEdit}
            style={{ padding: '7px 14px', fontSize: '13px', color: dark ? '#b0b0b0' : '#6b7280', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <X className="w-3.5 h-3.5" /> {t('general.cancel')}
          </button>
          <button
            onClick={saveEdit}
            disabled={saving}
            style={{ padding: '7px 16px', fontSize: '13px', fontWeight: 500, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {t('general.save')}
          </button>
        </div>
      )}

    </div>
  )
}
