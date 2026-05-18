'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertCircle, Save, Loader2, Building2, MapPin, Phone, X, ArrowLeft } from 'lucide-react'
import {
  isEditorRole, getEffectiveRole,
  getPartner, updatePartner, type Partner, type PartnerFormData,
} from '@/lib/api-client'
import { useT } from '@/app/lib/i18n/LanguageContext'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'

const PARTNER_TYPES = [
  'Veranstaltende', 'Autovermietung', 'Trucking-Firma', 'Reisebüro', 'Technik-Lieferant',
  'Backline-Firma', 'Medien-/Videoproduktion', 'Catering-Firma', 'Sicherheits-Firma',
  'Merchandise-Dienstleister', 'Ticketing-Dienstleister', 'Support-Band', 'Booking Agentur',
  'Zulieferer Sonstiges', 'Endorser', 'Brand', 'Management', 'Studio', 'Label', 'Marketing',
]

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

function ISelect({ label, value, onChange, options, placeholder = '– bitte wählen –', readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="detail-label">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={readOnly}
        className="detail-input">
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
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

export function PartnerDetailContent({ partnerId, onNotFound, onBack, headerRight }: { partnerId: string; onNotFound?: () => void; onBack?: () => void; headerRight?: React.ReactNode }) {
  const t = useT()
  const { layout } = useLayout()
  const isL2 = layout === 'L2'
  const isEditor = isEditorRole(getEffectiveRole())

  const [partner, setPartner] = useState<Partner | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState<Record<string, string>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showDirtyDialog, setShowDirtyDialog] = useState(false)
  const originalRef = useRef<Record<string, string>>({})

  const loadPartner = useCallback(async () => {
    setLoading(true)
    try {
      const p = await getPartner(partnerId)
      setPartner(p)
      const data = p as unknown as Record<string, string>
      setForm(data)
      originalRef.current = data
      setIsDirty(false)
    } catch {
      if (onNotFound) { onNotFound(); return }
      setLoadError(t('partners.notFound'))
    } finally {
      setLoading(false)
    }
  }, [partnerId, onNotFound, t])

  useEffect(() => { loadPartner() }, [loadPartner])

  const f = (key: string, val: string) => {
    const next = { ...form, [key]: val }
    setForm(next)
    const orig = originalRef.current
    setIsDirty(Object.keys(next).some(k => next[k] !== (orig[k] ?? '')))
  }

  const cancelEdit = () => { setForm(originalRef.current); setIsDirty(false); setSaveError('') }

  const saveEdit = async (): Promise<boolean> => {
    if (!partner) return false
    setSaving(true); setSaveError('')
    try {
      const updated = await updatePartner(partnerId, form as unknown as PartnerFormData)
      setPartner(updated)
      const data = updated as unknown as Record<string, string>
      setForm(data)
      originalRef.current = data
      setIsDirty(false)
      window.dispatchEvent(new CustomEvent('partner-updated', { detail: updated }))
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

  useEffect(() => {
    ;(window as any).__pt_save = saveEdit
    return () => { ;(window as any).__pt_save = null }
  })

  const ro = !isEditor
  const titleColor = isL2 ? '#e0e0e0' : '#111827'
  const dirtyColor = isL2 ? '#b0b0b0' : '#6b7280'

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
          {loading ? '' : (form.companyName || partner?.companyName || '')}
        </h2>
        {isDirty ? (
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
        ) : headerRight ? (
          <div style={{ flexShrink: 0 }}>{headerRight}</div>
        ) : null}
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

          {/* Allgemein */}
          <div className="pt-card">
            <div className="pt-card-header">
              <span className="pt-card-title"><Building2 className="w-3.5 h-3.5 inline mr-1" />{t('partners.cardGeneral')}</span>
            </div>
            <div className="pt-card-body">
              <div className="space-y-2">
                <IField label={t('partners.company')} value={form.companyName ?? ''} onChange={v => f('companyName', v)} readOnly={ro} />
                <ISelect label={t('partners.type')} value={form.type ?? ''} onChange={v => f('type', v)} options={PARTNER_TYPES} placeholder={t('partners.selectTypeOption')} readOnly={ro} />
                <IField label={t('partners.contactPerson')} value={form.contactPerson ?? ''} onChange={v => f('contactPerson', v)} readOnly={ro} />
              </div>
            </div>
          </div>

          {/* Adresse */}
          <div className="pt-card">
            <div className="pt-card-header">
              <span className="pt-card-title"><MapPin className="w-3.5 h-3.5 inline mr-1" />{t('partners.cardAddress')}</span>
            </div>
            <div className="pt-card-body">
              <div className="space-y-2">
                <IField label={t('address.street')} value={form.street ?? ''} onChange={v => f('street', v)} readOnly={ro} />
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <IField label={t('address.postalCode')} value={form.postalCode ?? ''} onChange={v => f('postalCode', v)} readOnly={ro} />
                  <IField label={t('address.city')} value={form.city ?? ''} onChange={v => f('city', v)} readOnly={ro} />
                </div>
                <IField label={t('address.state')} value={form.state ?? ''} onChange={v => f('state', v)} readOnly={ro} />
                <IField label={t('address.country')} value={form.country ?? ''} onChange={v => f('country', v)} readOnly={ro} />
              </div>
            </div>
          </div>

          {/* Kontakt */}
          <div className="pt-card md:col-span-2">
            <div className="pt-card-header">
              <span className="pt-card-title"><Phone className="w-3.5 h-3.5 inline mr-1" />{t('partners.cardContact')}</span>
            </div>
            <div className="pt-card-body">
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('general.email')} value={form.email ?? ''} onChange={v => f('email', v)} readOnly={ro} />
                  <IField label={t('general.phone')} value={form.phone ?? ''} onChange={v => f('phone', v)} readOnly={ro} />
                </div>
                <IField label={t('partners.taxIdFull')} value={form.taxId ?? ''} onChange={v => f('taxId', v)} readOnly={ro} />
                <ITextarea label={t('partners.billingAddress')} value={form.billingAddress ?? ''} onChange={v => f('billingAddress', v)} readOnly={ro} />
                <ITextarea label={t('venues.notesTitle')} value={form.notes ?? ''} onChange={v => f('notes', v)} readOnly={ro} />
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
