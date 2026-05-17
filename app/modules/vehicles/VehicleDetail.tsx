'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertCircle, Save, Loader2, Truck, Users, X, ArrowLeft } from 'lucide-react'
import {
  isEditorRole, getEffectiveRole,
  getVehicle, updateVehicle, type Vehicle, type VehicleFormData,
} from '@/lib/api-client'
import { useT } from '@/app/lib/i18n/LanguageContext'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'

function IField({ label, value, onChange, placeholder = '', readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="detail-label">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} readOnly={readOnly} className="detail-input" />
    </div>
  )
}

function ITextarea({ label, value, onChange, placeholder = '', readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="detail-label">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={3} readOnly={readOnly}
        className="detail-input resize-none" />
    </div>
  )
}

export function VehicleDetailContent({ vehicleId, onNotFound, onBack }: { vehicleId: string; onNotFound?: () => void; onBack?: () => void }) {
  const t = useT()
  const { layout } = useLayout()
  const isL2 = layout === 'L2'
  const isEditor = isEditorRole(getEffectiveRole())

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState<Record<string, string>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showDirtyDialog, setShowDirtyDialog] = useState(false)
  const originalRef = useRef<Record<string, string>>({})

  const loadVehicle = useCallback(async () => {
    setLoading(true)
    try {
      const v = await getVehicle(vehicleId)
      setVehicle(v)
      const data: Record<string, string> = {
        ...(v as unknown as Record<string, string>),
        hasTrailer: v.hasTrailer ? 'true' : 'false',
      }
      setForm(data)
      originalRef.current = data
      setIsDirty(false)
    } catch {
      if (onNotFound) { onNotFound(); return }
      setLoadError(t('vehicles.notFound'))
    } finally {
      setLoading(false)
    }
  }, [vehicleId, onNotFound, t])

  useEffect(() => { loadVehicle() }, [loadVehicle])

  const f = (key: string, val: string) => {
    const next = { ...form, [key]: val }
    setForm(next)
    const orig = originalRef.current
    setIsDirty(Object.keys(next).some(k => next[k] !== (orig[k] ?? '')))
  }

  const cancelEdit = () => { setForm(originalRef.current); setIsDirty(false); setSaveError('') }

  const saveEdit = async (): Promise<boolean> => {
    if (!vehicle) return false
    setSaving(true); setSaveError('')
    try {
      const payload = { ...form, hasTrailer: form.hasTrailer === 'true' } as unknown as VehicleFormData
      const updated = await updateVehicle(vehicleId, payload)
      setVehicle(updated)
      const data: Record<string, string> = {
        ...(updated as unknown as Record<string, string>),
        hasTrailer: updated.hasTrailer ? 'true' : 'false',
      }
      setForm(data)
      originalRef.current = data
      setIsDirty(false)
      window.dispatchEvent(new CustomEvent('vehicle-updated', { detail: updated }))
      return true
    } catch (e) {
      setSaveError((e as Error).message || t('general.saveFailed'))
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => { if (isDirty) setShowDirtyDialog(true); else onBack?.() }

  useEffect(() => {
    ;(window as any).__pt_isDirty = isDirty
    return () => { ;(window as any).__pt_isDirty = false }
  }, [isDirty])

  const ro = !isEditor
  const hasTrailer = form.hasTrailer === 'true'
  const titleColor = isL2 ? '#e0e0e0' : '#111827'
  const dirtyColor = isL2 ? '#b0b0b0' : '#6b7280'
  const labelColor = isL2 ? '#9ca3af' : '#6b7280'

  return (
    <div className="module-content">
      {onBack && (
        <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Übersicht
        </button>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-4" style={{ minHeight: '32px', gap: '12px' }}>
        <h2 style={{ color: titleColor, fontSize: '17px', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loading ? '' : (form.designation || vehicle?.designation || '')}
        </h2>
        {isDirty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '12px', color: dirtyColor }}>Ungespeicherte Änderungen</span>
            <button onClick={cancelEdit}
              style={{ padding: '5px 12px', fontSize: '13px', color: dirtyColor, background: 'none', border: `1px solid ${isL2 ? '#555' : '#d1d5db'}`, borderRadius: '4px', cursor: 'pointer' }}>
              <X className="w-3 h-3 inline mr-1" />{t('general.cancel')}
            </button>
            <button onClick={saveEdit} disabled={saving}
              style={{ padding: '5px 12px', fontSize: '13px', fontWeight: 500, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '5px' }}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {t('general.save')}
            </button>
          </div>
        )}
      </div>

      {loadError && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4"><AlertCircle className="w-4 h-4 shrink-0" />{loadError}</div>}
      {saveError && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4"><AlertCircle className="w-4 h-4 shrink-0" />{saveError}</div>}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="pt-card">
              <div className="pt-card-header"><div className="h-3 w-24 bg-gray-100 animate-pulse rounded" /></div>
              <div className="pt-card-body space-y-3">{[...Array(4)].map((_, j) => <div key={j} className="h-7 bg-gray-100 animate-pulse rounded" />)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Fahrzeug */}
          <div className="pt-card">
            <div className="pt-card-header">
              <span className="pt-card-title"><Truck className="w-3.5 h-3.5 inline mr-1" />{t('vehicles.cardVehicle')}</span>
            </div>
            <div className="pt-card-body">
              <div className="space-y-2">
                <IField label={t('vehicles.designationRequired')} value={form.designation ?? ''} onChange={v => f('designation', v)} placeholder={t('vehicles.designationFullPlaceholder')} readOnly={ro} />
                <IField label={t('vehicles.vehicleType')} value={form.vehicleType ?? ''} onChange={v => f('vehicleType', v)} placeholder={t('vehicles.vehicleTypePlaceholder')} readOnly={ro} />
                <IField label={t('vehicles.driver')} value={form.driver ?? ''} onChange={v => f('driver', v)} readOnly={ro} />
                <IField label={t('vehicles.licensePlate')} value={form.licensePlate ?? ''} onChange={v => f('licensePlate', v)} readOnly={ro} />
                <IField label={t('vehicles.dimensions')} value={form.dimensions ?? ''} onChange={v => f('dimensions', v)} placeholder={t('vehicles.dimensionsPlaceholder')} readOnly={ro} />
                <IField label={t('vehicles.powerConnection')} value={form.powerConnection ?? ''} onChange={v => f('powerConnection', v)} placeholder={t('vehicles.powerConnectionPlaceholder')} readOnly={ro} />
              </div>
            </div>
          </div>

          {/* Anhänger */}
          <div className="pt-card">
            <div className="pt-card-header">
              <span className="pt-card-title"><Truck className="w-3.5 h-3.5 inline mr-1" />{t('vehicles.cardTrailer')}</span>
            </div>
            <div className="pt-card-body">
              <div className="space-y-2">
                <div>
                  <label className="detail-label">{t('vehicles.hasTrailer')}</label>
                  <div style={{ paddingTop: '4px' }}>
                    <input type="checkbox" id="hasTrailer" checked={hasTrailer} disabled={ro}
                      onChange={e => f('hasTrailer', e.target.checked ? 'true' : 'false')}
                      style={{ accentColor: '#60a5fa', width: '14px', height: '14px', cursor: ro ? 'default' : 'pointer' }} />
                    <label htmlFor="hasTrailer" style={{ marginLeft: '6px', fontSize: '0.875rem', color: labelColor, cursor: ro ? 'default' : 'pointer' }}>
                      {hasTrailer ? t('vehicles.trailerYes') : 'Nein'}
                    </label>
                  </div>
                </div>
                {hasTrailer && (
                  <>
                    <IField label={t('vehicles.trailerDimensions')} value={form.trailerDimensions ?? ''} onChange={v => f('trailerDimensions', v)} readOnly={ro} />
                    <IField label={t('vehicles.trailerLicensePlate')} value={form.trailerLicensePlate ?? ''} onChange={v => f('trailerLicensePlate', v)} readOnly={ro} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Kapazität */}
          <div className="pt-card md:col-span-2">
            <div className="pt-card-header">
              <span className="pt-card-title"><Users className="w-3.5 h-3.5 inline mr-1" />{t('vehicles.cardCapacity')}</span>
            </div>
            <div className="pt-card-body">
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('vehicles.seats')} value={form.seats ?? ''} onChange={v => f('seats', v)} placeholder={t('vehicles.seatsPlaceholder')} readOnly={ro} />
                  <IField label={t('vehicles.sleepingPlaces')} value={form.sleepingPlaces ?? ''} onChange={v => f('sleepingPlaces', v)} placeholder={t('vehicles.sleepingPlacesPlaceholder')} readOnly={ro} />
                </div>
                <ITextarea label={t('vehicles.notes')} value={form.notes ?? ''} onChange={v => f('notes', v)} readOnly={ro} />
              </div>
            </div>
          </div>

        </div>
      )}

      {showDirtyDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: isL2 ? '#2a2a2a' : '#fff', borderRadius: '8px', padding: '24px', maxWidth: '360px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ color: titleColor, fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Ungespeicherte Änderungen</h3>
            <p style={{ color: dirtyColor, fontSize: '14px', marginBottom: '20px' }}>Möchtest du die Änderungen speichern oder verwerfen?</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDirtyDialog(false)}
                style={{ padding: '8px 16px', fontSize: '13px', color: dirtyColor, background: 'none', border: `1px solid ${isL2 ? '#555' : '#d1d5db'}`, borderRadius: '4px', cursor: 'pointer' }}>
                Abbrechen
              </button>
              <button onClick={() => { setShowDirtyDialog(false); cancelEdit(); onBack?.() }}
                style={{ padding: '8px 16px', fontSize: '13px', color: dirtyColor, background: 'none', border: `1px solid ${isL2 ? '#555' : '#d1d5db'}`, borderRadius: '4px', cursor: 'pointer' }}>
                Verwerfen
              </button>
              <button onClick={async () => { const ok = await saveEdit(); if (ok) { setShowDirtyDialog(false); onBack?.() } }} disabled={saving}
                style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
