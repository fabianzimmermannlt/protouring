'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, AlertCircle, Save, Loader2, User, Phone, Briefcase, Globe, Utensils, Shirt, CreditCard, FileText } from 'lucide-react'
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

function SaveBar({ onSave, onCancel, saving, error }: {
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

const SKELETON = (
  <div className="space-y-2">
    {[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}
  </div>
)

const EMPTY = (msg = 'Keine Angaben hinterlegt.') => (
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

export function ContactDetailContent({ contactId }: { contactId: string }) {
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
      setError('Kontakt nicht gefunden')
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
      setSaveError((e as Error).message || 'Speichern fehlgeschlagen')
    } finally { setSaving(false) }
  }

  const d = (k: keyof Contact) => String(draft[k] ?? '')
  const db = (k: keyof Contact) => Boolean(draft[k])
  const set = (k: keyof Contact, v: unknown) => setDraft(p => ({ ...p, [k]: v }))

  const bar = <SaveBar onSave={saveSection} onCancel={cancelEdit} saving={saving} error={saveError} />

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
                  {contact!.invitePending && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Einladung ausstehend</span>}
                  {contact!.contactType === 'guest' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Manuell</span>}
                </div>
              </>
          }
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── 1. Persönliche Daten ── */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><User className="w-3.5 h-3.5 inline mr-1" />Persönliche Daten</span>
            {editBtn('persoenlich')}
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : editSection === 'persoenlich' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <IField label="Vorname" value={d('firstName')} onChange={v => set('firstName', v)} />
                  <IField label="Nachname" value={d('lastName')} onChange={v => set('lastName', v)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <IField label="Geburtsdatum" value={d('birthDate')} onChange={v => set('birthDate', v)} type="date" />
                  <IField label="Geburtsort" value={d('birthPlace')} onChange={v => set('birthPlace', v)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ISelect label="Geschlecht" value={d('gender')} onChange={v => set('gender', v)} options={GENDER_OPTIONS} />
                  <IField label="Pronomen" value={d('pronouns')} onChange={v => set('pronouns', v)} placeholder="er/ihm, sie/ihr…" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <IField label="Nationalität" value={d('nationality')} onChange={v => set('nationality', v)} />
                  <IField label="Ausweis-Nr." value={d('idNumber')} onChange={v => set('idNumber', v)} />
                </div>
                <IField label="Sozialversicherungs-Nr." value={d('socialSecurity')} onChange={v => set('socialSecurity', v)} />
                {bar}
              </div>
            ) : contact ? (
              <>
                <KV label="Vorname" value={contact.firstName} />
                <KV label="Nachname" value={contact.lastName} />
                <KV label="Geburtsdatum" value={contact.birthDate} />
                <KV label="Geburtsort" value={contact.birthPlace} />
                <KV label="Geschlecht" value={contact.gender} />
                <KV label="Pronomen" value={contact.pronouns} />
                <KV label="Nationalität" value={contact.nationality} />
                <KV label="Ausweis-Nr." value={contact.idNumber} />
                <KV label="Sozialversicherung" value={contact.socialSecurity} />
                {!contact.birthDate && !contact.gender && !contact.nationality && !contact.idNumber && EMPTY()}
              </>
            ) : null}
          </div>
        </div>

        {/* ── 2. Kontaktdaten ── */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Phone className="w-3.5 h-3.5 inline mr-1" />Kontaktdaten</span>
            {editBtn('kontakt')}
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : editSection === 'kontakt' ? (
              <div className="space-y-2">
                <IField label="E-Mail" value={d('email')} onChange={v => set('email', v)} type="email" />
                <div className="grid grid-cols-2 gap-2">
                  <IField label="Telefon" value={d('phone')} onChange={v => set('phone', v)} type="tel" />
                  <IField label="Mobil" value={d('mobile')} onChange={v => set('mobile', v)} type="tel" />
                </div>
                <IField label="Website" value={d('website')} onChange={v => set('website', v)} />
                <IField label="Straße" value={d('address')} onChange={v => set('address', v)} />
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <IField label="PLZ" value={d('postalCode')} onChange={v => set('postalCode', v)} placeholder="12345" />
                  <IField label="Wohnort" value={d('residence')} onChange={v => set('residence', v)} />
                </div>
                {bar}
              </div>
            ) : contact ? (
              <>
                <KV label="E-Mail" value={contact.email} />
                <KV label="Telefon" value={contact.phone} />
                <KV label="Mobil" value={contact.mobile} />
                <KV label="Website" value={contact.website} />
                <KV label="Straße" value={contact.address} />
                <KV label="PLZ" value={contact.postalCode} />
                <KV label="Wohnort" value={contact.residence} />
                {!contact.email && !contact.phone && !contact.mobile && !contact.address && EMPTY()}
              </>
            ) : null}
          </div>
        </div>

        {/* ── 3. Berufliche Daten ── */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Briefcase className="w-3.5 h-3.5 inline mr-1" />Berufliche Daten</span>
            {editBtn('beruflich')}
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : editSection === 'beruflich' ? (
              <div className="space-y-2">
                {(['function1', 'function2', 'function3'] as const).map((field, i) => (
                  <ISelect key={field} label={`${i + 1}. Funktion`} value={d(field)} onChange={v => set(field, v)} options={funcOpts(d(field))} />
                ))}
                <IField label="Spezifikation" value={d('specification')} onChange={v => set('specification', v)} placeholder="z.B. FOH, Monitor, Backline…" />
                <IField label="Sprachen" value={d('languages')} onChange={v => set('languages', v)} placeholder="Deutsch, Englisch…" />
                {bar}
              </div>
            ) : contact ? (
              <>
                <KV label="1. Funktion" value={contact.function1} />
                <KV label="2. Funktion" value={contact.function2} />
                <KV label="3. Funktion" value={contact.function3} />
                <KV label="Spezifikation" value={contact.specification} />
                <KV label="Sprachen" value={contact.languages} />
                {!contact.function1 && !contact.specification && !contact.languages && EMPTY()}
              </>
            ) : null}
          </div>
        </div>

        {/* ── 4. Reisedaten ── */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Globe className="w-3.5 h-3.5 inline mr-1" />Reisedaten</span>
            {editBtn('reise')}
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : editSection === 'reise' ? (
              <div className="space-y-2">
                <IField label="Führerschein" value={d('driversLicense')} onChange={v => set('driversLicense', v)} placeholder="B, BE, C…" />
                <div className="grid grid-cols-2 gap-2">
                  <IField label="BahnCard" value={d('railcard')} onChange={v => set('railcard', v)} placeholder="25, 50, 100…" />
                  <IField label="Vielfliegerprogramm" value={d('frequentFlyer')} onChange={v => set('frequentFlyer', v)} />
                </div>
                <IField label="Hotel Deckname" value={d('hotelAlias')} onChange={v => set('hotelAlias', v)} placeholder="Name für Buchung" />
                <ITextarea label="Hotelwünsche" value={d('hotelInfo')} onChange={v => set('hotelInfo', v)} placeholder="z.B. Einzelzimmer, EG bevorzugt…" />
                <div className="grid grid-cols-2 gap-2">
                  <IField label="Notfallkontakt" value={d('emergencyContact')} onChange={v => set('emergencyContact', v)} />
                  <IField label="Notfall-Telefon" value={d('emergencyPhone')} onChange={v => set('emergencyPhone', v)} type="tel" />
                </div>
                {bar}
              </div>
            ) : contact ? (
              <>
                <KV label="Führerschein" value={contact.driversLicense} />
                <KV label="BahnCard" value={contact.railcard} />
                <KV label="Vielfliegerprogramm" value={contact.frequentFlyer} />
                <KV label="Hotel Deckname" value={contact.hotelAlias} />
                <KV label="Hotelwünsche" value={contact.hotelInfo} />
                <KV label="Notfallkontakt" value={contact.emergencyContact} />
                <KV label="Notfall-Tel." value={contact.emergencyPhone} />
                {!contact.driversLicense && !contact.railcard && !contact.frequentFlyer && !contact.hotelAlias && !contact.emergencyContact && EMPTY()}
              </>
            ) : null}
          </div>
        </div>

        {/* ── 5. Ernährung ── */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Utensils className="w-3.5 h-3.5 inline mr-1" />Ernährung</span>
            {editBtn('ernaehrung')}
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : editSection === 'ernaehrung' ? (
              <div className="space-y-2">
                <ISelect label="Ernährungsweise" value={d('diet')} onChange={v => set('diet', v)} options={DIET_OPTIONS} />
                <IField label="Allergien" value={d('allergies')} onChange={v => set('allergies', v)} placeholder="z.B. Nüsse, Fisch…" />
                <div className="flex gap-4 pt-1">
                  <ICheckbox label="Glutenfrei" checked={db('glutenFree')} onChange={v => set('glutenFree', v)} />
                  <ICheckbox label="Laktosefrei" checked={db('lactoseFree')} onChange={v => set('lactoseFree', v)} />
                </div>
                {bar}
              </div>
            ) : contact ? (
              <>
                <KV label="Ernährung" value={contact.diet} />
                <KV label="Allergien" value={contact.allergies} />
                {contact.glutenFree && <KV label="Glutenfrei" value={true} />}
                {contact.lactoseFree && <KV label="Laktosefrei" value={true} />}
                {!contact.diet && !contact.allergies && !contact.glutenFree && !contact.lactoseFree && EMPTY()}
              </>
            ) : null}
          </div>
        </div>

        {/* ── 6. Kleidergrößen ── */}
        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Shirt className="w-3.5 h-3.5 inline mr-1" />Kleidergrößen</span>
            {editBtn('kleider')}
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : editSection === 'kleider' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <IField label="T-Shirt" value={d('shirtSize')} onChange={v => set('shirtSize', v)} placeholder="S, M, L…" />
                  <IField label="Hoodie" value={d('hoodieSize')} onChange={v => set('hoodieSize', v)} placeholder="S, M, L…" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <IField label="Hose (W/L)" value={d('pantsSize')} onChange={v => set('pantsSize', v)} placeholder="32/32…" />
                  <IField label="Schuhgröße" value={d('shoeSize')} onChange={v => set('shoeSize', v)} placeholder="42, 43…" />
                </div>
                {bar}
              </div>
            ) : contact ? (
              <>
                <KV label="T-Shirt" value={contact.shirtSize} />
                <KV label="Hoodie" value={contact.hoodieSize} />
                <KV label="Hose" value={contact.pantsSize} />
                <KV label="Schuhgröße" value={contact.shoeSize} />
                {!contact.shirtSize && !contact.hoodieSize && !contact.pantsSize && !contact.shoeSize && EMPTY()}
              </>
            ) : null}
          </div>
        </div>

        {/* ── 7. Finanzen ── */}
        <div className="pt-card md:col-span-2">
          <div className="pt-card-header">
            <span className="pt-card-title"><CreditCard className="w-3.5 h-3.5 inline mr-1" />Finanzen</span>
            {editBtn('finanzen')}
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : editSection === 'finanzen' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <IField label="Kontoinhaber" value={d('bankAccount')} onChange={v => set('bankAccount', v)} />
                  <IField label="IBAN" value={d('bankIban')} onChange={v => set('bankIban', v)} />
                  <IField label="BIC" value={d('bankBic')} onChange={v => set('bankBic', v)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <IField label="Steuer-ID" value={d('taxId')} onChange={v => set('taxId', v)} />
                  <IField label="Steuernummer" value={d('taxNumber')} onChange={v => set('taxNumber', v)} />
                  <IField label="USt-IdNr." value={d('vatId')} onChange={v => set('vatId', v)} />
                </div>
                {bar}
              </div>
            ) : contact ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <KV label="Kontoinhaber" value={contact.bankAccount} />
                  <KV label="IBAN" value={contact.bankIban} />
                  <KV label="BIC" value={contact.bankBic} />
                </div>
                <div>
                  <KV label="Steuer-ID" value={contact.taxId} />
                  <KV label="Steuernummer" value={contact.taxNumber} />
                  <KV label="USt-IdNr." value={contact.vatId} />
                </div>
                {!contact.bankAccount && !contact.bankIban && !contact.taxId && !contact.taxNumber && (
                  <div className="md:col-span-2">{EMPTY()}</div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── 8. Bemerkung ── */}
        <div className="pt-card md:col-span-2">
          <div className="pt-card-header">
            <span className="pt-card-title"><FileText className="w-3.5 h-3.5 inline mr-1" />Bemerkung</span>
            {editBtn('bemerkung')}
          </div>
          <div className="pt-card-body">
            {loading ? SKELETON : editSection === 'bemerkung' ? (
              <div className="space-y-2">
                <ITextarea label="Notizen" value={d('notes')} onChange={v => set('notes', v)} rows={4} />
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
