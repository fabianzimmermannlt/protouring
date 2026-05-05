'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, AlertCircle, Save, Loader2, Truck, Users } from 'lucide-react'
import {
  isEditorRole, getEffectiveRole,
  getVehicle, updateVehicle, deleteVehicle, type Vehicle, type VehicleFormData,
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

export function VehicleDetailContent({ vehicleId }: { vehicleId: string }) {
  const isEditor = isEditorRole(getEffectiveRole())

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  type EditSection = 'fahrzeug' | 'anhaenger' | 'kapazitaet'
  const [editingSection, setEditingSection] = useState<EditSection | null>(null)
  const [inlineForm, setInlineForm] = useState<Record<string, string | boolean>>({})
  const [savingInline, setSavingInline] = useState(false)
  const [inlineError, setInlineError] = useState('')

  const loadVehicle = useCallback(async () => {
    setLoading(true)
    try {
      const v = await getVehicle(vehicleId)
      setVehicle(v)
      setInlineForm(v as any)
    } catch (e) {
      setError((e as Error).message || 'Fahrzeug nicht gefunden')
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  useEffect(() => { loadVehicle() }, [loadVehicle])

  function startEditSection(section: EditSection) {
    if (vehicle) setInlineForm({ ...vehicle as any })
    setInlineError('')
    setEditingSection(section)
  }

  function cancelEditSection() {
    if (vehicle) setInlineForm({ ...vehicle as any })
    setEditingSection(null)
    setInlineError('')
  }

  async function saveInlineSection() {
    if (!vehicle) return
    setSavingInline(true)
    setInlineError('')
    try {
      const updated = await updateVehicle(vehicleId, inlineForm as unknown as VehicleFormData)
      setVehicle(updated)
      setInlineForm({ ...updated as any })
      setEditingSection(null)
    } catch (e) {
      setInlineError((e as Error).message || 'Speichern fehlgeschlagen')
    } finally {
      setSavingInline(false)
    }
  }

  const iF = (key: string, value: string | boolean) => setInlineForm(prev => ({ ...prev, [key]: value }))

  const hasTrailer = inlineForm.hasTrailer === true || inlineForm.hasTrailer === 'true'

  const handleDiscard = async () => {
    if (!vehicle) return
    try {
      await deleteVehicle(vehicleId)
      window.dispatchEvent(new CustomEvent('vehicle-list-refresh'))
      window.dispatchEvent(new CustomEvent('vehicle-discarded', { detail: { id: vehicleId } }))
    } catch (e) { console.error('Failed to discard vehicle', e) }
  }

  return (
    <div className="module-content">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}
      {isEditor && vehicle?.designation === 'Neues Fahrzeug' && (
        <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-sm text-amber-800 flex-1">Neues Fahrzeug — Angaben ergänzen oder verwerfen.</span>
          <button onClick={handleDiscard} className="text-xs font-medium text-red-600 hover:text-red-800">Verwerfen</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Fahrzeug */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Truck className="w-3.5 h-3.5 inline mr-1" />Fahrzeug</span>
            {isEditor && vehicle && editingSection !== 'fahrzeug' && (
              <button onClick={() => startEditSection('fahrzeug')} className="text-gray-400 hover:text-blue-600 transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            : editingSection === 'fahrzeug' ? (
              <div className="space-y-2">
                <IField label="Bezeichnung *" value={String(inlineForm.designation ?? '')} onChange={v => iF('designation', v)} placeholder="z.B. Tourbus Mercedes Sprinter" />
                <IField label="Fahrzeugtyp" value={String(inlineForm.vehicleType ?? '')} onChange={v => iF('vehicleType', v)} placeholder="z.B. Tourbus, Nightliner, Sprinter" />
                <IField label="Fahrer" value={String(inlineForm.driver ?? '')} onChange={v => iF('driver', v)} />
                <IField label="Kennzeichen" value={String(inlineForm.licensePlate ?? '')} onChange={v => iF('licensePlate', v)} />
                <IField label="Abmessungen" value={String(inlineForm.dimensions ?? '')} onChange={v => iF('dimensions', v)} placeholder="z.B. 12m × 2,5m × 4m" />
                <IField label="Stromanschluss" value={String(inlineForm.powerConnection ?? '')} onChange={v => iF('powerConnection', v)} placeholder="z.B. CEE 32A" />
                <InlineSaveBar onSave={saveInlineSection} onCancel={cancelEditSection} saving={savingInline} error={inlineError} />
              </div>
            ) : vehicle ? (
              <>
                {vehicle.designation && (
                  <div className="grid grid-cols-[160px_1fr] gap-2 text-sm py-1.5 border-b border-gray-50">
                    <span className="text-gray-400 font-medium text-xs uppercase tracking-wide leading-5">Bezeichnung</span>
                    <span className="text-gray-800 font-semibold">{vehicle.designation}</span>
                  </div>
                )}
                <KV label="Typ" value={vehicle.vehicleType || undefined} />
                <KV label="Fahrer" value={vehicle.driver || undefined} />
                <KV label="Kennzeichen" value={vehicle.licensePlate || undefined} />
                <KV label="Abmessungen" value={vehicle.dimensions || undefined} />
                <KV label="Stromanschluss" value={vehicle.powerConnection || undefined} />
                {!vehicle.designation && !vehicle.vehicleType && !vehicle.driver && !vehicle.licensePlate && (
                  <p className="text-sm text-gray-400 py-2">Keine Angaben hinterlegt.</p>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Anhänger */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Truck className="w-3.5 h-3.5 inline mr-1" />Anhänger</span>
            {isEditor && vehicle && editingSection !== 'anhaenger' && (
              <button onClick={() => startEditSection('anhaenger')} className="text-gray-400 hover:text-blue-600 transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            : editingSection === 'anhaenger' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="hasTrailer" checked={hasTrailer}
                    onChange={e => iF('hasTrailer', e.target.checked)}
                    className="rounded border-gray-300" />
                  <label htmlFor="hasTrailer" className="text-sm text-gray-700">Anhänger vorhanden</label>
                </div>
                {hasTrailer && (
                  <>
                    <IField label="Abmessungen Anhänger" value={String(inlineForm.trailerDimensions ?? '')} onChange={v => iF('trailerDimensions', v)} />
                    <IField label="Kennzeichen Anhänger" value={String(inlineForm.trailerLicensePlate ?? '')} onChange={v => iF('trailerLicensePlate', v)} />
                  </>
                )}
                <InlineSaveBar onSave={saveInlineSection} onCancel={cancelEditSection} saving={savingInline} error={inlineError} />
              </div>
            ) : vehicle ? (
              <>
                <KV label="Anhänger" value={vehicle.hasTrailer ? 'Ja' : undefined} />
                <KV label="Abmessungen" value={vehicle.trailerDimensions || undefined} />
                <KV label="Kennzeichen" value={vehicle.trailerLicensePlate || undefined} />
                {!vehicle.hasTrailer && !vehicle.trailerDimensions && !vehicle.trailerLicensePlate && (
                  <p className="text-sm text-gray-400 py-2">Kein Anhänger hinterlegt.</p>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Kapazität */}
        <div className="pt-card md:col-span-2">
          <div className="pt-card-header">
            <span className="pt-card-title"><Users className="w-3.5 h-3.5 inline mr-1" />Kapazität & Notizen</span>
            {isEditor && vehicle && editingSection !== 'kapazitaet' && (
              <button onClick={() => startEditSection('kapazitaet')} className="text-gray-400 hover:text-blue-600 transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            : editingSection === 'kapazitaet' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <IField label="Sitzplätze" value={String(inlineForm.seats ?? '')} onChange={v => iF('seats', v)} placeholder="z.B. 12" />
                  <IField label="Schlafplätze" value={String(inlineForm.sleepingPlaces ?? '')} onChange={v => iF('sleepingPlaces', v)} placeholder="z.B. 10" />
                </div>
                <ITextarea label="Notizen" value={String(inlineForm.notes ?? '')} onChange={v => iF('notes', v)} />
                <InlineSaveBar onSave={saveInlineSection} onCancel={cancelEditSection} saving={savingInline} error={inlineError} />
              </div>
            ) : vehicle ? (
              <>
                <KV label="Sitzplätze" value={vehicle.seats || undefined} />
                <KV label="Schlafplätze" value={vehicle.sleepingPlaces || undefined} />
                <KV label="Notizen" value={vehicle.notes || undefined} />
                {!vehicle.seats && !vehicle.sleepingPlaces && !vehicle.notes && (
                  <p className="text-sm text-gray-400 py-2">Keine Kapazitätsdaten hinterlegt.</p>
                )}
              </>
            ) : null}
          </div>
        </div>

      </div>

    </div>
  )
}
