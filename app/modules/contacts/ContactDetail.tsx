'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, AlertCircle, Save, Loader2, User, Phone, Briefcase, Globe, Utensils, Shirt, CreditCard, FileText, Mail } from 'lucide-react'
import { useT } from '@/app/lib/i18n/LanguageContext'
import {
  isEditorRole, getEffectiveRole, ROLE_LABELS,
  getContact, updateContact, getActiveFunctions,
  type Contact, type ContactFormData, type TenantRole,
} from '@/lib/api-client'

// ── Shared helpers ────────────────────────────────────────────────────────────

function KV({ label, value }: { label: string; value?: string | number | boolean }) {
  if (value === undefined || value === null || value === '' || value === false) return null
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 text-sm py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-400 font-medium text-xs uppercase tracking-wide leading-5">{label}</span>
      <span className="text-gray-800">{value === true ? 'Ja' : String(value)}</span>
    </div>
  )
}

function IField({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 bg-white" />
    </div>
  )
}

function ISelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 bg-white">
        <option value="">– keine –</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function ITextarea({ label, value, onChange, rows = 2, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 bg-white resize-none" />
    </div>
  )
}

function ICheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 py-0.5">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
      {label}
    </label>
  )
}

function SaveBar({ onSave, onCancel, saving, error, t }: {
  onSave: () => void; onCancel: () => void; saving: boolean; error?: string; t: ReturnType<typeof useT>
}) {
  return (
    <div className="pt-2 border-t border-gray-100 mt-2">
      {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">{t('general.cancel')}</button>
        <button onClick={onSave} disabled={saving}
          className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {t('general.save')}
        </button>
      </div>
    </div>
  )
}

const SKELETON = (
  <div className="space-y-2">
    {[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}
  </div>
)

const EMPTY = (msg?: string) => (
  <p className="text-sm text-gray-400 py-2">{msg}</p>
)

const GENDER_OPTIONS = [
  { value: 'männlich', label: 'Männlich' },
  { value: 'weiblich', label: 'Weiblich' },
  { value: 'divers', label: 'Divers' },
  { value: 'keine_angabe', label: 'Keine Angabe' },
]

const DIET_OPTIONS = [
  { value: 'alles', label: 'Alles' },
  { value: 'vegetarisch', label: 'Vegetarisch' },
  { value: 'vegan', label: 'Vegan' },
]

// ── Main ──────────────────────────────────────────────────────────────────────

type Section = 'persoenlich' | 'kontakt' | 'beruflich' | 'reise' | 'ernaehrung' | 'kleider' | 'finanzen' | 'bemerkung'

export function ContactDetailContent({ contactId, onInvite }: { contactId: string; onInvite?: (contact: Contact) => void }) {
  const t = useT()
  const isEditor = isEditorRole(getEffectiveRole())

  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editSection, setEditSection] = useState<Section | null>(null)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [activeFunctions, setActiveFunctions] = useState<{ name: string }[]>([])

  useEffect(() => {
    getActiveFunctions().then(setActiveFunctions).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    setEditSection(null)
    try {
      const c = await getContact(parseInt(contactId))
      setContact(c); setDraft({ ...c })
    } catch {
      setError(t('contacts.error.notFound'))
    } finally { setLoading(false) }
  }, [contactId])

  useEffect(() => { load() }, [load])

  const startEdit = (s: Section) => {
    if (contact) setDraft({ ...contact })
    setSaveError(''); setEditSection(s)
  }
  const cancelEdit = () => { if (contact) setDraft({ ...contact }); setEditSection(null); setSaveError('') }

  const saveSection = async () => {
    if (!contact) return
    setSaving(true); setSaveError('')
    try {
      const updated = await updateContact(String(contact.id), draft as unknown as ContactFormData)
      setContact(updated); setDraft({ ...updated }); setEditSection(null)
    } catch (e) {
      setSaveError((e as Error).message || t('contacts.error.saveFailed'))
    } finally { setSaving(false) }
  }

  const d = (k: keyof Contact) => String(draft[k] ?? '')
  const db = (k: keyof Contact) => Boolean(draft[k])
  const set = (k: keyof Contact, v: unknown) => setDraft(p => ({ ...p, [k]: v }))

  const bar = <SaveBar onSave={saveSection} onCancel={cancelEdit} saving={saving} error={saveError} t={t} />

  const editBtn = (s: Section) =>
    isEditor && contact && editSection !== s
      ? <button onClick={() => startEdit(s)} className="text-gray-400 hover:text-blue-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
      : null

  if (error) return (
    <div className="module-content">
      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        <AlertCircle className="w-4 h-4 shrink-0" />{error}
      </div>
    </div>
  )

  const role = contact?.tenantRole
    ? (ROLE_LABELS[contact.tenantRole as TenantRole] ?? contact.tenantRole)
    : contact?.accessRights

  const funcOpts = (cur: string) => {
    const activeNames = new Set(activeFunctions.map(f => f.name))
    return [
      ...(cur && !activeNames.has(cur) ? [{ value: cur, label: `${cur} ⚠ (deaktiviert)` }] : []),
      ...activeFunctions.map(f => ({ value: f.name, label: f.name })),
    ]
  }

  return (
    <div className="module-content">

      {/* Name-Header */}
      {(loading || contact) && (
        <div className="mb-3">
          {loading
            ? <div className="h-6 w-48 bg-gray-100 animate-pulse rounded mb-1" />
            : <>
                <h1 className="text-xl font-semibold text-gray-900">
                  {contact!.firstName} {contact!.lastName}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  {[contact!.function1, contact!.function2, contact!.function3].filter(Boolean).length > 0 && (
                    <p className="text-sm text-gray-500">
                      {[contact!.function1, contact!.function2, contact!.function3].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {role && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{role}</span>}
                  {contact!.invitePending && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{t('contacts.badge.invitationPending')}</span>}
                  {contact!.contactType === 'artist' && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{t('contacts.badge.artist')}</span>}
                  {contact!.contactType === 'guest' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t('contacts.badge.manual')}</span>}
                  {/* Einladen-Button: für Guest + Artist ohne Account, nur für Editors */}
                  {isEditor && onInvite && !contact!.userId && (contact!.contactType === 'guest' || contact!.contactType === 'artist') && (
                    <button
                      onClick={() => onInvite(contact!)}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      <Mail className="w-3 h-3" />
                      {contact!.invitePending ? t('contacts.action.renewLink') : t('contacts.action.invite')}
                    </button>
                  )}
                </div>
              </>
          }
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── 1. Persönliche Daten ── */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><User className="w-3.5 h-3.5 inline mr-1" />{t('profile.personalData')}</span>
            {editBtn('persoenlich')}
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : editSection === 'persoenlich' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('profile.firstName')} value={d('firstName')} onChange={v => set('firstName', v)} />
                  <IField label={t('profile.lastName')} value={d('lastName')} onChange={v => set('lastName', v)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('profile.birthDate')} value={d('birthDate')} onChange={v => set('birthDate', v)} type="date" />
                  <IField label={t('contacts.form.birthPlace')} value={d('birthPlace')} onChange={v => set('birthPlace', v)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ISelect label={t('profile.gender')} value={d('gender')} onChange={v => set('gender', v)} options={[
                    { value: 'männlich', label: t('profile.gender.male') },
                    { value: 'weiblich', label: t('profile.gender.female') },
                    { value: 'divers', label: t('profile.gender.diverse') },
                    { value: 'keine_angabe', label: t('profile.gender.noStatement') },
                  ]} />
                  <IField label={t('profile.pronouns')} value={d('pronouns')} onChange={v => set('pronouns', v)} placeholder={t('contacts.form.pronounsPlaceholder')} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('contacts.form.nationality')} value={d('nationality')} onChange={v => set('nationality', v)} />
                  <IField label={t('contacts.form.idNumber')} value={d('idNumber')} onChange={v => set('idNumber', v)} />
                </div>
                {bar}
              </div>
            ) : contact ? (
              <>
                <KV label={t('profile.firstName')} value={contact.firstName} />
                <KV label={t('profile.lastName')} value={contact.lastName} />
                <KV label={t('profile.birthDate')} value={contact.birthDate} />
                <KV label={t('contacts.form.birthPlace')} value={contact.birthPlace} />
                <KV label={t('profile.gender')} value={contact.gender} />
                <KV label={t('profile.pronouns')} value={contact.pronouns} />
                <KV label={t('contacts.form.nationality')} value={contact.nationality} />
                <KV label={t('contacts.form.idNumber')} value={contact.idNumber} />
                {!contact.birthDate && !contact.gender && !contact.nationality && !contact.idNumber && EMPTY(t('contacts.empty.noInfo'))}
              </>
            ) : null}
          </div>
        </div>

        {/* ── 2. Kontaktdaten ── */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Phone className="w-3.5 h-3.5 inline mr-1" />{t('profile.contactData')}</span>
            {editBtn('kontakt')}
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : editSection === 'kontakt' ? (
              <div className="space-y-2">
                {contact?.userId
                  ? (
                    <div>
                      <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{t('profile.email')}</label>
                      <input type="email" value={d('email')} readOnly
                        className="w-full text-sm border border-gray-100 rounded px-2 py-1 bg-gray-50 text-gray-400 cursor-not-allowed"
                        title={t('contacts.form.emailReadOnlyHint')} />
                    </div>
                  ) : (
                    <IField label={t('profile.email')} value={d('email')} onChange={v => set('email', v)} type="email" />
                  )
                }
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('profile.phone')} value={d('phone')} onChange={v => set('phone', v)} type="tel" />
                  <IField label={t('contacts.form.mobile')} value={d('mobile')} onChange={v => set('mobile', v)} type="tel" />
                </div>
                <IField label={t('contacts.form.website')} value={d('website')} onChange={v => set('website', v)} />
                <IField label={t('contacts.form.street')} value={d('address')} onChange={v => set('address', v)} />
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <IField label={t('profile.postalCode')} value={d('postalCode')} onChange={v => set('postalCode', v)} placeholder="12345" />
                  <IField label={t('profile.residence')} value={d('residence')} onChange={v => set('residence', v)} />
                </div>
                {bar}
              </div>
            ) : contact ? (
              <>
                <KV label={t('profile.email')} value={contact.email} />
                <KV label={t('profile.phone')} value={contact.phone} />
                <KV label={t('contacts.form.mobile')} value={contact.mobile} />
                <KV label={t('contacts.form.website')} value={contact.website} />
                <KV label={t('contacts.form.street')} value={contact.address} />
                <KV label={t('profile.postalCode')} value={contact.postalCode} />
                <KV label={t('profile.residence')} value={contact.residence} />
                {!contact.email && !contact.phone && !contact.mobile && !contact.address && EMPTY(t('contacts.empty.noInfo'))}
              </>
            ) : null}
          </div>
        </div>

        {/* ── 3. Berufliche Daten ── */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Briefcase className="w-3.5 h-3.5 inline mr-1" />{t('profile.professionalData')}</span>
            {editBtn('beruflich')}
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : editSection === 'beruflich' ? (
              <div className="space-y-2">
                {(['function1', 'function2', 'function3'] as const).map((field, i) => (
                  <ISelect key={field} label={`${i + 1}. ${t('contacts.form.function')}`} value={d(field)} onChange={v => set(field, v)} options={funcOpts(d(field))} />
                ))}
                <IField label={t('contacts.form.specification')} value={d('specification')} onChange={v => set('specification', v)} placeholder={t('contacts.form.specificationPlaceholder')} />
                <IField label={t('contacts.form.languages')} value={d('languages')} onChange={v => set('languages', v)} placeholder="Deutsch, Englisch…" />
                {bar}
              </div>
            ) : contact ? (
              <>
                <KV label={`1. ${t('contacts.form.function')}`} value={contact.function1} />
                <KV label={`2. ${t('contacts.form.function')}`} value={contact.function2} />
                <KV label={`3. ${t('contacts.form.function')}`} value={contact.function3} />
                <KV label={t('contacts.form.specification')} value={contact.specification} />
                <KV label={t('contacts.form.languages')} value={contact.languages} />
                {!contact.function1 && !contact.specification && !contact.languages && EMPTY(t('contacts.empty.noInfo'))}
              </>
            ) : null}
          </div>
        </div>

        {/* ── 4. Reisedaten ── */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Globe className="w-3.5 h-3.5 inline mr-1" />{t('profile.travelData')}</span>
            {editBtn('reise')}
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : editSection === 'reise' ? (
              <div className="space-y-2">
                <IField label={t('contacts.form.driversLicense')} value={d('driversLicense')} onChange={v => set('driversLicense', v)} placeholder="B, BE, C…" />
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('contacts.form.railcard')} value={d('railcard')} onChange={v => set('railcard', v)} placeholder="25, 50, 100…" />
                  <IField label={t('contacts.form.frequentFlyer')} value={d('frequentFlyer')} onChange={v => set('frequentFlyer', v)} />
                </div>
                <IField label={t('contacts.form.hotelAlias')} value={d('hotelAlias')} onChange={v => set('hotelAlias', v)} placeholder={t('contacts.form.hotelAliasPlaceholder')} />
                <ITextarea label={t('contacts.form.hotelWishes')} value={d('hotelInfo')} onChange={v => set('hotelInfo', v)} placeholder={t('contacts.form.hotelWishesPlaceholder')} />
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('contacts.form.emergencyContact')} value={d('emergencyContact')} onChange={v => set('emergencyContact', v)} />
                  <IField label={t('contacts.form.emergencyPhone')} value={d('emergencyPhone')} onChange={v => set('emergencyPhone', v)} type="tel" />
                </div>
                {bar}
              </div>
            ) : contact ? (
              <>
                <KV label={t('contacts.form.driversLicense')} value={contact.driversLicense} />
                <KV label={t('contacts.form.railcard')} value={contact.railcard} />
                <KV label={t('contacts.form.frequentFlyer')} value={contact.frequentFlyer} />
                <KV label={t('contacts.form.hotelAlias')} value={contact.hotelAlias} />
                <KV label={t('contacts.form.hotelWishes')} value={contact.hotelInfo} />
                <KV label={t('contacts.form.emergencyContact')} value={contact.emergencyContact} />
                <KV label={t('contacts.form.emergencyPhone')} value={contact.emergencyPhone} />
                {!contact.driversLicense && !contact.railcard && !contact.frequentFlyer && !contact.hotelAlias && !contact.emergencyContact && EMPTY(t('contacts.empty.noInfo'))}
              </>
            ) : null}
          </div>
        </div>

        {/* ── 5. Ernährung ── */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Utensils className="w-3.5 h-3.5 inline mr-1" />{t('profile.diet')}</span>
            {editBtn('ernaehrung')}
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : editSection === 'ernaehrung' ? (
              <div className="space-y-2">
                <ISelect label={t('contacts.form.diet')} value={d('diet')} onChange={v => set('diet', v)} options={[
                  { value: 'alles', label: t('profile.diet.all') },
                  { value: 'vegetarisch', label: t('profile.diet.vegetarian') },
                  { value: 'vegan', label: t('profile.diet.vegan') },
                ]} />
                <IField label={t('contacts.form.allergies')} value={d('allergies')} onChange={v => set('allergies', v)} placeholder="z.B. Nüsse, Fisch…" />
                <div className="flex gap-4 pt-1">
                  <ICheckbox label={t('contacts.form.glutenFree')} checked={db('glutenFree')} onChange={v => set('glutenFree', v)} />
                  <ICheckbox label={t('contacts.form.lactoseFree')} checked={db('lactoseFree')} onChange={v => set('lactoseFree', v)} />
                </div>
                {bar}
              </div>
            ) : contact ? (
              <>
                <KV label={t('contacts.form.diet')} value={contact.diet} />
                <KV label={t('contacts.form.allergies')} value={contact.allergies} />
                {contact.glutenFree && <KV label={t('contacts.form.glutenFree')} value={true} />}
                {contact.lactoseFree && <KV label={t('contacts.form.lactoseFree')} value={true} />}
                {!contact.diet && !contact.allergies && !contact.glutenFree && !contact.lactoseFree && EMPTY(t('contacts.empty.noInfo'))}
              </>
            ) : null}
          </div>
        </div>

        {/* ── 6. Kleidergrößen ── */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Shirt className="w-3.5 h-3.5 inline mr-1" />{t('profile.clothing')}</span>
            {editBtn('kleider')}
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : editSection === 'kleider' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('contacts.form.shirtSize')} value={d('shirtSize')} onChange={v => set('shirtSize', v)} placeholder="S, M, L…" />
                  <IField label={t('contacts.form.hoodieSize')} value={d('hoodieSize')} onChange={v => set('hoodieSize', v)} placeholder="S, M, L…" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('contacts.form.pantsLabel')} value={d('pantsSize')} onChange={v => set('pantsSize', v)} placeholder="32/32…" />
                  <IField label={t('contacts.form.shoeSize')} value={d('shoeSize')} onChange={v => set('shoeSize', v)} placeholder="42, 43…" />
                </div>
                {bar}
              </div>
            ) : contact ? (
              <>
                <KV label={t('contacts.form.shirtSize')} value={contact.shirtSize} />
                <KV label={t('contacts.form.hoodieSize')} value={contact.hoodieSize} />
                <KV label={t('contacts.form.pantsSize')} value={contact.pantsSize} />
                <KV label={t('contacts.form.shoeSize')} value={contact.shoeSize} />
                {!contact.shirtSize && !contact.hoodieSize && !contact.pantsSize && !contact.shoeSize && EMPTY(t('contacts.empty.noInfo'))}
              </>
            ) : null}
          </div>
        </div>

        {/* ── 7. Finanzen ── */}
        <div className="pt-card md:col-span-2">
          <div className="pt-card-header">
            <span className="pt-card-title"><CreditCard className="w-3.5 h-3.5 inline mr-1" />{t('profile.financial')}</span>
            {editBtn('finanzen')}
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : editSection === 'finanzen' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <IField label={t('contacts.form.accountHolder')} value={d('bankAccount')} onChange={v => set('bankAccount', v)} />
                  <IField label={t('contacts.form.iban')} value={d('bankIban')} onChange={v => set('bankIban', v)} />
                  <IField label={t('contacts.form.bic')} value={d('bankBic')} onChange={v => set('bankBic', v)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <IField label={t('contacts.form.taxId')} value={d('taxId')} onChange={v => set('taxId', v)} />
                  <IField label={t('contacts.form.taxNumber')} value={d('taxNumber')} onChange={v => set('taxNumber', v)} />
                  <IField label={t('contacts.form.vatId')} value={d('vatId')} onChange={v => set('vatId', v)} />
                </div>
                {bar}
              </div>
            ) : contact ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <KV label={t('contacts.form.accountHolder')} value={contact.bankAccount} />
                  <KV label={t('contacts.form.iban')} value={contact.bankIban} />
                  <KV label={t('contacts.form.bic')} value={contact.bankBic} />
                </div>
                <div>
                  <KV label={t('contacts.form.taxId')} value={contact.taxId} />
                  <KV label={t('contacts.form.taxNumber')} value={contact.taxNumber} />
                  <KV label={t('contacts.form.vatId')} value={contact.vatId} />
                </div>
                {!contact.bankAccount && !contact.bankIban && !contact.taxId && !contact.taxNumber && (
                  <div className="md:col-span-2">{EMPTY(t('contacts.empty.noInfo'))}</div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── 8. Bemerkung ── */}
        <div className="pt-card md:col-span-2">
          <div className="pt-card-header">
            <span className="pt-card-title"><FileText className="w-3.5 h-3.5 inline mr-1" />{t('contacts.form.notes')}</span>
            {editBtn('bemerkung')}
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : editSection === 'bemerkung' ? (
              <div className="space-y-2">
                <ITextarea label={t('contacts.form.notesField')} value={d('notes')} onChange={v => set('notes', v)} rows={4} />
                {bar}
              </div>
            ) : contact ? (
              <>
                {contact.notes
                  ? <p className="text-sm text-gray-800 whitespace-pre-wrap">{contact.notes}</p>
                  : EMPTY()}
              </>
            ) : null}
          </div>
        </div>

      </div>
    </div>
  )
}
