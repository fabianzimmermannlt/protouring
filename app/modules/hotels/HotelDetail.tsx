'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, AlertCircle, Save, Loader2, Building2, Clock, Coffee } from 'lucide-react'
import {
  isEditorRole, getEffectiveRole,
  getHotel, updateHotel, deleteHotel, type Hotel, type HotelFormData,
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

function InlineSaveBar({ onSave, onCancel, saving, error }: {
  onSave: () => void; onCancel: () => void; saving: boolean; error?: string
}) {
  return (
    <div className="pt-2 border-t border-gray-100 mt-2">
      {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Abbrechen</button>
        <button onClick={onSave} disabled={saving}
          className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Speichern
        </button>
      </div>
    </div>
  )
}

export function HotelDetailContent({ hotelId }: { hotelId: string }) {
  const isEditor = isEditorRole(getEffectiveRole())

  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  type EditSection = 'allgemein' | 'checkin' | 'services'
  const [editingSection, setEditingSection] = useState<EditSection | null>(null)
  const [inlineForm, setInlineForm] = useState<Record<string, string>>({})
  const [savingInline, setSavingInline] = useState(false)
  const [inlineError, setInlineError] = useState('')

  const loadHotel = useCallback(async () => {
    setLoading(true)
    try {
      const h = await getHotel(hotelId)
      setHotel(h)
      setInlineForm(h as any)
    } catch (e) {
      setError((e as Error).message || 'Hotel nicht gefunden')
    } finally {
      setLoading(false)
    }
  }, [hotelId])

  useEffect(() => { loadHotel() }, [loadHotel])

  function startEditSection(section: EditSection) {
    if (hotel) setInlineForm({ ...hotel as any })
    setInlineError('')
    setEditingSection(section)
  }

  function cancelEditSection() {
    if (hotel) setInlineForm({ ...hotel as any })
    setEditingSection(null)
    setInlineError('')
  }

  async function saveInlineSection() {
    if (!hotel) return
    setSavingInline(true)
    setInlineError('')
    try {
      const updated = await updateHotel(hotelId, inlineForm as unknown as HotelFormData)
      setHotel(updated)
      setInlineForm({ ...updated as any })
      setEditingSection(null)
    } catch (e) {
      setInlineError((e as Error).message || 'Speichern fehlgeschlagen')
    } finally {
      setSavingInline(false)
    }
  }

  const iF = (key: string, value: string) => setInlineForm(prev => ({ ...prev, [key]: value }))

  return (
    <div className="module-content">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Allgemein */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Building2 className="w-3.5 h-3.5 inline mr-1" />Allgemein</span>
            {isEditor && hotel && editingSection !== 'allgemein' && (
              <button onClick={() => startEditSection('allgemein')} className="text-gray-400 hover:text-blue-600 transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            : editingSection === 'allgemein' ? (
              <div className="space-y-2">
                <IField label="Name *" value={inlineForm.name ?? ''} onChange={v => iF('name', v)} />
                <IField label="Straße" value={inlineForm.street ?? ''} onChange={v => iF('street', v)} />
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <IField label="PLZ" value={inlineForm.postalCode ?? ''} onChange={v => iF('postalCode', v)} />
                  <IField label="Ort" value={inlineForm.city ?? ''} onChange={v => iF('city', v)} />
                </div>
                <IField label="Land" value={inlineForm.country ?? ''} onChange={v => iF('country', v)} />
                <div className="grid grid-cols-2 gap-2">
                  <IField label="Telefon" value={inlineForm.phone ?? ''} onChange={v => iF('phone', v)} />
                  <IField label="E-Mail" value={inlineForm.email ?? ''} onChange={v => iF('email', v)} />
                </div>
                <IField label="Website" value={inlineForm.website ?? ''} onChange={v => iF('website', v)} placeholder="https://..." />
                <IField label="Rezeption" value={inlineForm.reception ?? ''} onChange={v => iF('reception', v)} placeholder="Direkte Rezeptionsnummer" />
                <InlineSaveBar onSave={saveInlineSection} onCancel={cancelEditSection} saving={savingInline} error={inlineError} />
              </div>
            ) : hotel ? (
              <>
                {hotel.name && (
                  <div className="grid grid-cols-[160px_1fr] gap-2 text-sm py-1.5 border-b border-gray-50">
                    <span className="text-gray-400 font-medium text-xs uppercase tracking-wide leading-5">Name</span>
                    <span className="text-gray-800 font-semibold">{hotel.name}</span>
                  </div>
                )}
                <KV label="Straße" value={hotel.street || undefined} />
                <KV label="PLZ / Ort" value={[hotel.postalCode, hotel.city].filter(Boolean).join(' ') || undefined} />
                <KV label="Land" value={hotel.country || undefined} />
                <KV label="Telefon" value={hotel.phone || undefined} />
                <KV label="E-Mail" value={hotel.email || undefined} />
                <KV label="Website" value={hotel.website || undefined} />
                <KV label="Rezeption" value={hotel.reception || undefined} />
                {!hotel.name && !hotel.street && !hotel.city && !hotel.phone && !hotel.email && (
                  <p className="text-sm text-gray-400 py-2">Keine Angaben hinterlegt.</p>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Check-in / Check-out */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Clock className="w-3.5 h-3.5 inline mr-1" />Check-in / Check-out</span>
            {isEditor && hotel && editingSection !== 'checkin' && (
              <button onClick={() => startEditSection('checkin')} className="text-gray-400 hover:text-blue-600 transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            : editingSection === 'checkin' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <IField label="Check-in" value={inlineForm.checkIn ?? ''} onChange={v => iF('checkIn', v)} placeholder="z.B. 15:00" />
                  <IField label="Check-out" value={inlineForm.checkOut ?? ''} onChange={v => iF('checkOut', v)} placeholder="z.B. 11:00" />
                </div>
                <IField label="Früh-Check-in" value={inlineForm.earlyCheckIn ?? ''} onChange={v => iF('earlyCheckIn', v)} placeholder="z.B. ab 10:00 möglich" />
                <IField label="Spät-Check-out" value={inlineForm.lateCheckOut ?? ''} onChange={v => iF('lateCheckOut', v)} placeholder="z.B. bis 14:00 möglich" />
                <InlineSaveBar onSave={saveInlineSection} onCancel={cancelEditSection} saving={savingInline} error={inlineError} />
              </div>
            ) : hotel ? (
              <>
                <KV label="Check-in" value={hotel.checkIn || undefined} />
                <KV label="Check-out" value={hotel.checkOut || undefined} />
                <KV label="Früh-Check-in" value={hotel.earlyCheckIn || undefined} />
                <KV label="Spät-Check-out" value={hotel.lateCheckOut || undefined} />
                {!hotel.checkIn && !hotel.checkOut && !hotel.earlyCheckIn && !hotel.lateCheckOut && (
                  <p className="text-sm text-gray-400 py-2">Keine Zeiten hinterlegt.</p>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Services */}
        <div className="pt-card md:col-span-2">
          <div className="pt-card-header">
            <span className="pt-card-title"><Coffee className="w-3.5 h-3.5 inline mr-1" />Services</span>
            {isEditor && hotel && editingSection !== 'services' && (
              <button onClick={() => startEditSection('services')} className="text-gray-400 hover:text-blue-600 transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            : editingSection === 'services' ? (
              <div className="space-y-2">
                <IField label="Frühstück" value={inlineForm.breakfast ?? ''} onChange={v => iF('breakfast', v)} placeholder="z.B. inkl., 15€ p.P." />
                <IField label="Frühstück Wochenende" value={inlineForm.breakfastWeekend ?? ''} onChange={v => iF('breakfastWeekend', v)} />
                <ITextarea label="Zusätzliche Infos" value={inlineForm.additionalInfo ?? ''} onChange={v => iF('additionalInfo', v)} />
                <InlineSaveBar onSave={saveInlineSection} onCancel={cancelEditSection} saving={savingInline} error={inlineError} />
              </div>
            ) : hotel ? (
              <>
                <KV label="Frühstück" value={hotel.breakfast || undefined} />
                <KV label="Frühstück WE" value={hotel.breakfastWeekend || undefined} />
                <KV label="Zusatzinfo" value={hotel.additionalInfo || undefined} />
                {!hotel.breakfast && !hotel.breakfastWeekend && !hotel.additionalInfo && (
                  <p className="text-sm text-gray-400 py-2">Keine Service-Infos hinterlegt.</p>
                )}
              </>
            ) : null}
          </div>
        </div>

      </div>

      {isEditor && hotel && (
        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={async () => {
              if (!confirm(`Hotel "${hotel.name}" wirklich löschen?`)) return
              try {
                await deleteHotel(hotelId)
                window.dispatchEvent(new CustomEvent('hotel-deleted', { detail: { id: hotelId } }))
                history.pushState(null, '', '/?tab=hotels')
              } catch { alert('Löschen fehlgeschlagen') }
            }}
            className="btn btn-danger"
          >
            <Trash2 className="w-3.5 h-3.5" /> Hotel löschen
          </button>
        </div>
      )}
    </div>
  )
}
