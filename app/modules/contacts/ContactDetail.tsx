'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertCircle, Save, Loader2, User, Phone, Briefcase, Globe, Utensils, Shirt, CreditCard, FileText, Mail, X, ArrowLeft } from 'lucide-react'
import { useT } from '@/app/lib/i18n/LanguageContext'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'
import {
  isEditorRole, getEffectiveRole, ROLE_LABELS,
  getContact, updateContact, getActiveFunctions,
  type Contact, type ContactFormData, type TenantRole,
} from '@/lib/api-client'

function IField({ label, value, onChange, type = 'text', placeholder = '', readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="detail-label">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} readOnly={readOnly} className="detail-input" />
    </div>
  )
}

function ISelect({ label, value, onChange, options, readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; readOnly?: boolean
}) {
  return (
    <div>
      <label className="detail-label">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={readOnly}
        className="detail-input">
        <option value="">– keine –</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function ITextarea({ label, value, onChange, rows = 2, placeholder = '', readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="detail-label">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
        placeholder={placeholder} readOnly={readOnly} className="detail-input resize-none" />
    </div>
  )
}

function ICheckbox({ label, checked, onChange, readOnly = false }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; readOnly?: boolean
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700 py-0.5" style={{ cursor: readOnly ? 'default' : 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        disabled={readOnly} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
      {label}
    </label>
  )
}

const SKELETON = (
  <div className="space-y-2">
    {[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}
  </div>
)

export function ContactDetailContent({ contactId, onInvite, onBack }: { contactId: string; onInvite?: (contact: Contact) => void; onBack?: () => void }) {
  const t = useT()
  const { layout } = useLayout()
  const isL2 = layout === 'L2'
  const isEditor = isEditorRole(getEffectiveRole())

  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showDirtyDialog, setShowDirtyDialog] = useState(false)
  const [activeFunctions, setActiveFunctions] = useState<{ name: string }[]>([])
  const originalRef = useRef<Record<string, unknown>>({})

  useEffect(() => {
    getActiveFunctions().then(setActiveFunctions).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setLoadError(''); setIsDirty(false)
    try {
      const c = await getContact(parseInt(contactId))
      setContact(c)
      const data = { ...c } as Record<string, unknown>
      setDraft(data)
      originalRef.current = data
    } catch {
      setLoadError(t('contacts.error.notFound'))
    } finally { setLoading(false) }
  }, [contactId, t])

  useEffect(() => { load() }, [load])

  const checkDirty = (d: Record<string, unknown>) => {
    const orig = originalRef.current
    const allKeys = Object.keys({ ...orig, ...d })
    return allKeys.some(k => d[k] !== orig[k])
  }

  const set = (k: keyof Contact, v: unknown) => {
    const next = { ...draft, [k]: v }
    setDraft(next)
    setIsDirty(checkDirty(next))
  }

  const cancelEdit = () => {
    setDraft({ ...originalRef.current })
    setIsDirty(false)
    setSaveError('')
  }

  const saveEdit = async (): Promise<boolean> => {
    if (!contact) return false
    setSaving(true); setSaveError('')
    try {
      const updated = await updateContact(String(contact.id), draft as unknown as ContactFormData)
      setContact(updated)
      const data = { ...updated } as Record<string, unknown>
      setDraft(data)
      originalRef.current = data
      setIsDirty(false)
      window.dispatchEvent(new CustomEvent('contact-updated', { detail: updated }))
      return true
    } catch (e) {
      setSaveError((e as Error).message || t('contacts.error.saveFailed'))
      return false
    } finally { setSaving(false) }
  }

  const handleBack = () => { if (isDirty) setShowDirtyDialog(true); else onBack?.() }

  useEffect(() => {
    ;(window as any).__pt_isDirty = isDirty
    return () => { ;(window as any).__pt_isDirty = false }
  }, [isDirty])

  const d = (k: keyof Contact) => String(draft[k] ?? '')
  const db = (k: keyof Contact) => Boolean(draft[k])
  const ro = !isEditor

  const funcOpts = (cur: string) => {
    const activeNames = new Set(activeFunctions.map(f => f.name))
    return [
      ...(cur && !activeNames.has(cur) ? [{ value: cur, label: `${cur} ⚠ (deaktiviert)` }] : []),
      ...activeFunctions.map(f => ({ value: f.name, label: f.name })),
    ]
  }

  const role = contact?.tenantRole
    ? (ROLE_LABELS[contact.tenantRole as TenantRole] ?? contact.tenantRole)
    : contact?.accessRights

  const titleColor = isL2 ? '#e0e0e0' : '#111827'
  const dirtyColor = isL2 ? '#b0b0b0' : '#6b7280'

  if (loadError) return (
    <div className="module-content">
      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        <AlertCircle className="w-4 h-4 shrink-0" />{loadError}
      </div>
    </div>
  )

  return (
    <div className="module-content">

      {onBack && (
        <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Übersicht
        </button>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3" style={{ minHeight: '32px', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading
            ? <div className="h-6 w-48 bg-gray-100 animate-pulse rounded" />
            : <>
                <h1 style={{ color: titleColor, fontSize: '17px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {contact!.firstName} {contact!.lastName}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  {[contact!.function1, contact!.function2, contact!.function3].filter(Boolean).length > 0 && (
                    <p className="text-sm text-gray-500">{[contact!.function1, contact!.function2, contact!.function3].filter(Boolean).join(' · ')}</p>
                  )}
                  {role && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{role}</span>}
                  {contact!.invitePending && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{t('contacts.badge.invitationPending')}</span>}
                  {contact!.contactType === 'guest' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t('contacts.badge.manual')}</span>}
                  {isEditor && onInvite && !contact!.userId && (contact!.contactType === 'guest' || contact!.contactType === 'artist') && (
                    <button onClick={() => onInvite(contact!)}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                      <Mail className="w-3 h-3" />
                      {contact!.invitePending ? t('contacts.action.renewLink') : t('contacts.action.invite')}
                    </button>
                  )}
                </div>
              </>
          }
        </div>
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

      {saveError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />{saveError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* 1. Persönliche Daten */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><User className="w-3.5 h-3.5 inline mr-1" />{t('profile.personalData')}</span>
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('profile.firstName')} value={d('firstName')} onChange={v => set('firstName', v)} readOnly={ro} />
                  <IField label={t('profile.lastName')} value={d('lastName')} onChange={v => set('lastName', v)} readOnly={ro} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('profile.birthDate')} value={d('birthDate')} onChange={v => set('birthDate', v)} type="date" readOnly={ro} />
                  <IField label={t('contacts.form.birthPlace')} value={d('birthPlace')} onChange={v => set('birthPlace', v)} readOnly={ro} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ISelect label={t('profile.gender')} value={d('gender')} onChange={v => set('gender', v)} readOnly={ro} options={[
                    { value: 'männlich', label: t('profile.gender.male') },
                    { value: 'weiblich', label: t('profile.gender.female') },
                    { value: 'divers', label: t('profile.gender.diverse') },
                    { value: 'keine_angabe', label: t('profile.gender.noStatement') },
                  ]} />
                  <IField label={t('profile.pronouns')} value={d('pronouns')} onChange={v => set('pronouns', v)} placeholder={t('contacts.form.pronounsPlaceholder')} readOnly={ro} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('contacts.form.nationality')} value={d('nationality')} onChange={v => set('nationality', v)} readOnly={ro} />
                  <IField label={t('contacts.form.idNumber')} value={d('idNumber')} onChange={v => set('idNumber', v)} readOnly={ro} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Kontaktdaten */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Phone className="w-3.5 h-3.5 inline mr-1" />{t('profile.contactData')}</span>
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : (
              <div className="space-y-2">
                <IField label={t('profile.email')} value={d('email')} onChange={v => set('email', v)} type="email"
                  readOnly={ro || !!contact?.userId} />
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('profile.phone')} value={d('phone')} onChange={v => set('phone', v)} type="tel" readOnly={ro} />
                  <IField label={t('contacts.form.mobile')} value={d('mobile')} onChange={v => set('mobile', v)} type="tel" readOnly={ro} />
                </div>
                <IField label={t('contacts.form.website')} value={d('website')} onChange={v => set('website', v)} readOnly={ro} />
                <IField label={t('contacts.form.street')} value={d('address')} onChange={v => set('address', v)} readOnly={ro} />
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <IField label={t('profile.postalCode')} value={d('postalCode')} onChange={v => set('postalCode', v)} placeholder="12345" readOnly={ro} />
                  <IField label={t('profile.residence')} value={d('residence')} onChange={v => set('residence', v)} readOnly={ro} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Berufliche Daten */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Briefcase className="w-3.5 h-3.5 inline mr-1" />{t('profile.professionalData')}</span>
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : (
              <div className="space-y-2">
                {(['function1', 'function2', 'function3'] as const).map((field, i) => (
                  <ISelect key={field} label={`${i + 1}. ${t('contacts.form.function')}`} value={d(field)} onChange={v => set(field, v)} options={funcOpts(d(field))} readOnly={ro} />
                ))}
                <IField label={t('contacts.form.specification')} value={d('specification')} onChange={v => set('specification', v)} placeholder={t('contacts.form.specificationPlaceholder')} readOnly={ro} />
                <IField label={t('contacts.form.languages')} value={d('languages')} onChange={v => set('languages', v)} placeholder="Deutsch, Englisch…" readOnly={ro} />
              </div>
            )}
          </div>
        </div>

        {/* 4. Reisedaten */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Globe className="w-3.5 h-3.5 inline mr-1" />{t('profile.travelData')}</span>
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : (
              <div className="space-y-2">
                <IField label={t('contacts.form.driversLicense')} value={d('driversLicense')} onChange={v => set('driversLicense', v)} placeholder="B, BE, C…" readOnly={ro} />
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('contacts.form.railcard')} value={d('railcard')} onChange={v => set('railcard', v)} placeholder="25, 50, 100…" readOnly={ro} />
                  <IField label={t('contacts.form.frequentFlyer')} value={d('frequentFlyer')} onChange={v => set('frequentFlyer', v)} readOnly={ro} />
                </div>
                <IField label={t('contacts.form.hotelAlias')} value={d('hotelAlias')} onChange={v => set('hotelAlias', v)} placeholder={t('contacts.form.hotelAliasPlaceholder')} readOnly={ro} />
                <ITextarea label={t('contacts.form.hotelWishes')} value={d('hotelInfo')} onChange={v => set('hotelInfo', v)} placeholder={t('contacts.form.hotelWishesPlaceholder')} readOnly={ro} />
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('contacts.form.emergencyContact')} value={d('emergencyContact')} onChange={v => set('emergencyContact', v)} readOnly={ro} />
                  <IField label={t('contacts.form.emergencyPhone')} value={d('emergencyPhone')} onChange={v => set('emergencyPhone', v)} type="tel" readOnly={ro} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 5. Ernährung */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Utensils className="w-3.5 h-3.5 inline mr-1" />{t('profile.diet')}</span>
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : (
              <div className="space-y-2">
                <ISelect label={t('contacts.form.diet')} value={d('diet')} onChange={v => set('diet', v)} readOnly={ro} options={[
                  { value: 'alles', label: t('profile.diet.all') },
                  { value: 'vegetarisch', label: t('profile.diet.vegetarian') },
                  { value: 'vegan', label: t('profile.diet.vegan') },
                ]} />
                <IField label={t('contacts.form.allergies')} value={d('allergies')} onChange={v => set('allergies', v)} placeholder="z.B. Nüsse, Fisch…" readOnly={ro} />
                <div className="flex gap-4 pt-1">
                  <ICheckbox label={t('contacts.form.glutenFree')} checked={db('glutenFree')} onChange={v => set('glutenFree', v)} readOnly={ro} />
                  <ICheckbox label={t('contacts.form.lactoseFree')} checked={db('lactoseFree')} onChange={v => set('lactoseFree', v)} readOnly={ro} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 6. Kleidergrößen */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Shirt className="w-3.5 h-3.5 inline mr-1" />{t('profile.clothing')}</span>
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('contacts.form.shirtSize')} value={d('shirtSize')} onChange={v => set('shirtSize', v)} placeholder="S, M, L…" readOnly={ro} />
                  <IField label={t('contacts.form.hoodieSize')} value={d('hoodieSize')} onChange={v => set('hoodieSize', v)} placeholder="S, M, L…" readOnly={ro} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('contacts.form.pantsLabel')} value={d('pantsSize')} onChange={v => set('pantsSize', v)} placeholder="32/32…" readOnly={ro} />
                  <IField label={t('contacts.form.shoeSize')} value={d('shoeSize')} onChange={v => set('shoeSize', v)} placeholder="42, 43…" readOnly={ro} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 7. Finanzen */}
        <div className="pt-card md:col-span-2">
          <div className="pt-card-header">
            <span className="pt-card-title"><CreditCard className="w-3.5 h-3.5 inline mr-1" />{t('profile.financial')}</span>
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <IField label={t('contacts.form.accountHolder')} value={d('bankAccount')} onChange={v => set('bankAccount', v)} readOnly={ro} />
                  <IField label={t('contacts.form.iban')} value={d('bankIban')} onChange={v => set('bankIban', v)} readOnly={ro} />
                  <IField label={t('contacts.form.bic')} value={d('bankBic')} onChange={v => set('bankBic', v)} readOnly={ro} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <IField label={t('contacts.form.taxId')} value={d('taxId')} onChange={v => set('taxId', v)} readOnly={ro} />
                  <IField label={t('contacts.form.taxNumber')} value={d('taxNumber')} onChange={v => set('taxNumber', v)} readOnly={ro} />
                  <IField label={t('contacts.form.vatId')} value={d('vatId')} onChange={v => set('vatId', v)} readOnly={ro} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 8. Bemerkung */}
        <div className="pt-card md:col-span-2">
          <div className="pt-card-header">
            <span className="pt-card-title"><FileText className="w-3.5 h-3.5 inline mr-1" />{t('contacts.form.notes')}</span>
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : (
              <ITextarea label={t('contacts.form.notesField')} value={d('notes')} onChange={v => set('notes', v)} rows={4} readOnly={ro} />
            )}
          </div>
        </div>

      </div>

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
