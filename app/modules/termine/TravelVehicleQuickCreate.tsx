'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Save, X, Loader2 } from 'lucide-react'
import { createVehicle, getVehicleTypes, type Vehicle, type VehicleFormData } from '@/lib/api-client'
import { useT } from '@/app/lib/i18n/LanguageContext'
import { useEscapeKey } from '@/app/hooks/useEscapeKey'

// Travel-spezifisches Schnell-Anlegen für Fahrzeuge (Progressive Disclosure).
// Bewusst NICHT die geteilte VehicleFormModal — die Stammdaten im Hauptmenü bleiben unverändert.
// Legt in-place an und gibt den Datensatz per onCreated zurück (kein Seitenwechsel).

const VEHICLE_TYPES_FALLBACK = ['Nightliner', 'Van', 'Transporter', 'LKW', 'PKW', 'Limousine', 'Sonstiges', 'Coach']

const EMPTY_FORM: VehicleFormData = {
  designation: '',
  vehicleType: '',
  driver: '',
  licensePlate: '',
  dimensions: '',
  powerConnection: '',
  hasTrailer: false,
  trailerDimensions: '',
  trailerLicensePlate: '',
  seats: '',
  sleepingPlaces: '',
  notes: '',
}

interface Props {
  onClose: () => void
  onCreated: (v: Vehicle) => void
}

export default function TravelVehicleQuickCreate({ onClose, onCreated }: Props) {
  useEscapeKey(onClose)
  const t = useT()
  const [form, setForm] = useState<VehicleFormData>({ ...EMPTY_FORM })
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(VEHICLE_TYPES_FALLBACK)
  const set = (patch: Partial<VehicleFormData>) => setForm(prev => ({ ...prev, ...patch }))

  useEffect(() => {
    getVehicleTypes()
      .then(types => {
        const visible = types.filter(t => t.visible === 1).map(t => t.name)
        if (visible.length > 0) setVehicleTypes(visible)
      })
      .catch(() => { /* Fallback bleibt erhalten */ })
  }, [])

  const handleSave = async () => {
    if (!form.designation.trim()) { alert(t('vehicles.designationRequired2')); return }
    setSaving(true)
    try {
      const created = await createVehicle(form)
      onCreated(created)
      onClose()
    } catch {
      alert(t('vehicles.saveFailed'))
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-container" style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <h2 className="modal-title">{t('vehicles.newVehicleShort')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="modal-body space-y-3">
          {/* Essentials */}
          <div>
            <label className="form-label">{t('vehicles.designation')}</label>
            <input
              type="text"
              className="form-input"
              value={form.designation}
              onChange={e => set({ designation: e.target.value })}
              placeholder={t('vehicles.designationFullPlaceholder')}
              autoFocus
            />
          </div>
          <div>
            <label className="form-label">{t('vehicles.vehicleType')}</label>
            <select className="form-input" value={form.vehicleType} onChange={e => set({ vehicleType: e.target.value })}>
              <option value="">{t('vehicles.selectPlaceholder')}</option>
              {vehicleTypes.map(vt => <option key={vt} value={vt}>{vt}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('vehicles.seats')}</label>
            <input
              type="text"
              className="form-input"
              value={form.seats}
              onChange={e => set({ seats: e.target.value })}
              placeholder={t('vehicles.seatsPlaceholder')}
            />
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
                <label className="form-label">{t('vehicles.driver')}</label>
                <input type="text" className="form-input" value={form.driver} onChange={e => set({ driver: e.target.value })} />
              </div>
              <div>
                <label className="form-label">{t('vehicles.licensePlate')}</label>
                <input type="text" className="form-input" value={form.licensePlate} onChange={e => set({ licensePlate: e.target.value })} placeholder="AB-CD 123" />
              </div>
              <div>
                <label className="form-label">{t('vehicles.dimensionsShort')}</label>
                <input type="text" className="form-input" value={form.dimensions} onChange={e => set({ dimensions: e.target.value })} placeholder={t('vehicles.dimensionsPlaceholder')} />
              </div>
              <div>
                <label className="form-label">{t('vehicles.powerConnection')}</label>
                <input type="text" className="form-input" value={form.powerConnection} onChange={e => set({ powerConnection: e.target.value })} placeholder={t('vehicles.powerConnectionPlaceholder')} />
              </div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.hasTrailer} onChange={e => set({ hasTrailer: e.target.checked })} className="h-4 w-4" />
                {t('vehicles.hasTrailer')}
              </label>
              {form.hasTrailer && (
                <>
                  <div>
                    <label className="form-label">{t('vehicles.trailerDimensionsShort')}</label>
                    <input type="text" className="form-input" value={form.trailerDimensions} onChange={e => set({ trailerDimensions: e.target.value })} placeholder="z.B. 8m x 2.2m x 2.8m" />
                  </div>
                  <div>
                    <label className="form-label">{t('vehicles.trailerLicensePlateShort')}</label>
                    <input type="text" className="form-input" value={form.trailerLicensePlate} onChange={e => set({ trailerLicensePlate: e.target.value })} placeholder="XY-ZW 789" />
                  </div>
                </>
              )}
              <div>
                <label className="form-label">{t('vehicles.sleepingPlaces')}</label>
                <input type="text" className="form-input" value={form.sleepingPlaces} onChange={e => set({ sleepingPlaces: e.target.value })} placeholder={t('vehicles.sleepingPlacesPlaceholder')} />
              </div>
              <div>
                <label className="form-label">{t('vehicles.notesShort')}</label>
                <textarea className="form-input" rows={3} value={form.notes} onChange={e => set({ notes: e.target.value })} />
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
