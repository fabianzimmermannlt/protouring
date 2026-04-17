'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import {
  createGuestContact,
  updateContact,
  deleteContact,
  getFunctionCatalog,
  type Contact,
  type FunctionCatalogGroup,
} from '@/lib/api-client'

interface GastAnlegenModalProps {
  onClose: () => void
  onAdded?: (contact: Contact) => void
  onUpdated?: (contact: Contact) => void
  onDeleted?: (id: string) => void
  contact?: Contact
}

type Tab = 'basis' | 'profil' | 'ernaehrung' | 'reise' | 'honorar'

const TABS: { id: Tab; label: string }[] = [
  { id: 'basis',      label: 'Basis' },
  { id: 'profil',     label: 'Profil' },
  { id: 'ernaehrung', label: 'Ernährung' },
  { id: 'reise',      label: 'Reise & Hotel' },
  { id: 'honorar',    label: 'Honorar' },
]

function emptyForm() {
  return {
    firstName: '', lastName: '', email: '', phone: '', mobile: '',
    function1: '', function2: '', function3: '', specification: '',
    address: '', postalCode: '', residence: '',
    birthDate: '', gender: '', pronouns: '', birthPlace: '', nationality: '',
    idNumber: '', socialSecurity: '',
    diet: '', allergies: '', glutenFree: false, lactoseFree: false, notes: '',
    emergencyContact: '', emergencyPhone: '',
    shirtSize: '', hoodieSize: '', pantsSize: '', shoeSize: '',
    hotelInfo: '', hotelAlias: '',
    languages: '', driversLicense: '', railcard: '', frequentFlyer: '',
    hourlyRate: 0, dailyRate: 0,
    bankAccount: '', bankIban: '', bankBic: '',
    taxId: '', taxNumber: '', vatId: '', website: '',
  }
}

function contactToForm(c: Contact) {
  return {
    firstName:       c.firstName       ?? '',
    lastName:        c.lastName        ?? '',
    email:           c.email           ?? '',
    phone:           c.phone           ?? '',
    mobile:          c.mobile          ?? '',
    function1:       c.function1       ?? '',
    function2:       c.function2       ?? '',
    function3:       c.function3       ?? '',
    specification:   c.specification   ?? '',
    address:         c.address         ?? '',
    postalCode:      c.postalCode      ?? '',
    residence:       c.residence       ?? '',
    birthDate:       c.birthDate       ?? '',
    gender:          c.gender          ?? '',
    pronouns:        c.pronouns        ?? '',
    birthPlace:      c.birthPlace      ?? '',
    nationality:     c.nationality     ?? '',
    idNumber:        c.idNumber        ?? '',
    socialSecurity:  c.socialSecurity  ?? '',
    diet:            c.diet            ?? '',
    allergies:       c.allergies       ?? '',
    glutenFree:      c.glutenFree      ?? false,
    lactoseFree:     c.lactoseFree     ?? false,
    notes:           c.notes           ?? '',
    emergencyContact: c.emergencyContact ?? '',
    emergencyPhone:  c.emergencyPhone  ?? '',
    shirtSize:       c.shirtSize       ?? '',
    hoodieSize:      c.hoodieSize      ?? '',
    pantsSize:       c.pantsSize       ?? '',
    shoeSize:        c.shoeSize        ?? '',
    hotelInfo:       c.hotelInfo       ?? '',
    hotelAlias:      c.hotelAlias      ?? '',
    languages:       c.languages       ?? '',
    driversLicense:  c.driversLicense  ?? '',
    railcard:        c.railcard        ?? '',
    frequentFlyer:   c.frequentFlyer   ?? '',
    hourlyRate:      c.hourlyRate      ?? 0,
    dailyRate:       c.dailyRate       ?? 0,
    bankAccount:     c.bankAccount     ?? '',
    bankIban:        c.bankIban        ?? '',
    bankBic:         c.bankBic         ?? '',
    taxId:           c.taxId           ?? '',
    taxNumber:       c.taxNumber       ?? '',
    vatId:           c.vatId           ?? '',
    website:         c.website         ?? '',
  }
}

export default function GastAnlegenModal({
  onClose, onAdded, onUpdated, onDeleted, contact,
}: GastAnlegenModalProps) {
  const isEdit = !!contact
  const [form, setForm] = useState(isEdit ? contactToForm(contact!) : emptyForm())
  const [catalog, setCatalog] = useState<FunctionCatalogGroup[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('basis')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getFunctionCatalog().then(setCatalog).catch(() => setCatalog([]))
  }, [])

  const set = <K extends keyof ReturnType<typeof emptyForm>>(field: K, value: ReturnType<typeof emptyForm>[K]) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!form.firstName.trim() && !form.lastName.trim()) {
      setError('Vor- oder Nachname ist erforderlich.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        const updated = await updateContact(String(contact!.id), {
          ...form,
          accessRights: contact!.accessRights || '',
          crewToolActive: false,
        })
        onUpdated?.(updated)
      } else {
        const created = await createGuestContact({
          firstName: form.firstName, lastName: form.lastName,
          phone: form.phone, function1: form.function1,
          function2: form.function2, function3: form.function3,
          specification: form.specification, diet: form.diet,
          allergies: form.allergies, glutenFree: form.glutenFree,
          lactoseFree: form.lactoseFree, notes: form.notes,
        })
        // Sofort alle weiteren Felder speichern
        if (created.id) {
          const fullyUpdated = await updateContact(String(created.id), {
            ...form,
            accessRights: '',
            crewToolActive: false,
          })
          onAdded?.(fullyUpdated)
        } else {
          onAdded?.(created)
        }
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!contact) return
    if (!confirm(`${contact.firstName} ${contact.lastName} wirklich löschen?`)) return
    setDeleting(true)
    try {
      await deleteContact(String(contact.id))
      onDeleted?.(String(contact.id))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen')
      setDeleting(false)
    }
  }

  const FunctionSelect = ({ field, label }: { field: 'function1' | 'function2' | 'function3'; label: string }) => (
    <div>
      <label className="form-label">{label}</label>
      <select className="form-input" value={form[field]} onChange={e => set(field, e.target.value)}>
        <option value="">– keine –</option>
        {catalog.map(group => (
          <optgroup key={group.group} label={group.group}>
            {group.functions.filter(fn => fn.active).map(fn => (
              <option key={fn.name} value={fn.name}>{fn.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? `${contact!.firstName} ${contact!.lastName}` : 'Manuellen Kontakt anlegen'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 px-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-medium uppercase tracking-wide transition-colors ${
                activeTab === tab.id
                  ? 'text-white border-b-2 border-white -mb-px'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="modal-body space-y-4" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>
          )}

          {/* ── BASIS ── */}
          {activeTab === 'basis' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Vorname</label>
                  <input autoFocus type="text" className="form-input" value={form.firstName}
                    onChange={e => set('firstName', e.target.value)} placeholder="Vorname" />
                </div>
                <div>
                  <label className="form-label">Nachname</label>
                  <input type="text" className="form-input" value={form.lastName}
                    onChange={e => set('lastName', e.target.value)} placeholder="Nachname" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">E-Mail</label>
                  <input type="email" className="form-input" value={form.email}
                    onChange={e => set('email', e.target.value)} placeholder="email@beispiel.de" />
                </div>
                <div>
                  <label className="form-label">Website</label>
                  <input type="text" className="form-input" value={form.website}
                    onChange={e => set('website', e.target.value)} placeholder="https://…" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Telefon</label>
                  <input type="tel" className="form-input" value={form.phone}
                    onChange={e => set('phone', e.target.value)} placeholder="+49 …" />
                </div>
                <div>
                  <label className="form-label">Mobil</label>
                  <input type="tel" className="form-input" value={form.mobile}
                    onChange={e => set('mobile', e.target.value)} placeholder="+49 …" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FunctionSelect field="function1" label="Funktion 1" />
                <FunctionSelect field="function2" label="Funktion 2" />
                <FunctionSelect field="function3" label="Funktion 3" />
              </div>
              <div>
                <label className="form-label">Spezifikation</label>
                <input type="text" className="form-input" value={form.specification}
                  onChange={e => set('specification', e.target.value)}
                  placeholder="z.B. DiGiCo SD12, 60m Line-Array" />
              </div>
              <div>
                <label className="form-label">Besonderheiten / Notizen</label>
                <input type="text" className="form-input" value={form.notes}
                  onChange={e => set('notes', e.target.value)} />
              </div>
              {/* Crew Tool aktiv — ausgegraut */}
              <div className="flex items-center gap-2 opacity-40 cursor-not-allowed select-none pt-1">
                <input type="checkbox" checked={false} disabled className="rounded" />
                <span className="text-sm text-gray-400">Crew-Tool aktiv (nur für registrierte User)</span>
              </div>
            </>
          )}

          {/* ── PROFIL ── */}
          {activeTab === 'profil' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Adresse</label>
                  <input type="text" className="form-input" value={form.address}
                    onChange={e => set('address', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">PLZ</label>
                  <input type="text" className="form-input" value={form.postalCode}
                    onChange={e => set('postalCode', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Ort</label>
                  <input type="text" className="form-input" value={form.residence}
                    onChange={e => set('residence', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Geburtsdatum</label>
                  <input type="date" className="form-input" value={form.birthDate}
                    onChange={e => set('birthDate', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Geburtsort</label>
                  <input type="text" className="form-input" value={form.birthPlace}
                    onChange={e => set('birthPlace', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Geschlecht</label>
                  <select className="form-input" value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="">–</option>
                    <option value="männlich">Männlich</option>
                    <option value="weiblich">Weiblich</option>
                    <option value="divers">Divers</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Pronomen</label>
                  <input type="text" className="form-input" value={form.pronouns}
                    onChange={e => set('pronouns', e.target.value)} placeholder="er/ihm, sie/ihr …" />
                </div>
                <div>
                  <label className="form-label">Nationalität</label>
                  <input type="text" className="form-input" value={form.nationality}
                    onChange={e => set('nationality', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Ausweisnummer</label>
                  <input type="text" className="form-input" value={form.idNumber}
                    onChange={e => set('idNumber', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Sozialversicherung</label>
                  <input type="text" className="form-input" value={form.socialSecurity}
                    onChange={e => set('socialSecurity', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Notfallkontakt</label>
                  <input type="text" className="form-input" value={form.emergencyContact}
                    onChange={e => set('emergencyContact', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Notfalltelefon</label>
                  <input type="tel" className="form-input" value={form.emergencyPhone}
                    onChange={e => set('emergencyPhone', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="form-label">Shirt</label>
                  <input type="text" className="form-input" value={form.shirtSize}
                    onChange={e => set('shirtSize', e.target.value)} placeholder="XL" />
                </div>
                <div>
                  <label className="form-label">Hoodie</label>
                  <input type="text" className="form-input" value={form.hoodieSize}
                    onChange={e => set('hoodieSize', e.target.value)} placeholder="XL" />
                </div>
                <div>
                  <label className="form-label">Hose</label>
                  <input type="text" className="form-input" value={form.pantsSize}
                    onChange={e => set('pantsSize', e.target.value)} placeholder="32/32" />
                </div>
                <div>
                  <label className="form-label">Schuhe</label>
                  <input type="text" className="form-input" value={form.shoeSize}
                    onChange={e => set('shoeSize', e.target.value)} placeholder="42" />
                </div>
              </div>
            </>
          )}

          {/* ── ERNÄHRUNG ── */}
          {activeTab === 'ernaehrung' && (
            <>
              <div>
                <label className="form-label">Ernährungsweise</label>
                <select className="form-input" value={form.diet} onChange={e => set('diet', e.target.value)}>
                  <option value="">Bitte wählen…</option>
                  <option value="alles">Alles</option>
                  <option value="vegetarisch">Vegetarisch</option>
                  <option value="vegan">Vegan</option>
                </select>
              </div>
              <div>
                <label className="form-label">Allergien</label>
                <input type="text" className="form-input" value={form.allergies}
                  onChange={e => set('allergies', e.target.value)} placeholder="z.B. Nüsse, Gluten" />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={form.glutenFree}
                    onChange={e => set('glutenFree', e.target.checked)} className="rounded" />
                  Glutenfrei
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={form.lactoseFree}
                    onChange={e => set('lactoseFree', e.target.checked)} className="rounded" />
                  Laktosefrei
                </label>
              </div>
            </>
          )}

          {/* ── REISE & HOTEL ── */}
          {activeTab === 'reise' && (
            <>
              <div>
                <label className="form-label">Hotelwünsche</label>
                <input type="text" className="form-input" value={form.hotelInfo}
                  onChange={e => set('hotelInfo', e.target.value)}
                  placeholder="z.B. ruhiges Zimmer, kein Erdgeschoss" />
              </div>
              <div>
                <label className="form-label">Hotel Deckname</label>
                <input type="text" className="form-input" value={form.hotelAlias}
                  onChange={e => set('hotelAlias', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Sprachen</label>
                <input type="text" className="form-input" value={form.languages}
                  onChange={e => set('languages', e.target.value)} placeholder="DE, EN, FR" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Führerschein</label>
                  <input type="text" className="form-input" value={form.driversLicense}
                    onChange={e => set('driversLicense', e.target.value)} placeholder="B, BE, C …" />
                </div>
                <div>
                  <label className="form-label">Bahnkarte</label>
                  <input type="text" className="form-input" value={form.railcard}
                    onChange={e => set('railcard', e.target.value)} placeholder="BahnCard 50, 1. Kl." />
                </div>
              </div>
              <div>
                <label className="form-label">Vielfliegernummer</label>
                <input type="text" className="form-input" value={form.frequentFlyer}
                  onChange={e => set('frequentFlyer', e.target.value)} />
              </div>
            </>
          )}

          {/* ── HONORAR ── */}
          {activeTab === 'honorar' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Stundensatz (€)</label>
                  <input type="number" className="form-input" value={form.hourlyRate || ''}
                    onChange={e => set('hourlyRate', parseFloat(e.target.value) || 0)}
                    placeholder="0.00" />
                </div>
                <div>
                  <label className="form-label">Tagessatz (€)</label>
                  <input type="number" className="form-input" value={form.dailyRate || ''}
                    onChange={e => set('dailyRate', parseFloat(e.target.value) || 0)}
                    placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="form-label">Kontoinhaber</label>
                <input type="text" className="form-input" value={form.bankAccount}
                  onChange={e => set('bankAccount', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">IBAN</label>
                  <input type="text" className="form-input" value={form.bankIban}
                    onChange={e => set('bankIban', e.target.value)} placeholder="DE…" />
                </div>
                <div>
                  <label className="form-label">BIC</label>
                  <input type="text" className="form-input" value={form.bankBic}
                    onChange={e => set('bankBic', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Steuer-ID</label>
                  <input type="text" className="form-input" value={form.taxId}
                    onChange={e => set('taxId', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Steuernummer</label>
                  <input type="text" className="form-input" value={form.taxNumber}
                    onChange={e => set('taxNumber', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="form-label">USt-IdNr.</label>
                <input type="text" className="form-input" value={form.vatId}
                  onChange={e => set('vatId', e.target.value)} placeholder="DE…" />
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <div>
            {isEdit && (
              <button onClick={handleDelete} disabled={deleting}
                className="btn text-red-400 hover:text-red-300 hover:bg-red-900/20 border border-red-800">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : 'Löschen'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Speichern…</> : isEdit ? 'Speichern' : 'Anlegen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
