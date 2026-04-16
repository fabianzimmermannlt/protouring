'use client'

import { useState } from 'react'
import { Trash2, Save, X } from 'lucide-react'
import { createVehicle, updateVehicle, deleteVehicle, type Vehicle, type VehicleFormData } from '@/lib/api-client'

const VEHICLE_TYPES = ['Nightliner', 'Van', 'Transporter', 'LKW', 'PKW', 'Limousine', 'Sonstiges', 'Coach']

const MOCK_USERS = [
  'Max Mustermann', 'Erika Mustermann', 'Thomas Schmidt',
  'Lisa Müller', 'Michael Weber', 'Sarah Fischer'
]

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

interface VehicleFormModalProps {
  vehicle: Vehicle | null
  onClose: () => void
  onSaved: (v: Vehicle) => void
  onDeleted?: (id: string) => void
}

export default function VehicleFormModal({ vehicle, onClose, onSaved, onDeleted }: VehicleFormModalProps) {
  const [formData, setFormData] = useState<VehicleFormData>(
    vehicle
      ? {
          designation: vehicle.designation,
          vehicleType: vehicle.vehicleType,
          driver: vehicle.driver,
          licensePlate: vehicle.licensePlate,
          dimensions: vehicle.dimensions,
          powerConnection: vehicle.powerConnection,
          hasTrailer: vehicle.hasTrailer,
          trailerDimensions: vehicle.trailerDimensions,
          trailerLicensePlate: vehicle.trailerLicensePlate,
          seats: vehicle.seats,
          sleepingPlaces: vehicle.sleepingPlaces,
          notes: vehicle.notes,
        }
      : { ...EMPTY_FORM }
  )

  const set = (patch: Partial<VehicleFormData>) => setFormData(prev => ({ ...prev, ...patch }))

  const handleSave = async () => {
    if (!formData.designation.trim()) { alert('Bitte eine Bezeichnung eingeben.'); return }
    try {
      if (vehicle) {
        const updated = await updateVehicle(vehicle.id, formData)
        onSaved(updated)
      } else {
        const created = await createVehicle(formData)
        onSaved(created)
      }
      onClose()
    } catch { alert('Speichern fehlgeschlagen.') }
  }

  const handleDelete = async () => {
    if (!vehicle) return
    if (!confirm('Möchten Sie dieses Fahrzeug wirklich löschen?')) return
    try {
      await deleteVehicle(vehicle.id)
      onDeleted?.(vehicle.id)
      onClose()
    } catch { alert('Löschen fehlgeschlagen.') }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-4xl">
        <div className="modal-header">
          <h2 className="modal-title">{vehicle ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="modal-body">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Linke Spalte */}
            <div className="space-y-3">
              <div>
                <label className="form-label">Bezeichnung</label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={e => set({ designation: e.target.value })}
                  className="form-input"
                  placeholder="z.B. Tourbus 1"
                />
              </div>

              <div>
                <label className="form-label">Fahrzeugart</label>
                <select
                  value={formData.vehicleType}
                  onChange={e => set({ vehicleType: e.target.value })}
                  className="form-input"
                >
                  <option value="">Bitte wählen</option>
                  {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">Driver</label>
                <select
                  value={formData.driver}
                  onChange={e => set({ driver: e.target.value })}
                  className="form-input"
                >
                  <option value="">Bitte wählen</option>
                  {MOCK_USERS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">Kennzeichen</label>
                <input
                  type="text"
                  value={formData.licensePlate}
                  onChange={e => set({ licensePlate: e.target.value })}
                  className="form-input"
                  placeholder="AB-CD 123"
                />
              </div>

              <div>
                <label className="form-label">Maße</label>
                <input
                  type="text"
                  value={formData.dimensions}
                  onChange={e => set({ dimensions: e.target.value })}
                  className="form-input"
                  placeholder="z.B. 12m x 2.5m x 3.5m"
                />
              </div>
            </div>

            {/* Rechte Spalte */}
            <div className="space-y-3">
              <div>
                <label className="form-label">Stromanschluss</label>
                <input
                  type="text"
                  value={formData.powerConnection}
                  onChange={e => set({ powerConnection: e.target.value })}
                  className="form-input"
                  placeholder="z.B. 32A, 230V"
                />
              </div>

              <div>
                <label className="form-label">Anhänger</label>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.hasTrailer}
                    onChange={e => set({ hasTrailer: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Anhänger vorhanden</span>
                </div>
              </div>

              {formData.hasTrailer && (
                <>
                  <div>
                    <label className="form-label">Anhängermaße</label>
                    <input
                      type="text"
                      value={formData.trailerDimensions}
                      onChange={e => set({ trailerDimensions: e.target.value })}
                      className="form-input"
                      placeholder="z.B. 8m x 2.2m x 2.8m"
                    />
                  </div>

                  <div>
                    <label className="form-label">Anhänger-Kennzeichen</label>
                    <input
                      type="text"
                      value={formData.trailerLicensePlate}
                      onChange={e => set({ trailerLicensePlate: e.target.value })}
                      className="form-input"
                      placeholder="XY-ZW 789"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="form-label">Sitzplätze</label>
                <input
                  type="text"
                  value={formData.seats}
                  onChange={e => set({ seats: e.target.value })}
                  className="form-input"
                  placeholder="z.B. 8"
                />
              </div>

              <div>
                <label className="form-label">Schlafplätze</label>
                <input
                  type="text"
                  value={formData.sleepingPlaces}
                  onChange={e => set({ sleepingPlaces: e.target.value })}
                  className="form-input"
                  placeholder="z.B. 4"
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <label className="form-label">Bemerkung</label>
            <textarea
              value={formData.notes}
              onChange={e => set({ notes: e.target.value })}
              className="form-input"
              rows={3}
              placeholder="Zusätzliche Informationen oder Bemerkungen"
            />
          </div>
        </div>

        <div className="modal-footer">
          <div className="flex items-center gap-3">
            {vehicle && (
              <button onClick={handleDelete} className="btn btn-danger">
                <Trash2 className="h-4 w-4" />
                Löschen
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
            <button onClick={handleSave} className="btn btn-primary">
              <Save className="h-4 w-4" />
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
