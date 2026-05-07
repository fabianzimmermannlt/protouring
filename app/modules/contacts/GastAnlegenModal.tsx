'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2, Trash2 } from 'lucide-react'
import { useT } from '@/app/lib/i18n/LanguageContext'
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
    firstName:        c.firstName        ?? '',
    lastName:         c.lastName         ?? '',
    email:            c.email            ?? '',
    phone:            c.phone            ?? '',
    mobile:           c.mobile           ?? '',
    function1:        c.function1        ?? '',
    function2:        c.function2        ?? '',
    function3:        c.function3        ?? '',
    specification:    c.specification    ?? '',
    address:          c.address          ?? '',
    postalCode:       c.postalCode       ?? '',
    residence:        c.residence        ?? '',
    birthDate:        c.birthDate        ?? '',
    gender:           c.gender           ?? '',
    pronouns:         c.pronouns         ?? '',
    birthPlace:       c.birthPlace       ?? '',
    nationality:      c.nationality      ?? '',
    idNumber:         c.idNumber         ?? '',
    socialSecurity:   c.socialSecurity   ?? '',
    diet:             c.diet             ?? '',
    allergies:        c.allergies        ?? '',
    glutenFree:       c.glutenFree       ?? false,
    lactoseFree:      c.lactoseFree      ?? false,
    notes:            c.notes            ?? '',
    emergencyContact: c.emergencyContact ?? '',
    emergencyPhone:   c.emergencyPhone   ?? '',
    shirtSize:        c.shirtSize        ?? '',
    hoodieSize:       c.hoodieSize       ?? '',
    pantsSize:        c.pantsSize        ?? '',
    shoeSize:         c.shoeSize         ?? '',
    hotelInfo:        c.hotelInfo        ?? '',
    hotelAlias:       c.hotelAlias       ?? '',
    languages:        c.languages        ?? '',
    driversLicense:   c.driversLicense   ?? '',
    railcard:         c.railcard         ?? '',
    frequentFlyer:    c.frequentFlyer    ?? '',
    hourlyRate:       c.hourlyRate       ?? 0,
    dailyRate:        c.dailyRate        ?? 0,
    bankAccount:      c.bankAccount      ?? '',
    bankIban:         c.bankIban         ?? '',
    bankBic:          c.bankBic          ?? '',
    taxId:            c.taxId            ?? '',
    taxNumber:        c.taxNumber        ?? '',
    vatId:            c.vatId            ?? '',
    website:          c.website          ?? '',
  }
}

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <div className="pt-4 pb-1 border-b border-gray-700">
    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{children}</span>
  </div>
)

export default function GastAnlegenModal({
  onClose, onAdded, onUpdated, onDeleted, contact,
}: GastAnlegenModalProps) {
  const t = useT()
  const isEdit = !!contact
  const [form, setForm] = useState(isEdit ? contactToForm(contact!) : emptyForm())
  const [catalog, setCatalog] = useState<FunctionCatalogGroup[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getFunctionCatalog().then(setCatalog).catch(() => setCatalog([]))
    containerRef.current?.scrollTo(0, 0)
  }, [])

  const set = <K extends keyof ReturnType<typeof emptyForm>>(field: K, value: ReturnType<typeof emptyForm>[K]) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!form.firstName.trim() && !form.lastName.trim()) {
      setError(t('contacts.error.nameRequired'))
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
      setError(e instanceof Error ? e.message : t('contacts.error.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!contact) return
    if (!confirm(t('contacts.confirm.deleteContact').replace('{name}', `${contact.firstName} ${contact.lastName}`))) return
    setDeleting(true)
    try {
      await deleteContact(String(contact.id))
      onDeleted?.(String(contact.id))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('contacts.error.deleteError'))
      setDeleting(false)
    }
  }

  const FunctionSelect = ({ field, label }: { field: 'function1' | 'function2' | 'function3'; label: string }) => (
    <div>
      <label className="form-label">{label}</label>
      <select className="form-input" value={form[field]} onChange={e => set(field, e.target.value)}>
        <option value="">{t('general.none')}</option>
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
      <div ref={containerRef} className="modal-container" style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? `${contact!.firstName} ${contact!.lastName}` : t('contacts.modal.createManualContact')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="modal-body space-y-4">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>
          )}

          {/* ── BASIS ── */}
          <SectionHeading>{t('contacts.section.basic')}</SectionHeading>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">{t('profile.firstName')}</label>
              <input autoFocus type="text" className="form-input" value={form.firstName}
                onChange={e => set('firstName', e.target.value)} placeholder={t('profile.firstName')} />
            </div>
            <div>
              <label className="form-label">{t('profile.lastName')}</label>
              <input type="text" className="form-input" value={form.lastName}
                onChange={e => set('lastName', e.target.value)} placeholder={t('profile.lastName')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">{t('profile.email')}</label>
              <input type="email" className="form-input" value={form.email}
                onChange={e => set('email', e.target.value)} placeholder="email@beispiel.de" />
            </div>
            <div>
              <label className="form-label">{t('contacts.form.website')}</label>
              <input type="text" className="form-input" value={form.website}
                onChange={e => set('website', e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">{t('profile.phone')}</label>
              <input type="tel" className="form-input" value={form.phone}
                onChange={e => set('phone', e.target.value)} placeholder="+49 …" />
            </div>
            <div>
              <label className="form-label">{t('contacts.form.mobile')}</label>
              <input type="tel" className="form-input" value={form.mobile}
                onChange={e => set('mobile', e.target.value)} placeholder="+49 …" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FunctionSelect field="function1" label={t('contacts.form.function1')} />
            <FunctionSelect field="function2" label={t('contacts.form.function2')} />
            <FunctionSelect field="function3" label={t('contacts.form.function3')} />
          </div>
          <div>
            <label className="form-label">{t('contacts.form.specification')}</label>
            <input type="text" className="form-input" value={form.specification}
              onChange={e => set('specification', e.target.value)}
              placeholder={t('contacts.form.specificationPlaceholder')} />
          </div>
          <div>
            <label className="form-label">{t('contacts.form.specialNotes')}</label>
            <input type="text" className="form-input" value={form.notes}
              onChange={e => set('notes', e.target.value)} />
          </div>
          <div className="flex items-center gap-2 opacity-40 cursor-not-allowed select-none">
            <input type="checkbox" checked={false} disabled className="rounded" />
            <span className="text-sm text-gray-400">{t('contacts.form.crewToolActive')}</span>
          </div>

          {/* ── ADRESSE & PROFIL ── */}
          <SectionHeading>{t('contacts.section.addressProfile')}</SectionHeading>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label">{t('contacts.form.street')}</label>
              <input type="text" className="form-input" value={form.address}
                onChange={e => set('address', e.target.value)} />
            </div>
            <div>
              <label className="form-label">{t('profile.postalCode')}</label>
              <input type="text" className="form-input" value={form.postalCode}
                onChange={e => set('postalCode', e.target.value)} />
            </div>
            <div>
              <label className="form-label">{t('contacts.form.city')}</label>
              <input type="text" className="form-input" value={form.residence}
                onChange={e => set('residence', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">{t('profile.birthDate')}</label>
              <input type="date" className="form-input" value={form.birthDate}
                onChange={e => set('birthDate', e.target.value)} />
            </div>
            <div>
              <label className="form-label">{t('contacts.form.birthPlace')}</label>
              <input type="text" className="form-input" value={form.birthPlace}
                onChange={e => set('birthPlace', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label">{t('profile.gender')}</label>
              <select className="form-input" value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">–</option>
                <option value="männlich">{t('profile.gender.male')}</option>
                <option value="weiblich">{t('profile.gender.female')}</option>
                <option value="divers">{t('profile.gender.diverse')}</option>
              </select>
            </div>
            <div>
              <label className="form-label">{t('profile.pronouns')}</label>
              <input type="text" className="form-input" value={form.pronouns}
                onChange={e => set('pronouns', e.target.value)} placeholder={t('contacts.form.pronounsPlaceholder')} />
            </div>
            <div>
              <label className="form-label">{t('contacts.form.nationality')}</label>
              <input type="text" className="form-input" value={form.nationality}
                onChange={e => set('nationality', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">{t('contacts.form.idNumberFull')}</label>
              <input type="text" className="form-input" value={form.idNumber}
                onChange={e => set('idNumber', e.target.value)} />
            </div>
            <div>
              <label className="form-label">{t('contacts.form.socialSecurity')}</label>
              <input type="text" className="form-input" value={form.socialSecurity}
                onChange={e => set('socialSecurity', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">{t('contacts.form.emergencyContact')}</label>
              <input type="text" className="form-input" value={form.emergencyContact}
                onChange={e => set('emergencyContact', e.target.value)} />
            </div>
            <div>
              <label className="form-label">{t('contacts.form.emergencyPhoneFull')}</label>
              <input type="tel" className="form-input" value={form.emergencyPhone}
                onChange={e => set('emergencyPhone', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="form-label">{t('contacts.form.shirtSize')}</label>
              <input type="text" className="form-input" value={form.shirtSize}
                onChange={e => set('shirtSize', e.target.value)} placeholder="XL" />
            </div>
            <div>
              <label className="form-label">{t('contacts.form.hoodieSize')}</label>
              <input type="text" className="form-input" value={form.hoodieSize}
                onChange={e => set('hoodieSize', e.target.value)} placeholder="XL" />
            </div>
            <div>
              <label className="form-label">{t('contacts.form.pantsSize')}</label>
              <input type="text" className="form-input" value={form.pantsSize}
                onChange={e => set('pantsSize', e.target.value)} placeholder="32/32" />
            </div>
            <div>
              <label className="form-label">{t('contacts.form.shoeSizeShort')}</label>
              <input type="text" className="form-input" value={form.shoeSize}
                onChange={e => set('shoeSize', e.target.value)} placeholder="42" />
            </div>
          </div>

          {/* ── ERNÄHRUNG ── */}
          <SectionHeading>{t('profile.diet')}</SectionHeading>
          <div>
            <label className="form-label">{t('contacts.form.diet')}</label>
            <select className="form-input" value={form.diet} onChange={e => set('diet', e.target.value)}>
              <option value="">{t('general.selectOption')}</option>
              <option value="alles">{t('profile.diet.all')}</option>
              <option value="vegetarisch">{t('profile.diet.vegetarian')}</option>
              <option value="vegan">{t('profile.diet.vegan')}</option>
            </select>
          </div>
          <div>
            <label className="form-label">{t('contacts.form.allergies')}</label>
            <input type="text" className="form-input" value={form.allergies}
              onChange={e => set('allergies', e.target.value)} placeholder={t('contacts.form.allergiesPlaceholder')} />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.glutenFree}
                onChange={e => set('glutenFree', e.target.checked)} className="rounded" />
              {t('contacts.form.glutenFree')}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.lactoseFree}
                onChange={e => set('lactoseFree', e.target.checked)} className="rounded" />
              {t('contacts.form.lactoseFree')}
            </label>
          </div>

          {/* ── REISE & HOTEL ── */}
          <SectionHeading>{t('contacts.section.travelHotel')}</SectionHeading>
          <div>
            <label className="form-label">{t('contacts.form.hotelWishes')}</label>
            <input type="text" className="form-input" value={form.hotelInfo}
              onChange={e => set('hotelInfo', e.target.value)}
              placeholder={t('contacts.form.hotelWishesPlaceholder')} />
          </div>
          <div>
            <label className="form-label">{t('contacts.form.hotelAlias')}</label>
            <input type="text" className="form-input" value={form.hotelAlias}
              onChange={e => set('hotelAlias', e.target.value)} />
          </div>
          <div>
            <label className="form-label">{t('contacts.form.languages')}</label>
            <input type="text" className="form-input" value={form.languages}
              onChange={e => set('languages', e.target.value)} placeholder="DE, EN, FR" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">{t('contacts.form.driversLicense')}</label>
              <input type="text" className="form-input" value={form.driversLicense}
                onChange={e => set('driversLicense', e.target.value)} placeholder="B, BE, C …" />
            </div>
            <div>
              <label className="form-label">{t('contacts.form.railcardFull')}</label>
              <input type="text" className="form-input" value={form.railcard}
                onChange={e => set('railcard', e.target.value)} placeholder="BahnCard 50, 1. Kl." />
            </div>
          </div>
          <div>
            <label className="form-label">{t('contacts.form.frequentFlyerNumber')}</label>
            <input type="text" className="form-input" value={form.frequentFlyer}
              onChange={e => set('frequentFlyer', e.target.value)} />
          </div>

          {/* ── HONORAR & BANK ── */}
          <SectionHeading>{t('contacts.section.honorarBank')}</SectionHeading>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">{t('contacts.form.hourlyRate')}</label>
              <input type="number" className="form-input" value={form.hourlyRate || ''}
                onChange={e => set('hourlyRate', parseFloat(e.target.value) || 0)}
                placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">{t('contacts.form.dailyRate')}</label>
              <input type="number" className="form-input" value={form.dailyRate || ''}
                onChange={e => set('dailyRate', parseFloat(e.target.value) || 0)}
                placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className="form-label">{t('contacts.form.accountHolder')}</label>
            <input type="text" className="form-input" value={form.bankAccount}
              onChange={e => set('bankAccount', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">{t('contacts.form.iban')}</label>
              <input type="text" className="form-input" value={form.bankIban}
                onChange={e => set('bankIban', e.target.value)} placeholder="DE…" />
            </div>
            <div>
              <label className="form-label">{t('contacts.form.bic')}</label>
              <input type="text" className="form-input" value={form.bankBic}
                onChange={e => set('bankBic', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">{t('contacts.form.taxId')}</label>
              <input type="text" className="form-input" value={form.taxId}
                onChange={e => set('taxId', e.target.value)} />
            </div>
            <div>
              <label className="form-label">{t('contacts.form.taxNumber')}</label>
              <input type="text" className="form-input" value={form.taxNumber}
                onChange={e => set('taxNumber', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="form-label">{t('contacts.form.vatId')}</label>
            <input type="text" className="form-input" value={form.vatId}
              onChange={e => set('vatId', e.target.value)} placeholder="DE…" />
          </div>
        </div>

        <div className="modal-footer">
          <div>
            {isEdit && (
              <button onClick={handleDelete} disabled={deleting} className="btn btn-danger disabled:opacity-50">
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span className="hidden md:inline">{t('general.delete')}</span>
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">{t('general.cancel')}</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary disabled:opacity-50">
              {saving ? <><Loader2 size={13} className="animate-spin" /> {t('general.saving')}</> : isEdit ? t('general.save') : t('contacts.action.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
