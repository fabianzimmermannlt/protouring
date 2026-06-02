'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Save, X, Loader2 } from 'lucide-react'
import { createHotel, type Hotel, type HotelFormData } from '@/lib/api-client'
import { NameAddressAutocomplete } from '@/app/components/shared/AddressAutocomplete'
import { useT } from '@/app/lib/i18n/LanguageContext'
import { useEscapeKey } from '@/app/hooks/useEscapeKey'

// Travel-spezifisches Schnell-Anlegen für Hotels (Progressive Disclosure).
// Bewusst NICHT die geteilte HotelFormModal — die Stammdaten im Hauptmenü bleiben unverändert.
// Name-Autocomplete füllt Adresse automatisch; Rest steckt im einklappbaren Bereich.

const EMPTY_FORM: HotelFormData = {
  name: '',
  street: '',
  postalCode: '',
  city: '',
  state: '',
  country: '',
  email: '',
  phone: '',
  website: '',
  reception: '',
  checkIn: '',
  checkOut: '',
  earlyCheckIn: '',
  lateCheckOut: '',
  breakfast: '',
  breakfastWeekend: '',
  parking: '',
  additionalInfo: '',
}

interface Props {
  onClose: () => void
  onCreated: (h: Hotel) => void
}

export default function TravelHotelQuickCreate({ onClose, onCreated }: Props) {
  useEscapeKey(onClose)
  const t = useT()
  const [form, setForm] = useState<HotelFormData>({ ...EMPTY_FORM })
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<HotelFormData>) => setForm(prev => ({ ...prev, ...patch }))

  const handleSave = async () => {
    if (!form.name.trim()) { alert(t('hotels.hotelNameRequired')); return }
    setSaving(true)
    try {
      const created = await createHotel(form)
      onCreated(created)
      onClose()
    } catch {
      alert(t('hotels.saveFailed'))
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-container" style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <h2 className="modal-title">{t('hotels.newHotelShort')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="modal-body space-y-3">
          {/* Essentials — Name-Autocomplete füllt Adresse automatisch */}
          <NameAddressAutocomplete
            label={t('hotels.hotelNameLabel')}
            variant="modal"
            value={form.name}
            onChange={v => set({ name: v })}
            placeholder="Hotelname"
            onAddressSelect={a => set({
              ...(a.name ? { name: a.name } : {}),
              ...(a.street ? { street: a.street } : {}),
              ...(a.postalCode ? { postalCode: a.postalCode } : {}),
              ...(a.city ? { city: a.city } : {}),
              ...(a.state ? { state: a.state } : {}),
              ...(a.country ? { country: a.country } : {}),
            })}
          />
          <div>
            <label className="form-label">{t('address.city')}</label>
            <input type="text" className="form-input" value={form.city} onChange={e => set({ city: e.target.value })} placeholder="Stadt" />
          </div>

          {/* Progressive Disclosure */}
          <button
            type="button"
            onClick={() => setShowMore(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '0.25rem 0', fontSize: '0.85rem' }}
          >
            {showMore ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Weitere Details
          </button>

          {showMore && (
            <div className="space-y-3">
              <div>
                <label className="form-label">{t('address.street')}</label>
                <input type="text" className="form-input" value={form.street} onChange={e => set({ street: e.target.value })} placeholder="Straße und Hausnummer" />
              </div>
              <div>
                <label className="form-label">{t('address.postalCode')}</label>
                <input type="text" className="form-input" value={form.postalCode} onChange={e => set({ postalCode: e.target.value })} placeholder="Postleitzahl" />
              </div>
              <div>
                <label className="form-label">{t('address.country')}</label>
                <input type="text" className="form-input" value={form.country} onChange={e => set({ country: e.target.value })} placeholder="Land" />
              </div>
              <div>
                <label className="form-label">{t('general.phone')}</label>
                <input type="tel" className="form-input" value={form.phone} onChange={e => set({ phone: e.target.value })} placeholder="+49 123 456789" />
              </div>
              <div>
                <label className="form-label">{t('general.email')}</label>
                <input type="email" className="form-input" value={form.email} onChange={e => set({ email: e.target.value })} placeholder="hotel@beispiel.de" />
              </div>
              <div>
                <label className="form-label">{t('general.website')}</label>
                <input type="url" className="form-input" value={form.website} onChange={e => set({ website: e.target.value })} placeholder="https://www.hotel.de" />
              </div>
              <div>
                <label className="form-label">{t('hotels.checkin')}</label>
                <input type="text" className="form-input" value={form.checkIn} onChange={e => set({ checkIn: e.target.value })} placeholder="15:00 Uhr" />
              </div>
              <div>
                <label className="form-label">{t('hotels.checkout')}</label>
                <input type="text" className="form-input" value={form.checkOut} onChange={e => set({ checkOut: e.target.value })} placeholder="11:00 Uhr" />
              </div>
              <div>
                <label className="form-label">{t('hotels.breakfast')}</label>
                <input type="text" className="form-input" value={form.breakfast} onChange={e => set({ breakfast: e.target.value })} placeholder="7:00 - 10:00 Uhr" />
              </div>
              <div>
                <label className="form-label">{t('hotels.furtherInfo')}</label>
                <textarea className="form-input" rows={3} value={form.additionalInfo} onChange={e => set({ additionalInfo: e.target.value })} placeholder="Zusätzliche Informationen, Hinweise, Besonderheiten..." />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost">{t('general.cancel')}</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('general.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
