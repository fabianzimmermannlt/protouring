'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  UserIcon,
  CreditCardIcon,
  LanguageIcon,
  MusicalNoteIcon,
  UserGroupIcon,
  PaintBrushIcon,
  BellIcon,
  UsersIcon,
  UserPlusIcon,
  CalendarDaysIcon,
  TrashIcon,
  CheckCircleIcon,
  LinkIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline'
import { Loader2, Save, X, AlertCircle } from 'lucide-react'
import FunktionenSettings from './FunktionenSettings'
import GewerkSettings from './GewerkSettings'
import ScheduleTemplatesSettings from './ScheduleTemplatesSettings'
import { useLanguage, useT } from '@/app/lib/i18n/LanguageContext'
import {
  getSettingsUsers, getMyRole, updateUserRole, removeUser, revokeInvite,
  adminSetUserEmail, adminSetUserPassword, adminToggleUserStatus,
  changePassword, getMyContact, updateMyContact, getOrCreateUserContact, updateContact,
  getTenantArtistSettings, updateTenantArtistSettings,
  getTenantBilling, updateTenantBilling,
  getUserFormat, updateUserFormat,
  getCurrentTenant, getCurrentUser, isAdminRole, getEffectiveRole, updateCurrentTenantRole,
  superadminGetUsers, superadminSetPassword, superadminDeleteUser,
  getIcalToken, regenerateIcalToken, getIcalUrl,
  getActiveFunctions,
  getPartnerTypes, createPartnerType, deletePartnerType, togglePartnerTypeVisible,
  getArtistMembers, createArtistMember, updateArtistMember, deleteArtistMember,
  ROLE_LABELS, CURRENT_USER_KEY,
  type TenantUser, type PendingInvite, type TenantRole, type ContactFormData, type Contact,
  type TenantArtistSettings, type TenantBilling, type UserFormat, type SuperadminUser,
  type PartnerType, type ArtistMember, type ArtistMemberFormData,
} from '@/lib/api-client'

import { ProfileEditor, type ProfileData } from '@/app/components/shared/ProfileEditor'
import { useSortable } from '@/app/hooks/useSortable'

export interface SettingsProps {
  activeSubTab?: string
}

export default function SettingsModule({ activeSubTab = 'profil' }: SettingsProps) {
  const t = useT()

  const renderContent = () => {
    switch (activeSubTab) {
      case 'artist':
        return <ArtistSettings />

      case 'profil':
        return <UserProfil />

      case 'permissions':
        return <UserManagement />

      case 'appearance':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <PaintBrushIcon className="w-5 h-5" />
                {t('settings.appearance.title')}
              </h3>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-600">{t('settings.appearance.placeholder')}</p>
              </div>
            </div>
          </div>
        )

      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BellIcon className="w-5 h-5" />
                {t('settings.notifications.title')}
              </h3>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-600">{t('settings.notifications.placeholder')}</p>
              </div>
            </div>
          </div>
        )

      case 'contacts':
        return <FunktionenSettings />

      case 'guestlist':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserPlusIcon className="w-5 h-5" />
                {t('settings.guestlist.title')}
              </h3>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-600">{t('settings.guestlist.placeholder')}</p>
              </div>
            </div>
          </div>
        )

      case 'daysheet':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CalendarDaysIcon className="w-5 h-5" />
                {t('settings.daysheet.title')}
              </h3>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-600">{t('settings.daysheet.placeholder')}</p>
              </div>
            </div>
          </div>
        )

      case 'vorlagen':
        return <ScheduleTemplatesSettings />

      case 'partners':
        return <PartnerTypesSettings />

      case 'gewerke':
        return <GewerkSettings />

      case 'erste-schritte':
        return <ErsteSchritte />

      case 'superadmin':
        return <SuperadminPanel />

      default:
        return (
          <div className="text-center py-8">
            <div className="text-gray-500">{t('settings.notFound')}</div>
          </div>
        )
    }
  }

  return (
    <div>
      {renderContent()}
    </div>
  )
}

// ============================================================
// ArtistSettings Component
// ============================================================

type ArtistForm = {
  company: string; firstName: string; lastName: string
  address: string; postalCode: string; city: string
  billingPhone: string; taxId: string; billingEmail: string
  language: string; timezone: string; currency: string
  displayName: string; shortCode: string; homebase: string; genre: string
  website: string; artistEmail: string; artistPhone: string
}

const ARTIST_FORM_EMPTY: ArtistForm = {
  company: '', firstName: '', lastName: '', address: '', postalCode: '', city: '',
  billingPhone: '', taxId: '', billingEmail: '',
  language: 'de-DE', timezone: 'Europe/Berlin', currency: 'EUR',
  displayName: '', shortCode: '', homebase: '', genre: '',
  website: '', artistEmail: '', artistPhone: '',
}

function ArtistSettings() {
  const t = useT()
  const [form, setFormState] = useState<ArtistForm>(ARTIST_FORM_EMPTY)
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loading, setLoading] = useState(true)
  const [subPlan] = useState('Starter')
  const [subStatus] = useState('Trial')
  const [subNextBilling] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString())
  const originalRef = useRef<ArtistForm>(ARTIST_FORM_EMPTY)

  useEffect(() => {
    Promise.all([
      getTenantArtistSettings().catch(() => null),
      getTenantBilling().catch(() => null),
      getUserFormat().catch(() => null),
    ]).then(([artist, billing, format]) => {
      const data: ArtistForm = {
        company:      billing?.company    || '',
        firstName:    billing?.firstName  || '',
        lastName:     billing?.lastName   || '',
        address:      billing?.address    || '',
        postalCode:   billing?.postalCode || '',
        city:         billing?.city       || '',
        billingPhone: billing?.phone      || '',
        taxId:        billing?.taxId      || '',
        billingEmail: billing?.email      || '',
        language:     format?.language    || 'de-DE',
        timezone:     format?.timezone    || 'Europe/Berlin',
        currency:     format?.currency    || 'EUR',
        displayName:  artist?.displayName || '',
        shortCode:    artist?.shortCode   || '',
        homebase:     artist?.homebase    || '',
        genre:        artist?.genre       || '',
        website:      artist?.website     || '',
        artistEmail:  artist?.email       || '',
        artistPhone:  artist?.phone       || '',
      }
      setFormState(data)
      originalRef.current = data
    }).finally(() => setLoading(false))
  }, [])

  const set = (k: keyof ArtistForm, v: string) => {
    const next = { ...form, [k]: v }
    setFormState(next)
    const dirty = (Object.keys(originalRef.current) as (keyof ArtistForm)[])
      .some(key => next[key] !== originalRef.current[key])
    setIsDirty(dirty)
  }

  const cancelEdit = () => {
    setFormState({ ...originalRef.current })
    setIsDirty(false)
    setSaveError('')
  }

  const saveEdit = async (): Promise<boolean> => {
    setSaving(true); setSaveError('')
    try {
      await Promise.all([
        updateTenantArtistSettings({
          displayName: form.displayName, shortCode: form.shortCode,
          homebase: form.homebase, genre: form.genre,
          email: form.artistEmail, phone: form.artistPhone,
          website: form.website, equipmentKuerzel: '',
        }),
        updateTenantBilling({
          company: form.company, firstName: form.firstName, lastName: form.lastName,
          address: form.address, postalCode: form.postalCode, city: form.city,
          phone: form.billingPhone, taxId: form.taxId, email: form.billingEmail,
        }),
        updateUserFormat({
          language: form.language, timezone: form.timezone, currency: form.currency,
        }),
      ])
      originalRef.current = { ...form }
      setIsDirty(false)
      window.dispatchEvent(new CustomEvent('artistUpdated'))
      return true
    } catch (e) {
      setSaveError((e as Error).message || t('general.error'))
      return false
    } finally { setSaving(false) }
  }

  useEffect(() => {
    ;(window as any).__pt_isDirty = isDirty
    return () => { ;(window as any).__pt_isDirty = false }
  }, [isDirty])

  useEffect(() => {
    ;(window as any).__pt_save = saveEdit
    return () => { ;(window as any).__pt_save = null }
  })

  if (loading) return (
    <div className="flex items-center gap-2 text-gray-500 text-sm py-8">
      <Loader2 className="animate-spin w-4 h-4" /> {t('general.loading')}
    </div>
  )

  return (
    <div className="module-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header + dirty state */}
      <div className="flex items-center justify-between" style={{ minHeight: '32px', gap: '12px' }}>
        <h1 style={{ color: '#e0e0e0', fontSize: '17px', fontWeight: 600 }}>Artist</h1>
        {isDirty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#b0b0b0' }}>Ungespeicherte Änderungen</span>
            <button onClick={cancelEdit}
              style={{ padding: '5px 12px', fontSize: '13px', color: '#b0b0b0', background: 'none', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}>
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
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: '#3b1515', border: '1px solid #7f1d1d', color: '#fca5a5' }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{saveError}
        </div>
      )}

      {/* 4-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Rechnungsanschrift */}
        <div className="space-y-3">
          <FPSection title={t('settings.artist.billingAddress')} />
          <FPField label={t('settings.artist.company')} value={form.company} onChange={v => set('company', v)} placeholder={t('settings.artist.companyPlaceholder')} />
          <FPField label={t('settings.artist.firstName')} value={form.firstName} onChange={v => set('firstName', v)} />
          <FPField label={t('settings.artist.lastName')} value={form.lastName} onChange={v => set('lastName', v)} />
          <FPField label={t('settings.artist.address')} value={form.address} onChange={v => set('address', v)} placeholder={t('settings.artist.addressPlaceholder')} />
          <div className="grid gap-2" style={{ gridTemplateColumns: '70px 1fr' }}>
            <FPField label={t('settings.artist.postalCode')} value={form.postalCode} onChange={v => set('postalCode', v)} placeholder="12345" />
            <FPField label={t('settings.artist.city')} value={form.city} onChange={v => set('city', v)} placeholder={t('settings.artist.cityPlaceholder')} />
          </div>
          <FPField label={t('settings.artist.phone')} value={form.billingPhone} onChange={v => set('billingPhone', v)} type="tel" placeholder={t('settings.artist.phonePlaceholder')} />
          <FPField label={t('settings.artist.taxId')} value={form.taxId} onChange={v => set('taxId', v)} placeholder="DE123456789" />
          <FPField label={t('general.email')} value={form.billingEmail} onChange={v => set('billingEmail', v)} type="email" placeholder={t('settings.artist.emailPlaceholder')} />
        </div>

        {/* Abo */}
        <div className="space-y-3">
          <FPSection title={t('settings.artist.subscription')} />
          <p className="text-sm font-medium" style={{ color: '#60a5fa' }}>{subPlan}</p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>{t('settings.artist.subscriptionStatus')}: {subStatus}</p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            {new Date(subNextBilling).toLocaleDateString('de-DE')} – {subStatus === 'Trial' ? t('settings.artist.trialEnds') : t('settings.artist.nextBilling')}
          </p>
          <div className="space-y-2 pt-1">
            <button className="w-full px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
              {t('settings.artist.upgradePlan')}
            </button>
            <button className="w-full px-2 py-1 text-xs rounded transition-colors" style={{ background: '#3a3a3a', color: '#9ca3af' }}>
              {t('settings.artist.changePayment')}
            </button>
          </div>
        </div>

        {/* Format & Region */}
        <div className="space-y-3">
          <FPSection title={t('settings.artist.formatRegion')} />
          <FPSelect label={t('settings.language.label')} value={form.language} onChange={v => set('language', v)} options={[
            { value: 'de-DE', label: 'Deutsch' },
            { value: 'en-US', label: 'English' },
          ]} />
          <FPSelect label={t('settings.artist.timezone')} value={form.timezone} onChange={v => set('timezone', v)} options={[
            { value: 'Europe/Berlin', label: 'Europe/Berlin' },
            { value: 'Europe/London', label: 'Europe/London' },
          ]} />
          <FPSelect label={t('settings.artist.currency')} value={form.currency} onChange={v => set('currency', v)} options={[
            { value: 'EUR', label: 'EUR (€)' },
            { value: 'USD', label: 'USD ($)' },
          ]} />
        </div>

        {/* Artist Info */}
        <div className="space-y-3">
          <FPSection title={t('settings.artist.information')} />
          <FPField label={t('settings.artist.displayName')} value={form.displayName} onChange={v => set('displayName', v)} placeholder={t('settings.artist.displayNamePlaceholder')} />
          <FPField label={t('settings.artist.shortCode')} value={form.shortCode} onChange={v => set('shortCode', v)} placeholder={t('settings.artist.shortCodePlaceholder')} />
          <FPField label={t('settings.artist.homebase')} value={form.homebase} onChange={v => set('homebase', v)} placeholder={t('settings.artist.homebasePlaceholder')} />
          <FPField label={t('settings.artist.genre')} value={form.genre} onChange={v => set('genre', v)} placeholder={t('settings.artist.genrePlaceholder')} />
        </div>
      </div>

      {/* Band-Mitglieder */}
      <div className="pt-6" style={{ borderTop: '1px solid #333' }}>
        <ArtistMembersSettings />
      </div>

    </div>
  )
}

// ============================================================
// UserProfil Helper Components (detail-input pattern)
// ============================================================

function FPField({ label, value, onChange, type = 'text', placeholder = '', readOnly = false }: {
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

function FPSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="detail-label">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="detail-input">
        <option value="">– keine –</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function FPTextarea({ label, value, onChange, rows = 2, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string
}) {
  return (
    <div>
      <label className="detail-label">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
        placeholder={placeholder} className="detail-input resize-none" />
    </div>
  )
}

function FPCheckbox({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#9ca3af' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="rounded border-gray-500 text-blue-600 focus:ring-blue-500" />
      {label}
    </label>
  )
}

function FPSection({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider"
      style={{ color: '#888', borderBottom: '1px solid #333', paddingBottom: '6px' }}>
      {title}
    </h3>
  )
}

// ============================================================
// UserProfil Component
// ============================================================

function UserProfil() {
  const currentUser = getCurrentUser()
  const { language, setLanguage, t } = useLanguage()
  const [currentTenant, setCurrentTenant] = useState(getCurrentTenant())

  const emptyProfile: ProfileData = {
    firstName: currentUser?.firstName || '', lastName: currentUser?.lastName || '',
    email: currentUser?.email || '', phone: '', mobile: '', address: '', postalCode: '',
    residence: '', birthDate: '', gender: '', pronouns: '', birthPlace: '', nationality: '',
    idNumber: '', taxId: '', socialSecurity: '', taxNumber: '', vatId: '',
    function1: '', function2: '', function3: '', specification: '', accessRights: '',
    diet: 'alles', glutenFree: false, lactoseFree: false, allergies: '', specialNotes: '',
    emergencyContact: '', emergencyPhone: '', shirtSize: '', hoodieSize: '', pantsSize: '',
    shoeSize: '', hotelInfo: '', hotelAlias: '', languages: '', driversLicense: '',
    railcard: '', frequentFlyer: '', bankAccount: '', bankIban: '', bankBic: '',
    personalFiles: [], crewToolActive: true,
  }

  const [form, setFormState] = useState<ProfileData>(emptyProfile)
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [profileLoading, setProfileLoading] = useState(true)
  const [activeFunctions, setActiveFunctions] = useState<{ name: string }[]>([])
  const originalRef = useRef<ProfileData>(emptyProfile)

  useEffect(() => {
    getActiveFunctions().then(setActiveFunctions).catch(() => {})
  }, [])

  useEffect(() => {
    Promise.all([
      getMyRole().catch(() => currentTenant?.role ?? ''),
      getMyContact(),
    ]).then(([freshRole, contact]) => {
      if (freshRole && freshRole !== currentTenant?.role) {
        updateCurrentTenantRole(freshRole)
        setCurrentTenant(prev => prev ? { ...prev, role: freshRole } : prev)
      }
      const roleLabel = ROLE_LABELS[freshRole as TenantRole] ?? freshRole ?? ''
      if (contact.firstName || contact.lastName) {
        const storedUser = getCurrentUser()
        if (storedUser && (storedUser.firstName !== contact.firstName || storedUser.lastName !== contact.lastName)) {
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
            ...storedUser,
            firstName: contact.firstName || storedUser.firstName,
            lastName: contact.lastName || storedUser.lastName,
          }))
        }
      }
      const data: ProfileData = {
        ...emptyProfile,
        firstName: contact.firstName || currentUser?.firstName || '',
        lastName: contact.lastName || currentUser?.lastName || '',
        email: contact.email || currentUser?.email || '',
        phone: contact.phone || '', mobile: contact.mobile || '',
        address: contact.address || '', postalCode: contact.postalCode || '',
        residence: contact.residence || '', birthDate: contact.birthDate || '',
        gender: contact.gender || '', pronouns: contact.pronouns || '',
        birthPlace: contact.birthPlace || '', nationality: contact.nationality || '',
        idNumber: contact.idNumber || '', taxId: contact.taxId || '',
        socialSecurity: contact.socialSecurity || '', taxNumber: contact.taxNumber || '',
        vatId: contact.vatId || '', function1: contact.function1 || '',
        function2: contact.function2 || '', function3: contact.function3 || '',
        specification: contact.specification || '', accessRights: roleLabel,
        diet: contact.diet || 'alles', glutenFree: Boolean(contact.glutenFree),
        lactoseFree: Boolean(contact.lactoseFree), allergies: contact.allergies || '',
        specialNotes: contact.notes || '', emergencyContact: contact.emergencyContact || '',
        emergencyPhone: contact.emergencyPhone || '', shirtSize: contact.shirtSize || '',
        hoodieSize: contact.hoodieSize || '', pantsSize: contact.pantsSize || '',
        shoeSize: contact.shoeSize || '', hotelInfo: contact.hotelInfo || '',
        hotelAlias: contact.hotelAlias || '', languages: contact.languages || '',
        driversLicense: contact.driversLicense || '', railcard: contact.railcard || '',
        frequentFlyer: contact.frequentFlyer || '', bankAccount: contact.bankAccount || '',
        bankIban: contact.bankIban || '', bankBic: contact.bankBic || '',
        personalFiles: [], crewToolActive: contact.crewToolActive !== false,
      }
      setFormState(data)
      originalRef.current = data
    }).catch(() => {}).finally(() => setProfileLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (k: keyof ProfileData, v: unknown) => {
    const next = { ...form, [k]: v }
    setFormState(next)
    const dirty = (Object.keys(originalRef.current) as (keyof ProfileData)[])
      .filter(key => key !== 'personalFiles')
      .some(key => next[key] !== originalRef.current[key])
    setIsDirty(dirty)
  }

  const cancelEdit = () => {
    setFormState({ ...originalRef.current })
    setIsDirty(false)
    setSaveError('')
  }

  const saveEdit = async (): Promise<boolean> => {
    setSaving(true); setSaveError('')
    try {
      await updateMyContact({
        firstName: form.firstName, lastName: form.lastName, function1: form.function1,
        function2: form.function2, function3: form.function3, specification: form.specification,
        accessRights: form.accessRights, email: form.email, phone: form.phone,
        mobile: form.mobile, address: form.address, postalCode: form.postalCode,
        residence: form.residence, taxId: form.taxId, website: '', birthDate: form.birthDate,
        gender: form.gender, pronouns: form.pronouns, birthPlace: form.birthPlace,
        nationality: form.nationality, idNumber: form.idNumber, socialSecurity: form.socialSecurity,
        diet: form.diet, glutenFree: form.glutenFree, lactoseFree: form.lactoseFree,
        allergies: form.allergies, emergencyContact: form.emergencyContact,
        emergencyPhone: form.emergencyPhone, shirtSize: form.shirtSize,
        hoodieSize: form.hoodieSize, pantsSize: form.pantsSize, shoeSize: form.shoeSize,
        languages: form.languages, driversLicense: form.driversLicense, railcard: form.railcard,
        frequentFlyer: form.frequentFlyer, bankAccount: form.bankAccount,
        bankIban: form.bankIban, bankBic: form.bankBic, taxNumber: form.taxNumber,
        vatId: form.vatId, notes: form.specialNotes, hotelInfo: form.hotelInfo,
        hotelAlias: form.hotelAlias, crewToolActive: form.crewToolActive,
      } as ContactFormData)
      originalRef.current = { ...form }
      setIsDirty(false)
      return true
    } catch (e) {
      setSaveError((e as Error).message || t('general.error'))
      return false
    } finally {
      setSaving(false)
    }
  }

  // Global dirty/save flags for L2 nav guard
  useEffect(() => {
    ;(window as any).__pt_isDirty = isDirty
    return () => { ;(window as any).__pt_isDirty = false }
  }, [isDirty])

  // Always-fresh save reference (no deps — runs every render)
  useEffect(() => {
    ;(window as any).__pt_save = saveEdit
    return () => { ;(window as any).__pt_save = null }
  })

  // Passwort
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [showPwForm, setShowPwForm] = useState(false)
  const pwAccordionRef = useRef<HTMLDivElement>(null)

  const handlePwChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(''); setPwSuccess(false)
    if (pwForm.next !== pwForm.confirm) { setPwError(t('settings.profile.passwordMismatch')); return }
    if (pwForm.next.length < 6) { setPwError(t('settings.profile.passwordMinLength')); return }
    setPwSaving(true)
    try {
      await changePassword(pwForm.current, pwForm.next)
      setPwSuccess(true)
      setPwForm({ current: '', next: '', confirm: '' })
      setShowPwForm(false)
    } catch (e: any) {
      setPwError(e?.message ?? t('general.error'))
    } finally { setPwSaving(false) }
  }

  const displayFirst = form.firstName || currentUser?.firstName || ''
  const displayLast = form.lastName || currentUser?.lastName || ''
  const initials = `${displayFirst[0] ?? ''}${displayLast[0] ?? ''}`.toUpperCase() || '?'

  const funcOpts = (cur: string) => {
    const activeNames = new Set(activeFunctions.map(f => f.name))
    return [
      ...(cur && !activeNames.has(cur) ? [{ value: cur, label: `${cur} ⚠ (deaktiviert)` }] : []),
      ...activeFunctions.map(f => ({ value: f.name, label: f.name })),
    ]
  }

  if (profileLoading) return (
    <div className="flex items-center gap-2 text-gray-500 text-sm py-8">
      <Loader2 className="animate-spin w-4 h-4" /> {t('general.loading')}
    </div>
  )

  return (
    <div className="module-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header: Name + dirty state */}
      <div className="flex items-center justify-between" style={{ minHeight: '32px', gap: '12px' }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg font-semibold select-none flex-shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight" style={{ color: '#e0e0e0' }}>{displayFirst} {displayLast}</p>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{form.email || currentUser?.email}</p>
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full" style={{ background: '#333', color: '#9ca3af' }}>
              {ROLE_LABELS[currentTenant?.role as TenantRole] ?? currentTenant?.role}
            </span>
          </div>
        </div>
        {isDirty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '12px', color: '#b0b0b0' }}>Ungespeicherte Änderungen</span>
            <button onClick={cancelEdit}
              style={{ padding: '5px 12px', fontSize: '13px', color: '#b0b0b0', background: 'none', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}>
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
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: '#3b1515', border: '1px solid #7f1d1d', color: '#fca5a5' }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{saveError}
        </div>
      )}

      {/* Persönliche Daten */}
      <div className="space-y-3">
        <FPSection title={t('profile.personalData')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FPField label={t('profile.firstName')} value={form.firstName} onChange={v => set('firstName', v)} />
          <FPField label={t('profile.lastName')} value={form.lastName} onChange={v => set('lastName', v)} />
          <FPField label={t('profile.birthDate')} value={form.birthDate} onChange={v => set('birthDate', v)} type="date" />
          <FPSelect label={t('profile.gender')} value={form.gender} onChange={v => set('gender', v)} options={[
            { value: 'männlich', label: t('profile.gender.male') },
            { value: 'weiblich', label: t('profile.gender.female') },
            { value: 'divers', label: t('profile.gender.diverse') },
            { value: 'keine_angabe', label: t('profile.gender.noStatement') },
          ]} />
          <FPField label={t('profile.pronouns')} value={form.pronouns} onChange={v => set('pronouns', v)} placeholder="er/ihm, sie/ihr, divers" />
        </div>
      </div>

      {/* Kontaktdaten */}
      <div className="space-y-3">
        <FPSection title={t('profile.contactData')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FPField label={t('profile.email')} value={form.email} onChange={() => {}} readOnly />
          <FPField label={t('profile.phone')} value={form.phone} onChange={v => set('phone', v)} type="tel" />
          <div className="grid gap-2" style={{ gridTemplateColumns: '80px 1fr' }}>
            <FPField label={t('profile.postalCode')} value={form.postalCode} onChange={v => set('postalCode', v)} />
            <FPField label={t('profile.residence')} value={form.residence} onChange={v => set('residence', v)} />
          </div>
          <FPField label={t('profile.address')} value={form.address} onChange={v => set('address', v)} />
        </div>
      </div>

      {/* Berufliche Daten */}
      <div className="space-y-3">
        <FPSection title={t('profile.professionalData')} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['function1', 'function2', 'function3'] as const).map((field, i) => (
            <FPSelect key={field} label={`${i + 1}. ${t('profile.function')}`}
              value={form[field]} onChange={v => set(field, v)} options={funcOpts(form[field])} />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FPField label={t('profile.specification')} value={form.specification} onChange={v => set('specification', v)} placeholder="z.B. Schlagzeug" />
          <FPField label={t('profile.languages')} value={form.languages} onChange={v => set('languages', v)} placeholder="Deutsch, Englisch, Französisch" />
        </div>
      </div>

      {/* Reisedaten */}
      <div className="space-y-3">
        <FPSection title={t('profile.travelData')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FPField label={t('profile.driversLicense')} value={form.driversLicense} onChange={v => set('driversLicense', v)} placeholder="z.B. Klasse B, Klasse C..." />
          <FPField label={t('profile.railcard')} value={form.railcard} onChange={v => set('railcard', v)} placeholder="z.B. Bahncard 25, Bahncard 50..." />
          <FPField label={t('profile.frequentFlyer')} value={form.frequentFlyer} onChange={v => set('frequentFlyer', v)} placeholder="z.B. Lufthansa Miles & More..." />
          <FPField label={t('profile.hotelAlias')} value={form.hotelAlias} onChange={v => set('hotelAlias', v)} placeholder="z.B. John Smith..." />
          <div className="md:col-span-2">
            <FPTextarea label={t('profile.hotelPreferences')} value={form.hotelInfo} onChange={v => set('hotelInfo', v)} rows={2} placeholder="z.B. Einzelzimmer bevorzugt, ruhiges Zimmer..." />
          </div>
        </div>
      </div>

      {/* Ernährung */}
      <div className="space-y-3">
        <FPSection title={t('profile.diet')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FPSelect label={t('profile.dietType')} value={form.diet} onChange={v => set('diet', v)} options={[
            { value: 'alles', label: t('profile.diet.all') },
            { value: 'vegetarisch', label: t('profile.diet.vegetarian') },
            { value: 'vegan', label: t('profile.diet.vegan') },
          ]} />
          <FPField label={t('profile.allergies')} value={form.allergies} onChange={v => set('allergies', v)} placeholder="z.B. Nüsse, Erdnüsse, Fisch..." />
          <div className="flex flex-col gap-1">
            <label className="detail-label">{t('profile.intolerances')}</label>
            <div className="flex gap-4 pt-1">
              <FPCheckbox label={t('profile.glutenFree')} checked={form.glutenFree} onChange={v => set('glutenFree', v)} />
              <FPCheckbox label={t('profile.lactoseFree')} checked={form.lactoseFree} onChange={v => set('lactoseFree', v)} />
            </div>
          </div>
          <FPField label={t('profile.specialNotes')} value={form.specialNotes} onChange={v => set('specialNotes', v)} placeholder="z.B. scharf essen, kein Koffein..." />
        </div>
      </div>

      {/* Kleidergrößen */}
      <div className="space-y-3">
        <FPSection title={t('profile.clothing')} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FPField label={t('profile.shirt')} value={form.shirtSize} onChange={v => set('shirtSize', v)} placeholder="S, M, L, XL" />
          <FPField label={t('profile.hoodie')} value={form.hoodieSize} onChange={v => set('hoodieSize', v)} placeholder="S, M, L, XL" />
          <FPField label={t('profile.pants')} value={form.pantsSize} onChange={v => set('pantsSize', v)} placeholder="32, 34, 36" />
          <FPField label={t('profile.shoes')} value={form.shoeSize} onChange={v => set('shoeSize', v)} placeholder="42, 43, 44" />
        </div>
      </div>

      {/* Crew Tool */}
      <div className="pt-2" style={{ borderTop: '1px solid #333' }}>
        <FPCheckbox label={t('profile.crewToolActive')} checked={form.crewToolActive} onChange={v => set('crewToolActive', v)} />
      </div>

      {/* Passwort */}
      <div className="space-y-3" ref={pwAccordionRef}>
        <h3 className="text-sm font-semibold border-b pb-2" style={{ color: '#e0e0e0', borderColor: '#333' }}>{t('profile.password')}</h3>

        {/* Mobile: Akkordion */}
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => {
              const next = !showPwForm
              setShowPwForm(next)
              if (next) setTimeout(() => pwAccordionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium"
            style={{ background: '#2d2d2d', border: '1px solid #444', color: '#e0e0e0' }}
          >
            <span>{t('settings.profile.changePassword')}</span>
            <svg className={`w-4 h-4 transition-transform${showPwForm ? ' rotate-180' : ''}`} style={{ color: '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showPwForm && (
            <div className="mt-2 rounded-xl p-4" style={{ background: '#2d2d2d', border: '1px solid #444' }}>
              <form onSubmit={handlePwChange} className="space-y-2.5">
                {pwError && <div className="p-2 rounded text-xs" style={{ background: '#3b1515', border: '1px solid #7f1d1d', color: '#fca5a5' }}>{pwError}</div>}
                {pwSuccess && <div className="p-2 rounded text-xs" style={{ background: '#14321e', border: '1px solid #166534', color: '#86efac' }}>{t('settings.profile.savedSuccess')}</div>}
                {(['current','next','confirm'] as const).map((key, i) => (
                  <div key={key}>
                    <label className="detail-label">{[t('settings.profile.currentPassword'), t('settings.profile.newPassword'), t('settings.profile.confirm')][i]}</label>
                    <input type="password" value={pwForm[key]} onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))} required minLength={key !== 'current' ? 6 : undefined} className="detail-input" />
                  </div>
                ))}
                <button type="submit" disabled={pwSaving} className="btn btn-primary w-full mt-1">
                  {pwSaving ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : null}
                  {t('general.save')}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Desktop */}
        <div className="hidden md:block">
          <form onSubmit={handlePwChange} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['current','next','confirm'] as const).map((key, i) => (
              <div key={key}>
                <label className="detail-label">{[t('settings.profile.currentPasswordLabel'), t('settings.profile.newPasswordLabel'), t('settings.profile.confirm')][i]}</label>
                <input type="password" value={pwForm[key]} onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))} required minLength={key !== 'current' ? 6 : undefined} className="detail-input" />
              </div>
            ))}
            {pwError && <div className="md:col-span-3 p-2 rounded text-xs" style={{ background: '#3b1515', border: '1px solid #7f1d1d', color: '#fca5a5' }}>{pwError}</div>}
            {pwSuccess && <div className="md:col-span-3 p-2 rounded text-xs" style={{ background: '#14321e', border: '1px solid #166534', color: '#86efac' }}>{t('settings.profile.savedSuccess')}</div>}
            <div className="md:col-span-3 flex">
              <button type="submit" disabled={pwSaving} className="btn btn-primary flex items-center gap-1.5">
                {pwSaving ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : null}
                {t('general.save')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Sprache / Language */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold border-b pb-2" style={{ color: '#e0e0e0', borderColor: '#333' }}>
          {t('settings.language.label')}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setLanguage('de')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              language === 'de'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-200'
            }`}
            style={{ background: language === 'de' ? '#2563eb' : '#2d2d2d' }}
          >
            🇩🇪 Deutsch
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              language === 'en'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-200'
            }`}
            style={{ background: language === 'en' ? '#2563eb' : '#2d2d2d' }}
          >
            🇺🇸 English
          </button>
        </div>
      </div>

      {/* iCal Feed */}
      <IcalSection />

    </div>
  )
}

// ============================================================
// IcalSection — Kalender-Abo
// ============================================================

function IcalSection() {
  const t = useT()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    getIcalToken()
      .then(setToken)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const url = token ? getIcalUrl(token) : ''
  // https:// Version zum Testen im Browser
  const httpsUrl = url.replace(/^webcal:\/\//, 'https://')

  const handleCopy = async () => {
    if (!url) return
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url)
      } else {
        const el = document.createElement('textarea')
        el.value = url; el.style.position = 'fixed'; el.style.left = '-9999px'
        document.body.appendChild(el); el.focus(); el.select()
        document.execCommand('copy'); document.body.removeChild(el)
      }
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const handleRegenerate = async () => {
    if (!confirm(t('settings.ical.regenerateConfirm'))) return
    setRegenerating(true)
    try {
      const newToken = await regenerateIcalToken()
      setToken(newToken)
    } finally { setRegenerating(false) }
  }

  return (
    <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
        <CalendarDaysIcon className="w-4 h-4 text-gray-400" />
        {t('profile.calendar')}
      </h4>
      <p className="text-xs text-gray-500 mb-3">
        {t('settings.ical.description')}
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-xs"><Loader2 className="animate-spin w-3 h-3" /> {t('general.loading')}</div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={url}
              onFocus={e => e.target.select()}
              className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-600 text-xs font-mono select-all truncate"
            />
            <button
              onClick={handleCopy}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
            >
              {copied ? `✓ ${t('settings.ical.copied')}` : t('settings.ical.copy')}
            </button>
          </div>
          <a href={httpsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
            {t('settings.ical.testInBrowser')}
          </a>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            {regenerating ? <Loader2 size={10} className="animate-spin" /> : null}
            {t('settings.ical.regenerate')}
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// UserManagement Component
// ============================================================

function UserTable({ users, currentUserId, searchTerm, onOpenProfile, onEditEmail, onEditPassword, onToggleStatus, onRemove, onRoleChange }: {
  users: TenantUser[]
  currentUserId?: number
  searchTerm: string
  onOpenProfile: (user: TenantUser) => void
  onEditEmail: (user: TenantUser) => void
  onEditPassword: (user: TenantUser) => void
  onToggleStatus: (userId: number) => void
  onRemove: (userId: number) => void
  onRoleChange: (userId: number, role: TenantRole) => void
}) {
  const t = useT()

  const USER_COLS: [string, keyof TenantUser][] = [
    [t('table.firstName'), 'firstName'],
    [t('table.lastName'), 'lastName'],
    [t('general.email'), 'email'],
    [t('table.role'), 'role'],
  ]

  const filtered = users.filter(u =>
    `${u.firstName} ${u.lastName} ${u.email} ${u.role}`
      .toLowerCase().includes(searchTerm.toLowerCase())
  )
  const { sortKey, sortDir, sorted, toggleSort } = useSortable(
    filtered as unknown as Record<string, unknown>[],
    'lastName'
  )

  const actionButtons = (user: TenantUser) => (
    <div className="flex items-center gap-1">
      <button onClick={e => { e.stopPropagation(); onEditEmail(user) }} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors" title={t('settings.users.editEmail')}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
      </button>
      <button onClick={e => { e.stopPropagation(); onEditPassword(user) }} className="p-1.5 text-gray-400 hover:text-yellow-500 transition-colors" title={t('settings.users.setPassword')}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
      </button>
      {user.id !== currentUserId && (
        <>
          <button onClick={e => { e.stopPropagation(); onToggleStatus(user.id) }} className={`p-1.5 transition-colors ${user.memberStatus === 'inactive' ? 'text-green-500 hover:text-green-600' : 'text-gray-400 hover:text-orange-500'}`} title={user.memberStatus === 'inactive' ? t('settings.users.activate') : t('settings.users.deactivate')}>
            {user.memberStatus === 'inactive'
              ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            }
          </button>
          <button onClick={e => { e.stopPropagation(); onRemove(user.id) }} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title={t('general.remove')}>
            <TrashIcon className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile: Card-Liste */}
      <div className="md:hidden space-y-2">
        {(sorted as unknown as TenantUser[]).map(user => (
          <div key={user.id} className={`bg-white border border-gray-200 rounded-xl p-3${user.memberStatus === 'inactive' ? ' opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0" onClick={() => onOpenProfile(user)}>
                <p className="font-semibold text-gray-900 text-sm truncate">
                  {user.firstName} {user.lastName}
                  {user.id === currentUserId && <span className="ml-1 text-xs text-blue-500">{t('settings.users.you')}</span>}
                  {user.memberStatus === 'inactive' && <span className="ml-1 text-xs text-gray-400">{t('settings.users.inactive')}</span>}
                </p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>
              </div>
              {actionButtons(user)}
            </div>
            <div className="mt-2" onClick={e => e.stopPropagation()}>
              {user.id === currentUserId ? (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {ROLE_LABELS[user.role as TenantRole] ?? user.role}
                </span>
              ) : (
                <select
                  value={user.role}
                  onChange={e => onRoleChange(user.id, e.target.value as TenantRole)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                >
                  {(Object.entries(ROLE_LABELS) as [TenantRole, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 text-xs py-4">{t('settings.users.noResults')}</p>
        )}
      </div>

      {/* Desktop: Tabelle */}
      <div className="hidden md:block data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {USER_COLS.map(([label, key]) => (
                <th key={key as string} className="sortable" onClick={() => toggleSort(key as string)}>
                  {label}
                  <span className={`sort-indicator${sortKey === key ? ' active' : ''}`}>
                    {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                  </span>
                </th>
              ))}
              <th className="text-center w-20"></th>
            </tr>
          </thead>
          <tbody>
            {(sorted as unknown as TenantUser[]).map(user => (
              <tr key={user.id} className={`clickable${user.memberStatus === 'inactive' ? ' opacity-50' : ''}`} onClick={() => onOpenProfile(user)}>
                <td className="font-medium">
                  {user.firstName}
                  {user.id === currentUserId && <span className="ml-1 text-xs text-blue-500">{t('settings.users.you')}</span>}
                </td>
                <td className="font-medium">
                  {user.lastName}
                  {user.memberStatus === 'inactive' && (
                    <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{t('settings.users.inactive')}</span>
                  )}
                </td>
                <td className="text-gray-500">{user.email}</td>
                <td>
                  {user.id === currentUserId ? (
                    <span className="text-gray-600">{ROLE_LABELS[user.role as TenantRole] ?? user.role}</span>
                  ) : (
                    <select
                      value={user.role}
                      onClick={e => e.stopPropagation()}
                      onChange={e => { e.stopPropagation(); onRoleChange(user.id, e.target.value as TenantRole) }}
                      className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {(Object.entries(ROLE_LABELS) as [TenantRole, string][]).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="text-center">{actionButtons(user)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center text-gray-400 text-xs py-4">{t('settings.users.noResults')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

interface ModalUser { userId: number; name: string; currentEmail: string }

function UserManagement() {
  const t = useT()
  const currentTenant = getCurrentTenant()
  const currentUser = getCurrentUser()
  const isAdmin = getEffectiveRole() === 'admin'

  const [users, setUsers] = useState<TenantUser[]>([])
  const [pending, setPending] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Profil Modal
  const [profileContact, setProfileContact] = useState<Contact | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const openProfile = async (user: TenantUser) => {
    setProfileLoading(true)
    try {
      const c = await getOrCreateUserContact(user.id)
      setProfileContact(c)
      // contactId im lokalen State nachführen falls neu angelegt
      if (!user.contactId) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, contactId: Number(c.id) } : u))
      }
    } catch { /* ignore */ }
    finally { setProfileLoading(false) }
  }

  // E-Mail Modal
  const [emailModal, setEmailModal] = useState<ModalUser | null>(null)
  const [emailValue, setEmailValue] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')

  const openEmailModal = (user: TenantUser) => {
    setEmailModal({ userId: user.id, name: `${user.firstName} ${user.lastName}`, currentEmail: user.email })
    setEmailValue(user.email)
    setEmailError('')
    setEmailSuccess('')
  }
  const closeEmailModal = () => { setEmailModal(null); setEmailValue(''); setEmailError(''); setEmailSuccess('') }

  const handleEmailSave = async () => {
    if (!emailModal) return
    if (!emailValue.includes('@')) { setEmailError(t('settings.users.invalidEmail')); return }
    if (emailValue.trim().toLowerCase() === emailModal.currentEmail.toLowerCase()) { setEmailError(t('settings.users.noChange')); return }
    setEmailSaving(true); setEmailError(''); setEmailSuccess('')
    try {
      await adminSetUserEmail(emailModal.userId, emailValue.trim())
      setUsers(prev => prev.map(u => u.id === emailModal.userId ? { ...u, email: emailValue.trim() } : u))
      setEmailSuccess(t('settings.profile.savedSuccess'))
      setEmailModal(m => m ? { ...m, currentEmail: emailValue.trim() } : m)
    } catch (e: any) { setEmailError(e?.message ?? t('general.error')) } finally { setEmailSaving(false) }
  }

  // Passwort Modal
  const [pwModal, setPwModal] = useState<ModalUser | null>(null)
  const [pwValue, setPwValue] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')

  const openPwModal = (user: TenantUser) => {
    setPwModal({ userId: user.id, name: `${user.firstName} ${user.lastName}`, currentEmail: user.email })
    setPwValue(''); setPwConfirm(''); setPwError(''); setPwSuccess('')
  }
  const closePwModal = () => { setPwModal(null); setPwValue(''); setPwConfirm(''); setPwError(''); setPwSuccess('') }

  const handlePwSave = async () => {
    if (!pwModal) return
    if (pwValue.length < 6) { setPwError(t('settings.profile.passwordMinLength')); return }
    if (pwValue !== pwConfirm) { setPwError(t('settings.profile.passwordMismatch')); return }
    setPwSaving(true); setPwError(''); setPwSuccess('')
    try {
      await adminSetUserPassword(pwModal.userId, pwValue)
      setPwSuccess(t('settings.profile.passwordSet'))
      setPwValue(''); setPwConfirm('')
    } catch (e: any) { setPwError(e?.message ?? t('general.error')) } finally { setPwSaving(false) }
  }

  const load = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    setError('')
    try {
      const data = await getSettingsUsers()
      setUsers(data.users)
      setPending(data.pending)
    } catch (e: any) {
      setError(e?.message ?? t('settings.users.loadError'))
    } finally {
      setLoading(false)
    }
  }, [isAdmin, t])

  useEffect(() => { load() }, [load])

  const handleRoleChange = async (userId: number, role: TenantRole) => {
    try {
      await updateUserRole(userId, role)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
      if (userId === currentUser?.id) updateCurrentTenantRole(role)
    } catch (e: any) {
      setError(e?.message ?? t('settings.users.saveError'))
    }
  }

  const handleRemoveUser = async (userId: number) => {
    if (!confirm(t('settings.users.removeConfirm'))) return
    try {
      await removeUser(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (e: any) {
      setError(e?.message ?? t('settings.users.removeError'))
    }
  }

  const handleToggleStatus = async (userId: number) => {
    try {
      const newStatus = await adminToggleUserStatus(userId)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, memberStatus: newStatus } : u))
    } catch (e: any) {
      setError(e?.message ?? t('settings.users.statusError'))
    }
  }

  const handleRevokeInvite = async (tokenId: number) => {
    try {
      await revokeInvite(tokenId)
      setPending(prev => prev.filter(p => p.id !== tokenId))
    } catch (e: any) {
      setError(e?.message ?? t('settings.users.revokeError'))
    }
  }

  // Link-Popup für offene Einladungen
  const [linkPopup, setLinkPopup] = useState<{ token: string; email: string } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const handleCopyInviteLink = async (token: string) => {
    const url = `${window.location.origin}/invite/${token}`
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url)
      } else {
        const el = document.createElement('textarea')
        el.value = url
        el.style.position = 'fixed'
        el.style.left = '-9999px'
        document.body.appendChild(el)
        el.focus(); el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {}
  }

  if (!isAdmin) {
    return (
      <div className="bg-gray-50 rounded-lg p-6">
        <p className="text-gray-500 text-sm">{t('settings.users.adminOnly')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <UserGroupIcon className="w-5 h-5" />
          {t('settings.users.management')}
        </h3>
        <p className="text-sm text-gray-500">
          {t('settings.users.inviteHint')}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
          <Loader2 className="animate-spin w-4 h-4" /> {t('general.loading')}
        </div>
      ) : (
        <>
          {/* Aktive User */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700">{t('settings.users.activeMembers')}</h4>
              <input
                type="text"
                placeholder={t('general.search')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoComplete="off"
                className="search-input w-48"
              />
            </div>
            <UserTable
              users={users}
              currentUserId={currentUser?.id}
              searchTerm={searchTerm}
              onOpenProfile={openProfile}
              onEditEmail={openEmailModal}
              onEditPassword={openPwModal}
              onToggleStatus={handleToggleStatus}
              onRemove={handleRemoveUser}
              onRoleChange={handleRoleChange}
            />
          </div>

          {/* Offene Einladungen */}
          {pending.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('settings.users.pendingInvites')}</h4>

              {/* Mobile: Cards */}
              <div className="md:hidden space-y-2">
                {pending.map(inv => (
                  <div key={inv.id} className="bg-white border border-gray-200 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {inv.firstName || inv.lastName ? `${inv.firstName ?? ''} ${inv.lastName ?? ''}`.trim() : <span className="text-gray-400 italic text-xs">{t('settings.users.noName')}</span>}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{inv.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded">
                            {ROLE_LABELS[inv.role] ?? inv.role}
                          </span>
                          <span className="text-xs text-gray-400">{t('settings.users.expiresAt').replace('{date}', new Date(inv.expiresAt).toLocaleDateString('de-DE'))}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => { setLinkPopup({ token: inv.token, email: inv.email }); setLinkCopied(false) }} className="p-1.5 text-gray-400 hover:text-blue-500" title={t('settings.users.showLink')}>
                          <LinkIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleRevokeInvite(inv.id)} className="p-1.5 text-gray-400 hover:text-red-500" title={t('settings.users.revoke')}>
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: Tabelle */}
              <div className="hidden md:block data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('table.firstName')}</th>
                      <th>{t('table.lastName')}</th>
                      <th>{t('general.email')}</th>
                      <th>{t('table.role')}</th>
                      <th>Läuft ab</th>
                      <th className="text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map(inv => (
                      <tr key={inv.id}>
                        <td>{inv.firstName ?? <span className="text-gray-300 italic text-xs">–</span>}</td>
                        <td>{inv.lastName ?? <span className="text-gray-300 italic text-xs">–</span>}</td>
                        <td className="text-gray-500">{inv.email}</td>
                        <td>
                          <span className="inline-block bg-yellow-50 text-yellow-700 text-xs px-2 py-0.5 rounded">
                            {ROLE_LABELS[inv.role] ?? inv.role}
                          </span>
                        </td>
                        <td className="text-gray-400 text-xs">
                          {new Date(inv.expiresAt).toLocaleDateString('de-DE')}
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => { setLinkPopup({ token: inv.token, email: inv.email }); setLinkCopied(false) }} className="p-1 text-gray-400 hover:text-blue-500 transition-colors" title={t('settings.users.showInviteLink')}>
                              <LinkIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleRevokeInvite(inv.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title={t('settings.users.revoke')}>
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Einladungslink-Popup */}
      {linkPopup && (
        <div className="modal-overlay" onClick={() => setLinkPopup(null)}>
          <div className="modal-container max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('settings.users.inviteLink')}</h2>
              <button onClick={() => setLinkPopup(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-600">
                {t('settings.users.linkFor').replace('{email}', linkPopup.email)}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${linkPopup.token}`}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 text-sm font-mono select-all"
                  onFocus={e => e.target.select()}
                />
                <button
                  onClick={() => handleCopyInviteLink(linkPopup.token)}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                  title="Kopieren"
                >
                  {linkCopied
                    ? <ClipboardDocumentCheckIcon className="w-5 h-5 text-green-500" />
                    : <ClipboardDocumentIcon className="w-5 h-5 text-gray-500" />
                  }
                </button>
              </div>
              {linkCopied && <p className="text-xs text-green-600">{t('settings.users.linkCopied')}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Profil-Modal */}
      {profileContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setProfileContact(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <ProfileEditor
              isOpen={true}
              onClose={() => setProfileContact(null)}
              profileData={{
                firstName: profileContact.firstName, lastName: profileContact.lastName,
                email: profileContact.email, phone: profileContact.phone ?? '', mobile: profileContact.mobile ?? '',
                address: profileContact.address ?? '', postalCode: profileContact.postalCode ?? '', residence: profileContact.residence ?? '',
                birthDate: profileContact.birthDate ?? '', gender: profileContact.gender ?? '', pronouns: profileContact.pronouns ?? '',
                birthPlace: profileContact.birthPlace ?? '', nationality: profileContact.nationality ?? '',
                idNumber: profileContact.idNumber ?? '', taxId: profileContact.taxId ?? '', socialSecurity: profileContact.socialSecurity ?? '',
                taxNumber: profileContact.taxNumber ?? '', vatId: profileContact.vatId ?? '',
                function1: profileContact.function1 ?? '', function2: profileContact.function2 ?? '', function3: profileContact.function3 ?? '',
                specification: profileContact.specification ?? '',
                diet: profileContact.diet ?? 'alles', glutenFree: Boolean(profileContact.glutenFree), lactoseFree: Boolean(profileContact.lactoseFree),
                allergies: profileContact.allergies ?? '', specialNotes: profileContact.notes ?? '',
                emergencyContact: profileContact.emergencyContact ?? '', emergencyPhone: profileContact.emergencyPhone ?? '',
                shirtSize: profileContact.shirtSize ?? '', hoodieSize: profileContact.hoodieSize ?? '',
                pantsSize: profileContact.pantsSize ?? '', shoeSize: profileContact.shoeSize ?? '',
                languages: profileContact.languages ?? '', driversLicense: profileContact.driversLicense ?? '',
                railcard: profileContact.railcard ?? '', frequentFlyer: profileContact.frequentFlyer ?? '',
                bankAccount: profileContact.bankAccount ?? '', bankIban: profileContact.bankIban ?? '', bankBic: profileContact.bankBic ?? '',
                hotelInfo: profileContact.hotelInfo ?? '', hotelAlias: profileContact.hotelAlias ?? '',
                accessRights: profileContact.accessRights ?? '', personalFiles: [],
                crewToolActive: profileContact.crewToolActive !== false,
              }}
              onSave={async (data) => {
                await updateContact(profileContact.id, {
                  firstName: data.firstName, lastName: data.lastName, email: data.email,
                  phone: data.phone, mobile: data.mobile, address: data.address,
                  postalCode: data.postalCode, residence: data.residence, birthDate: data.birthDate,
                  gender: data.gender, pronouns: data.pronouns, birthPlace: data.birthPlace,
                  nationality: data.nationality, idNumber: data.idNumber, taxId: data.taxId,
                  socialSecurity: data.socialSecurity, taxNumber: data.taxNumber, vatId: data.vatId,
                  function1: data.function1, function2: data.function2, function3: data.function3,
                  specification: data.specification, accessRights: data.accessRights,
                  diet: data.diet, glutenFree: data.glutenFree, lactoseFree: data.lactoseFree,
                  allergies: data.allergies, notes: data.specialNotes,
                  emergencyContact: data.emergencyContact, emergencyPhone: data.emergencyPhone,
                  shirtSize: data.shirtSize, hoodieSize: data.hoodieSize,
                  pantsSize: data.pantsSize, shoeSize: data.shoeSize,
                  languages: data.languages, driversLicense: data.driversLicense,
                  railcard: data.railcard, frequentFlyer: data.frequentFlyer,
                  bankAccount: data.bankAccount, bankIban: data.bankIban, bankBic: data.bankBic,
                  crewToolActive: data.crewToolActive,
                  website: '', hourlyRate: 0, dailyRate: 0, hotelInfo: '', hotelAlias: '',
                })
                setUsers(prev => prev.map(u =>
                  u.contactId === Number(profileContact.id)
                    ? { ...u, firstName: data.firstName, lastName: data.lastName, email: data.email }
                    : u
                ))
                setProfileContact(null)
              }}
              isAdmin={true}
              isSelf={false}
              onDelete={() => {}}
            />
          </div>
        </div>
      )}
      {profileLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <Loader2 className="animate-spin w-8 h-8 text-white" />
        </div>
      )}

      {/* Modal: E-Mail ändern */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={closeEmailModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">{t('settings.users.editEmailTitle').replace('{name}', emailModal.name)}</h3>
              <button onClick={closeEmailModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {emailError && <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{emailError}</div>}
            {emailSuccess && <div className="p-2 bg-green-50 border border-green-200 rounded text-green-700 text-xs">{emailSuccess}</div>}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('general.email')}</label>
              <input
                type="email"
                value={emailValue}
                onChange={e => setEmailValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEmailSave()}
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeEmailModal} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">{t('general.cancel')}</button>
              <button onClick={handleEmailSave} disabled={emailSaving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                {emailSaving ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : null}
                {t('general.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Passwort setzen */}
      {pwModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={closePwModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">{t('settings.users.passwordTitle').replace('{name}', pwModal.name)}</h3>
              <button onClick={closePwModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {pwError && <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{pwError}</div>}
            {pwSuccess && <div className="p-2 bg-green-50 border border-green-200 rounded text-green-700 text-xs">{pwSuccess}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('settings.profile.newPasswordLabel')}</label>
                <input type="password" value={pwValue} onChange={e => setPwValue(e.target.value)} autoFocus autoComplete="new-password" placeholder={t('settings.profile.passwordMinLength')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('settings.profile.confirm')}</label>
                <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} autoComplete="new-password" onKeyDown={e => e.key === 'Enter' && handlePwSave()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closePwModal} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">{t('general.cancel')}</button>
              <button onClick={handlePwSave} disabled={pwSaving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                {pwSaving ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : null}
                {t('general.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// SuperadminPanel — globale User-Verwaltung (nur für Superadmin)
// ============================================================

function SuperadminPanel() {
  const t = useT()
  const [users, setUsers] = useState<SuperadminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // PW-Modal
  const [pwModal, setPwModal] = useState<SuperadminUser | null>(null)
  const [pwValue, setPwValue] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSuccess, setPwSuccess] = useState('')

  // Delete-Confirm
  const [deleteTarget, setDeleteTarget] = useState<SuperadminUser | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    superadminGetUsers()
      .then(u => { setUsers(u); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const filtered = users.filter(u =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const openPwModal = (u: SuperadminUser) => {
    setPwModal(u); setPwValue(''); setPwError(''); setPwSuccess('')
  }

  const handlePwSave = async () => {
    if (!pwModal) return
    if (pwValue.length < 6) { setPwError(t('settings.profile.passwordMinLength')); return }
    setPwSaving(true); setPwError(''); setPwSuccess('')
    try {
      await superadminSetPassword(pwModal.id, pwValue)
      setPwSuccess(t('settings.profile.passwordSet'))
      setTimeout(() => setPwModal(null), 1200)
    } catch (e: any) {
      setPwError(e.message)
    } finally {
      setPwSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    if (deleteConfirmText !== deleteTarget.email) { setDeleteError(t('settings.superadmin.emailMismatch')); return }
    setDeleting(true); setDeleteError('')
    try {
      await superadminDeleteUser(deleteTarget.id)
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
      setDeleteTarget(null)
      setDeleteConfirmText('')
    } catch (e: any) {
      setDeleteError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" size={20} /></div>
  if (error) return <div className="text-red-600 text-sm p-4">{error}</div>

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <UsersIcon className="w-5 h-5 text-red-500" />
          {t('settings.superadmin.title')}
        </h3>
        <p className="text-sm text-gray-500 mb-4">{t('settings.superadmin.description')}</p>
      </div>

      <input
        type="text"
        placeholder={t('general.search')}
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 text-gray-600 font-medium">{t('table.name')}</th>
              <th className="text-left px-3 py-2 text-gray-600 font-medium">{t('general.email')}</th>
              <th className="text-left px-3 py-2 text-gray-600 font-medium">{t('table.tenants')}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <span className="font-medium text-gray-900">{u.firstName} {u.lastName}</span>
                  {u.isSuperadmin && (
                    <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">SA</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600">{u.email}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">
                  {u.tenantCount === 0
                    ? <span className="text-orange-500 font-medium">{t('settings.superadmin.noTenant')}</span>
                    : <span title={u.tenantNames}>{u.tenantCount} Tenant{u.tenantCount !== 1 ? 's' : ''}</span>
                  }
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => openPwModal(u)}
                      className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
                    >
                      {t('settings.superadmin.setPassword')}
                    </button>
                    {!u.isSuperadmin && (
                      <button
                        onClick={() => { setDeleteTarget(u); setDeleteConfirmText(''); setDeleteError('') }}
                        className="text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50 text-red-600"
                      >
                        {t('general.delete')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="text-center py-6 text-gray-400">{t('settings.superadmin.noUsersFound')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PW-Modal */}
      {pwModal && (
        <div className="modal-overlay" onClick={() => setPwModal(null)}>
          <div className="modal-container max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('settings.superadmin.passwordTitle')}</h2>
              <button onClick={() => setPwModal(null)} className="text-gray-400 hover:text-white"><span className="text-xl">✕</span></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-600">
                {t('settings.superadmin.userInfo').replace('{name}', `${pwModal.firstName} ${pwModal.lastName}`).replace('{email}', pwModal.email)}
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('settings.profile.newPasswordLabel')}</label>
                <input
                  type="password"
                  autoFocus
                  autoComplete="new-password"
                  value={pwValue}
                  onChange={e => setPwValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePwSave()}
                  placeholder={t('settings.profile.passwordMinLength')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {pwError && <p className="text-xs text-red-600">{pwError}</p>}
              {pwSuccess && <p className="text-xs text-green-600">{pwSuccess}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setPwModal(null)} className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">{t('general.cancel')}</button>
                <button
                  onClick={handlePwSave}
                  disabled={pwSaving}
                  className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {pwSaving ? <Loader2 size={12} className="animate-spin" /> : null}
                  {t('settings.superadmin.set')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete-Confirm-Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-container max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('settings.superadmin.deleteTitle')}</h2>
              <button onClick={() => setDeleteTarget(null)} className="text-gray-400 hover:text-white"><span className="text-xl">✕</span></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{deleteTarget.firstName} {deleteTarget.lastName}</span> ({deleteTarget.email}) wird global gelöscht.
                Kontaktdaten bleiben in den Tenants erhalten, werden aber vom User-Account getrennt.
              </p>
              <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {t('settings.superadmin.irreversible')}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('settings.superadmin.confirmDelete').replace('{email}', deleteTarget.email)}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setDeleteTarget(null)} className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">{t('general.cancel')}</button>
                <button
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirmText !== deleteTarget.email}
                  className="text-sm px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : null}
                  {t('settings.superadmin.deleteConfirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// ErsteSchritte
// ============================================================

function ErsteSchritte() {
  const t = useT()
  const role = getCurrentTenant()?.role ?? ''
  const isAdmin = isAdminRole(role)

  const adminSteps = [1, 2, 3, 4, 5, 6].map(n => ({
    title: t(`settings.ersteSchritte.adminQuickstart.step${n}.title` as any),
    desc:  t(`settings.ersteSchritte.adminQuickstart.step${n}.desc`  as any),
  }))

  const crewSteps = [1, 2, 3].map(n => ({
    title: t(`settings.ersteSchritte.crewQuickstart.step${n}.title` as any),
    desc:  t(`settings.ersteSchritte.crewQuickstart.step${n}.desc`  as any),
  }))

  const sections = [
    {
      title: t('settings.ersteSchritte.desk.title'),
      roles: t('settings.ersteSchritte.desk.roles'),
      edit: t('settings.ersteSchritte.desk.edit'),
      icon: t('settings.ersteSchritte.desk.icon'),
      content: t('settings.ersteSchritte.desk.content'),
    },
    {
      title: t('settings.ersteSchritte.events.title'),
      roles: t('settings.ersteSchritte.events.roles'),
      edit: t('settings.ersteSchritte.events.edit'),
      icon: t('settings.ersteSchritte.events.icon'),
      content: t('settings.ersteSchritte.events.content'),
    },
    {
      title: t('settings.ersteSchritte.contacts.title'),
      roles: t('settings.ersteSchritte.contacts.roles'),
      edit: t('settings.ersteSchritte.contacts.edit'),
      icon: t('settings.ersteSchritte.contacts.icon'),
      content: t('settings.ersteSchritte.contacts.content'),
    },
    {
      title: t('settings.ersteSchritte.venues.title'),
      roles: t('settings.ersteSchritte.venues.roles'),
      edit: t('settings.ersteSchritte.venues.edit'),
      icon: t('settings.ersteSchritte.venues.icon'),
      content: t('settings.ersteSchritte.venues.content'),
    },
    {
      title: t('settings.ersteSchritte.partners.title'),
      roles: t('settings.ersteSchritte.partners.roles'),
      edit: t('settings.ersteSchritte.partners.edit'),
      icon: t('settings.ersteSchritte.partners.icon'),
      content: t('settings.ersteSchritte.partners.content'),
    },
    {
      title: t('settings.ersteSchritte.hotels.title'),
      roles: t('settings.ersteSchritte.hotels.roles'),
      edit: t('settings.ersteSchritte.hotels.edit'),
      icon: t('settings.ersteSchritte.hotels.icon'),
      content: t('settings.ersteSchritte.hotels.content'),
    },
    {
      title: t('settings.ersteSchritte.vehicles.title'),
      roles: t('settings.ersteSchritte.vehicles.roles'),
      edit: t('settings.ersteSchritte.vehicles.edit'),
      icon: t('settings.ersteSchritte.vehicles.icon'),
      content: t('settings.ersteSchritte.vehicles.content'),
    },
    {
      title: t('settings.ersteSchritte.settingsArea.title'),
      roles: t('settings.ersteSchritte.settingsArea.roles'),
      edit: t('settings.ersteSchritte.settingsArea.edit'),
      icon: t('settings.ersteSchritte.settingsArea.icon'),
      content: t('settings.ersteSchritte.settingsArea.content'),
    },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t('settings.ersteSchritte.welcome')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('settings.ersteSchritte.intro')}</p>
      </div>

      {/* Admin Quickstart */}
      {isAdmin && (
        <div className="border border-indigo-200 rounded-xl overflow-hidden">
          <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-200">
            <h3 className="font-semibold text-indigo-900 text-sm">{t('settings.ersteSchritte.adminQuickstart.title' as any)}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {adminSteps.map((step, i) => (
              <div key={i} className="px-4 py-3 flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{step.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crew Quickstart */}
      <div className="border border-emerald-200 rounded-xl overflow-hidden">
        <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-200">
          <h3 className="font-semibold text-emerald-900 text-sm">{t('settings.ersteSchritte.crewQuickstart.title' as any)}</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {crewSteps.map((step, i) => (
            <div key={i} className="px-4 py-3 flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">{step.title}</p>
                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Module Overview */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('settings.ersteSchritte.modulesTitle' as any)}</h3>
        <div className="space-y-1">
          {sections.map((s, i) => (
            <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 flex items-start gap-3">
                <span className="text-xl leading-none mt-0.5">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm">{s.title}</h4>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                    <span className="text-xs text-gray-500">
                      <span className="font-medium text-gray-600">{t('settings.ersteSchritte.visibleFor')}:</span> {s.roles}
                    </span>
                    <span className="text-xs text-gray-500">
                      <span className="font-medium text-gray-600">{t('settings.ersteSchritte.editBy')}:</span> {s.edit}
                    </span>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-gray-600 leading-relaxed">{s.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <p className="text-sm text-blue-700">{t('settings.ersteSchritte.feedback')}</p>
      </div>
    </div>
  )
}

// ── Partner-Typen Settings ────────────────────────────────────────────────────
const PARTNER_SUGGESTIONS = [
  { group: 'Booking & Management', items: ['Booking Agentur', 'Tourmanagement', 'Artist Management', 'Promotion', 'Veranstalter'] },
  { group: 'Technik', items: ['PA / Sound', 'Lichtfirma', 'Backline', 'Backline-Firma', 'Bühnenbau', 'Video / LED', 'Strom / Generator', 'Technik-Lieferant'] },
  { group: 'Medien', items: ['Pressebüro', 'Fotografie', 'Videoproduktion', 'Medien-/Videoproduktion', 'Social Media', 'Radio / TV'] },
  { group: 'Produktion & Merch', items: ['Label', 'Verleger', 'Merchandise', 'Catering'] },
  { group: 'Logistik', items: ['Busunternehmen', 'Transport', 'Autovermietung', 'Trucking-Firma', 'Sicherheitsdienst', 'Reisebüro', 'Versicherung'] },
]

function PartnerTypesSettings() {
  const t = useT()
  const [types, setTypes] = useState<PartnerType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  // pendingOverrides: visibility changes for existing DB entries { [id]: 0 | 1 }
  const [pendingOverrides, setPendingOverrides] = useState<Record<number, 0 | 1>>({})
  // pendingCreates: catalog names not yet in DB that user activated
  const [pendingCreates, setPendingCreates] = useState<string[]>([])

  const isDirty = Object.keys(pendingOverrides).length > 0 || pendingCreates.length > 0

  useEffect(() => {
    getPartnerTypes()
      .then(data => { setTypes(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    ;(window as any).__pt_isDirty = isDirty
    return () => { ;(window as any).__pt_isDirty = false }
  }, [isDirty])

  const saveEdit = async (): Promise<boolean> => {
    if (!isDirty) return true
    setSaving(true)
    try {
      // Create all pending catalog items (created as visible=1)
      const created = await Promise.all(
        pendingCreates.map(name => createPartnerType(name))
      )
      // Apply all visibility overrides
      const overrideEntries = Object.entries(pendingOverrides) as [string, 0 | 1][]
      await Promise.all(
        overrideEntries.map(([idStr, visible]) =>
          togglePartnerTypeVisible(Number(idStr), visible === 1)
        )
      )
      // Merge into local state
      setTypes(prev => {
        const merged = prev.map(pt => {
          const ov = pendingOverrides[pt.id]
          return ov !== undefined ? { ...pt, visible: ov } : pt
        })
        return [...merged, ...created]
      })
      setPendingOverrides({})
      setPendingCreates([])
      return true
    } catch {
      return false
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    ;(window as any).__pt_save = saveEdit
    return () => { ;(window as any).__pt_save = null }
  })

  const cancelEdit = () => {
    setPendingOverrides({})
    setPendingCreates([])
  }

  // Toggle an existing DB entry's visibility (buffered)
  function handleToggleExisting(pt: PartnerType) {
    const currentVisible = pendingOverrides[pt.id] !== undefined ? pendingOverrides[pt.id] : pt.visible
    const nextVisible: 0 | 1 = currentVisible === 1 ? 0 : 1
    if (nextVisible === pt.visible) {
      setPendingOverrides(prev => { const next = { ...prev }; delete next[pt.id]; return next })
    } else {
      setPendingOverrides(prev => ({ ...prev, [pt.id]: nextVisible }))
    }
  }

  // Toggle a predefined catalog name that has no DB entry yet
  function handleToggleCatalog(name: string) {
    if (pendingCreates.includes(name)) {
      setPendingCreates(prev => prev.filter(n => n !== name))
    } else {
      setPendingCreates(prev => [...prev, name])
    }
  }

  async function handleAddOwn() {
    const name = newName.trim()
    if (!name) return
    setAdding(true); setError('')
    try {
      const created = await createPartnerType(name)
      setTypes(prev => [...prev, created])
      setNewName('')
    } catch (e) {
      setError((e as Error).message || t('settings.users.saveError'))
    } finally { setAdding(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('settings.partnerTypes.deleteConfirm'))) return
    try {
      await deletePartnerType(id)
      setTypes(prev => prev.filter(pt => pt.id !== id))
      setPendingOverrides(prev => { const next = { ...prev }; delete next[id]; return next })
    } catch { /* silent */ }
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
      <Loader2 className="w-4 h-4 animate-spin" /> {t('settings.partnerTypes.loading')}
    </div>
  )

  const allSuggested = new Set(PARTNER_SUGGESTIONS.flatMap(g => g.items))
  const uncategorized = types.filter(pt => !allSuggested.has(pt.name))

  // Chip for predefined catalog items — no X button, no dashed border
  const renderCatalogChip = (name: string) => {
    const existing = types.find(pt => pt.name === name)
    let isActive: boolean
    if (existing) {
      const ov = pendingOverrides[existing.id]
      isActive = ov !== undefined ? ov === 1 : existing.visible === 1
    } else {
      isActive = pendingCreates.includes(name)
    }
    const handleClick = () => existing ? handleToggleExisting(existing) : handleToggleCatalog(name)
    return (
      <button
        key={name}
        className={`pt-fn-chip ${isActive ? 'pt-fn-chip--active' : ''}`}
        onClick={handleClick}
      >
        {name}
      </button>
    )
  }

  // Chip for "Eigene" entries — has X delete button
  const renderOwnChip = (pt: PartnerType) => {
    const ov = pendingOverrides[pt.id]
    const isActive = ov !== undefined ? ov === 1 : pt.visible === 1
    return (
      <button
        key={pt.id}
        className={`pt-fn-chip group ${isActive ? 'pt-fn-chip--active' : ''}`}
        onClick={() => handleToggleExisting(pt)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
      >
        {pt.name}
        <span
          className="opacity-0 group-hover:opacity-50 transition-opacity"
          style={{ fontSize: '10px', lineHeight: 1, marginLeft: '2px' }}
          onClick={e => { e.stopPropagation(); handleDelete(pt.id) }}
        >✕</span>
      </button>
    )
  }

  return (
    <div className="module-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <div className="flex items-center justify-between" style={{ minHeight: '32px', gap: '12px' }}>
        <div>
          <h1 style={{ color: '#e0e0e0', fontSize: '17px', fontWeight: 600 }}>Partner-Kategorien</h1>
          <p className="pt-fn-subtitle" style={{ marginTop: '2px' }}>
            {(() => {
              const totalAll = PARTNER_SUGGESTIONS.flatMap(g => g.items).length + uncategorized.length
              const activeExisting = types.filter(pt => {
                const ov = pendingOverrides[pt.id]
                return ov !== undefined ? ov === 1 : pt.visible === 1
              }).length
              const activeTotal = activeExisting + pendingCreates.length
              return `${activeTotal} von ${totalAll} aktiv`
            })()}
          </p>
        </div>
        {isDirty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '12px', color: '#b0b0b0' }}>Ungespeicherte Änderungen</span>
            <button onClick={cancelEdit}
              style={{ padding: '5px 12px', fontSize: '13px', color: '#b0b0b0', background: 'none', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}>
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

      <div className="pt-fn-groups">
        {PARTNER_SUGGESTIONS.map(group => {
          const toggleGroup = (on: boolean) => {
            const nextOverrides: Record<number, 0 | 1> = { ...pendingOverrides }
            const nextCreates = new Set(pendingCreates)
            group.items.forEach(name => {
              const existing = types.find(pt => pt.name === name)
              if (existing) {
                const target: 0 | 1 = on ? 1 : 0
                if (target !== existing.visible) nextOverrides[existing.id] = target
                else delete nextOverrides[existing.id]
              } else {
                if (on) nextCreates.add(name)
                else nextCreates.delete(name)
              }
            })
            setPendingOverrides(nextOverrides)
            setPendingCreates(Array.from(nextCreates))
          }
          return (
          <div key={group.group} className="pt-fn-group">
            <div className="pt-fn-group-header">
              <span className="pt-fn-group-name">{group.group}</span>
              <div className="pt-fn-group-actions">
                <button className="pt-fn-group-toggle" onClick={() => toggleGroup(true)}>Alle an</button>
                <span className="pt-fn-group-divider">·</span>
                <button className="pt-fn-group-toggle" onClick={() => toggleGroup(false)}>Alle aus</button>
              </div>
            </div>
            <div className="pt-fn-chips">
              {group.items.map(renderCatalogChip)}
            </div>
          </div>
          )
        })}

        {/* Eigene — nicht im Katalog, nur diese haben X */}
        <div className="pt-fn-group">
          <div className="pt-fn-group-header">
            <span className="pt-fn-group-name">Eigene</span>
          </div>
          <div className="pt-fn-chips" style={{ marginBottom: '0.6rem', minHeight: '28px' }}>
            {uncategorized.length === 0 && (
              <span className="pt-fn-subtitle" style={{ fontSize: '0.78rem' }}>Noch keine eigenen Einträge</span>
            )}
            {uncategorized.map(renderOwnChip)}
          </div>
          <div className="flex gap-2 items-center" style={{ maxWidth: '380px' }}>
            <input
              type="text" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddOwn()}
              placeholder="Eigene Kategorie…"
              className="detail-input" style={{ flex: 1, marginBottom: 0 }}
            />
            <button onClick={handleAddOwn} disabled={adding || !newName.trim()}
              className="btn btn-primary flex-shrink-0" style={{ borderRadius: '4px', height: '30px', padding: '0 12px', fontSize: '13px' }}>
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '+'}
            </button>
          </div>
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
      </div>

    </div>
  )
}

// ─── Artist Members Settings ──────────────────────────────────────────────────

function ArtistMembersSettings() {
  const { t, language } = useLanguage()
  const [members, setMembers] = useState<ArtistMember[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<number | null>(null)   // id or -1 for new
  const [form, setForm] = useState<ArtistMemberFormData>({
    first_name: '', last_name: '', roles: [], email: '', phone: '', notes: '', always_in_travelparty: true, sort_order: 0,
  })
  const [roleInput, setRoleInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const COMMON_ROLES = language === 'en'
    ? ['Vocals', 'Guitar', 'Bass', 'Drums', 'Keyboard', 'Trumpet', 'Saxophone', 'Trombone', 'Violin', 'DJ', 'Tour Manager', 'Artist Management', 'Backline', 'Monitor Engineer', 'FOH Engineer']
    : ['Gesang', 'Gitarre', 'Bass', 'Schlagzeug', 'Keyboard', 'Trompete', 'Saxofon', 'Posaune', 'Geige', 'DJ', 'Tourmanager', 'Artist Management', 'Backliner', 'Monitor Engineer', 'FOH Engineer']

  useEffect(() => {
    getArtistMembers().then(setMembers).catch(() => {}).finally(() => setLoading(false))
  }, [])

  function startNew() {
    setForm({ first_name: '', last_name: '', roles: [], email: '', phone: '', notes: '', always_in_travelparty: true, sort_order: members.length })
    setRoleInput('')
    setError('')
    setEditing(-1)
  }

  function startEdit(m: ArtistMember) {
    setForm({ first_name: m.first_name, last_name: m.last_name, roles: [...m.roles], email: m.email, phone: m.phone, notes: m.notes, always_in_travelparty: m.always_in_travelparty, sort_order: m.sort_order })
    setRoleInput('')
    setError('')
    setEditing(m.id)
  }

  function addRole(role: string) {
    const r = role.trim()
    if (!r || form.roles.includes(r)) return
    setForm(f => ({ ...f, roles: [...f.roles, r] }))
    setRoleInput('')
  }

  function removeRole(role: string) {
    setForm(f => ({ ...f, roles: f.roles.filter(r => r !== role) }))
  }

  async function save() {
    if (!form.first_name.trim() && !form.last_name.trim()) { setError(t('settings.artistMembers.nameRequired')); return }
    setSaving(true); setError('')
    try {
      if (editing === -1) {
        const created = await createArtistMember(form)
        setMembers(prev => [...prev, created])
      } else if (editing !== null) {
        const updated = await updateArtistMember(editing, form)
        setMembers(prev => prev.map(m => m.id === editing ? updated : m))
      }
      setEditing(null)
    } catch (e) { setError((e as Error).message || t('general.error')) }
    finally { setSaving(false) }
  }

  async function remove(id: number, name: string) {
    if (!confirm(t('settings.artistMembers.deleteConfirm').replace('{name}', name))) return
    try {
      await deleteArtistMember(id)
      setMembers(prev => prev.filter(m => m.id !== id))
      if (editing === id) setEditing(null)
    } catch { /* silent */ }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <UsersIcon className="w-5 h-5" /> {t('settings.artistMembers.title')}
        </h3>
        {editing === null && (
          <button onClick={startNew} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
            <UserPlusIcon className="w-4 h-4" /> {t('settings.artistMembers.add')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> {t('settings.partnerTypes.loading')}</div>
      ) : (
        <div className="space-y-2">
          {/* Existing members */}
          {members.map(m => (
            editing === m.id ? (
              <MemberForm key={m.id} form={form} setForm={setForm} roleInput={roleInput} setRoleInput={setRoleInput}
                onAddRole={addRole} onRemoveRole={removeRole} onSave={save} onCancel={() => setEditing(null)}
                saving={saving} error={error} commonRoles={COMMON_ROLES} />
            ) : (
              <div key={m.id} className="flex items-start justify-between gap-3 p-3 bg-white border border-gray-200 rounded-lg group">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{m.first_name} {m.last_name}</span>
                    {m.always_in_travelparty && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">{t('settings.artistMembers.alwaysAlong')}</span>
                    )}
                  </div>
                  {m.roles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.roles.map(r => (
                        <span key={r} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r}</span>
                      ))}
                    </div>
                  )}
                  {(m.email || m.phone) && (
                    <p className="text-xs text-gray-400 mt-1">{[m.email, m.phone].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-contact', { detail: { contactId: m.id } }))}
                    className="p-1 text-gray-400 hover:text-purple-600"
                    title={t('settings.artistMembers.openProfile')}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </button>
                  <button onClick={() => startEdit(m)} className="p-1 text-gray-400 hover:text-blue-600">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => remove(m.id, `${m.first_name} ${m.last_name}`)} className="p-1 text-gray-400 hover:text-red-600">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          ))}

          {/* New member form */}
          {editing === -1 && (
            <MemberForm form={form} setForm={setForm} roleInput={roleInput} setRoleInput={setRoleInput}
              onAddRole={addRole} onRemoveRole={removeRole} onSave={save} onCancel={() => setEditing(null)}
              saving={saving} error={error} isNew commonRoles={COMMON_ROLES} />
          )}

          {members.length === 0 && editing === null && (
            <p className="text-sm text-gray-400 py-2">{t('settings.artistMembers.empty')}</p>
          )}
        </div>
      )}
    </div>
  )
}

function MemberForm({ form, setForm, roleInput, setRoleInput, onAddRole, onRemoveRole, onSave, onCancel, saving, error, isNew, commonRoles = [] }: {
  form: ArtistMemberFormData
  setForm: (f: ArtistMemberFormData) => void
  roleInput: string
  setRoleInput: (v: string) => void
  onAddRole: (r: string) => void
  onRemoveRole: (r: string) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string
  isNew?: boolean
  commonRoles?: string[]
}) {
  const t = useT()
  const f = (key: keyof ArtistMemberFormData, val: any) => setForm({ ...form, [key]: val })
  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{isNew ? t('settings.artistMembers.new') : t('settings.artistMembers.edit')}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">{t('settings.artist.firstName')}</label>
          <input autoFocus type="text" value={form.first_name} onChange={e => f('first_name', e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">{t('settings.artist.lastName')}</label>
          <input type="text" value={form.last_name} onChange={e => f('last_name', e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>

      {/* Rollen */}
      <div>
        <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">{t('settings.artistMembers.roles')}</label>
        <div className="flex flex-wrap gap-1 mb-2">
          {form.roles.map(r => (
            <span key={r} className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {r}
              <button onClick={() => onRemoveRole(r)} className="hover:text-red-600 leading-none">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <input type="text" value={roleInput} onChange={e => setRoleInput(e.target.value)}
            placeholder={t('settings.artistMembers.rolePlaceholder')}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddRole(roleInput) } }}
            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <button onClick={() => onAddRole(roleInput)} className="px-2 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded border border-gray-300">+</button>
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {commonRoles.filter(r => !form.roles.includes(r)).map(r => (
            <button key={r} onClick={() => onAddRole(r)}
              className="text-[11px] text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 px-1.5 py-0.5 rounded-full transition-colors">
              + {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">{t('general.email')}</label>
          <input type="email" value={form.email} onChange={e => f('email', e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">{t('settings.artist.phone')}</label>
          <input type="tel" value={form.phone} onChange={e => f('phone', e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">{t('settings.artistMembers.notes')}</label>
        <textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={2}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.always_in_travelparty} onChange={e => f('always_in_travelparty', e.target.checked)}
          className="rounded border-gray-300" />
        <span className="text-sm text-gray-700">{t('settings.artistMembers.alwaysInParty')}</span>
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">{t('general.cancel')}</button>
        <button onClick={onSave} disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {t('general.save')}
        </button>
      </div>
    </div>
  )
}
