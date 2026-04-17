'use client'

import { useState, useEffect, useCallback } from 'react'
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
} from '@heroicons/react/24/outline'
import { Loader2 } from 'lucide-react'
import FunktionenSettings from './FunktionenSettings'
import {
  getSettingsUsers, getMyRole, updateUserRole, removeUser, revokeInvite,
  adminSetUserEmail, adminSetUserPassword, adminToggleUserStatus,
  changePassword, getMyContact, updateMyContact, getContact, updateContact,
  getTenantArtistSettings, updateTenantArtistSettings,
  getTenantBilling, updateTenantBilling,
  getUserFormat, updateUserFormat,
  getCurrentTenant, getCurrentUser, isAdminRole, getEffectiveRole, updateCurrentTenantRole,
  ROLE_LABELS, CURRENT_USER_KEY,
  type TenantUser, type PendingInvite, type TenantRole, type ContactFormData, type Contact,
  type TenantArtistSettings, type TenantBilling, type UserFormat,
} from '@/lib/api-client'

import { ProfileEditor, type ProfileData } from '@/app/components/shared/ProfileEditor'
import { useSortable } from '@/app/hooks/useSortable'

export interface SettingsProps {
  activeSubTab?: string
}

export default function SettingsModule({ activeSubTab = 'profil' }: SettingsProps) {
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null)
  const showSaved = (label = 'Gespeichert') => {
    setSavedFeedback(label)
    setTimeout(() => setSavedFeedback(null), 2000)
  }
  // Load data from API on mount
  useEffect(() => {
    // Artist-Einstellungen aus DB laden
    getTenantArtistSettings()
      .then(s => setArtistData({
        displayName: s.displayName,
        shortCode:   s.shortCode,
        homebase:    s.homebase,
        genre:       s.genre,
        foundedYear: '',
        website:     s.website,
        email:       s.email,
        phone:       s.phone,
        socialMedia: { facebook: '', instagram: '', twitter: '', spotify: '', youtube: '' },
      }))
      .catch(() => {})
    // Billing aus DB laden
    getTenantBilling()
      .then(b => setBillingData({
        company:    b.company,
        firstName:  b.firstName,
        lastName:   b.lastName,
        address:    b.address,
        postalCode: b.postalCode,
        city:       b.city,
        country:    '',
        taxId:      b.taxId,
        email:      b.email,
        phone:      b.phone,
      }))
      .catch(() => {})
    // Format aus DB laden
    getUserFormat()
      .then(f => setFormatData(fd => ({
        ...fd,
        language: f.language,
        timezone: f.timezone,
        currency: f.currency,
      })))
      .catch(() => {})
  }, []);

  const [billingData, setBillingData] = useState({
    company: '',
    firstName: '',
    lastName: '',
    address: '',
    postalCode: '',
    city: '',
    country: '',
    taxId: '',
    email: '',
    phone: ''
  })

  const [subscriptionData, setSubscriptionData] = useState({
    plan: 'Starter',
    status: 'Trial',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    nextBilling: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  })

  const [formatData, setFormatData] = useState({
    language: 'de-DE',
    timezone: 'Europe/Berlin',
    dateFormat: 'DD.MM.YYYY',
    timeFormat: '24h',
    currency: 'EUR',
    numberFormat: 'de-DE'
  })

  const [artistData, setArtistData] = useState({
    displayName: '',
    shortCode: '',
    homebase: '',
    genre: '',
    foundedYear: '',
    website: '',
    email: '',
    phone: '',
    socialMedia: {
      facebook: '',
      instagram: '',
      twitter: '',
      spotify: '',
      youtube: ''
    }
  })

  // Save functions for each data type
  const saveBillingData = (data: typeof billingData) => {
    setBillingData(data);
  };

  const saveSubscriptionData = (data: typeof subscriptionData) => {
    setSubscriptionData(data);
  };

  const saveFormatData = (data: typeof formatData) => {
    setFormatData(data);
  };

  const saveArtistData = async (data: typeof artistData) => {
    setArtistData(data)
    try {
      await updateTenantArtistSettings({
        displayName: data.displayName,
        shortCode:   data.shortCode,
        homebase:    data.homebase,
        genre:       data.genre,
        email:       data.email,
        phone:       data.phone,
        website:     data.website,
      })
      window.dispatchEvent(new CustomEvent('artistUpdated'))
    } catch {}
  };

  const renderContent = () => {
    switch (activeSubTab) {
      case 'artist':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MusicalNoteIcon className="w-5 h-5" />
                Artist
              </h3>
              
              {/* 4 Areas in 4 columns layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Area 1: Rechnungsanschrift */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 border-b pb-2">RECHNUNGSANSCHRIFT</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Firma</label>
                      <input
                        type="text"
                        value={billingData.company}
                        onChange={(e) => saveBillingData({...billingData, company: e.target.value})}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Firmenname"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Vorname</label>
                      <input
                        type="text"
                        value={billingData.firstName}
                        onChange={(e) => saveBillingData({...billingData, firstName: e.target.value})}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Max"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Nachname</label>
                      <input
                        type="text"
                        value={billingData.lastName}
                        onChange={(e) => saveBillingData({...billingData, lastName: e.target.value})}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Mustermann"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Anschrift</label>
                      <input
                        type="text"
                        value={billingData.address}
                        onChange={(e) => saveBillingData({...billingData, address: e.target.value})}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Straße Hausnummer"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="w-20">
                        <label className="block text-xs font-medium text-gray-700 mb-1">PLZ</label>
                        <input
                          type="text"
                          value={billingData.postalCode}
                          onChange={(e) => saveBillingData({...billingData, postalCode: e.target.value})}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="12345"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Ort</label>
                        <input
                          type="text"
                          value={billingData.city}
                          onChange={(e) => saveBillingData({...billingData, city: e.target.value})}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Berlin"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Telefon</label>
                      <input
                        type="tel"
                        value={billingData.phone}
                        onChange={(e) => saveBillingData({...billingData, phone: e.target.value})}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="+49 30 12345678"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Steuer-ID</label>
                      <input
                        type="text"
                        value={billingData.taxId}
                        onChange={(e) => saveBillingData({...billingData, taxId: e.target.value})}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="DE123456789"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">E-Mail</label>
                      <input
                        type="email"
                        value={billingData.email}
                        onChange={(e) => saveBillingData({...billingData, email: e.target.value})}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="rechnung@beispiel.de"
                      />
                    </div>
                  </div>
                </div>

                {/* Area 2: Subscription */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 border-b pb-2">SUBSCRIPTION</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-blue-600">{subscriptionData.plan}</p>
                      <p className="text-xs text-gray-600">Status: {subscriptionData.status}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-900">
                        {new Date(subscriptionData.nextBilling).toLocaleDateString('de-DE')}
                      </p>
                      <p className="text-xs text-gray-600">
                        {subscriptionData.status === 'Trial' ? 'Trial endet' : 'Nächste Abbuchung'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <button className="w-full px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
                        Plan Upgraden
                      </button>
                      <button className="w-full px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors">
                        Zahlung ändern
                      </button>
                    </div>
                  </div>
                </div>

                {/* Area 3: Format & Region */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 border-b pb-2">FORMAT & REGION</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Sprache</label>
                      <select
                        value={formatData.language}
                        onChange={(e) => saveFormatData({...formatData, language: e.target.value})}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="de-DE">Deutsch</option>
                        <option value="en-US">English</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Zeitzone</label>
                      <select
                        value={formatData.timezone}
                        onChange={(e) => saveFormatData({...formatData, timezone: e.target.value})}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Europe/Berlin">Europe/Berlin</option>
                        <option value="Europe/London">Europe/London</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Währung</label>
                      <select
                        value={formatData.currency}
                        onChange={(e) => saveFormatData({...formatData, currency: e.target.value})}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Area 4: Artist Information */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 border-b pb-2">ARTIST INFORMATION</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Anzeigename</label>
                      <input
                        type="text"
                        value={artistData.displayName}
                        onChange={(e) => setArtistData({...artistData, displayName: e.target.value})}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Artist Name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Kürzel</label>
                      <input
                        type="text"
                        value={artistData.shortCode}
                        onChange={(e) => setArtistData({...artistData, shortCode: e.target.value})}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="ABC"
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Homebase</label>
                      <input
                        type="text"
                        value={artistData.homebase}
                        onChange={(e) => setArtistData({...artistData, homebase: e.target.value})}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Stadt, Land"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Genre</label>
                      <input
                        type="text"
                        value={artistData.genre}
                        onChange={(e) => setArtistData({...artistData, genre: e.target.value})}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Rock, Pop"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={async () => {
                    await Promise.all([
                      saveArtistData(artistData),
                      updateTenantBilling({
                        company:    billingData.company,
                        firstName:  billingData.firstName,
                        lastName:   billingData.lastName,
                        address:    billingData.address,
                        postalCode: billingData.postalCode,
                        city:       billingData.city,
                        phone:      billingData.phone,
                        taxId:      billingData.taxId,
                        email:      billingData.email,
                      }),
                      updateUserFormat({
                        language: formatData.language,
                        timezone: formatData.timezone,
                        currency: formatData.currency,
                      }),
                    ])
                    showSaved()
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Alle speichern
                </button>
                {savedFeedback && (
                  <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                    <CheckCircleIcon className="w-4 h-4" />
                    {savedFeedback}
                  </span>
                )}
              </div>
            </div>
          </div>
        )

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
                Darstellung
              </h3>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-600">Aussehen & Layout-Einstellungen werden hier implementiert...</p>
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
                Benachrichtigungen
              </h3>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-600">Benachrichtigungseinstellungen werden hier implementiert...</p>
              </div>
            </div>
          </div>
        )

      case 'contacts':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UsersIcon className="w-5 h-5" />
                Funktionen
              </h3>
              <FunktionenSettings />
            </div>
          </div>
        )

      case 'guestlist':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserPlusIcon className="w-5 h-5" />
                Gästeliste
              </h3>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-600">Gästenliste & VIPs werden hier implementiert...</p>
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
                Daysheet
              </h3>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-600">Tagespläne & Routinen werden hier implementiert...</p>
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className="text-center py-8">
            <div className="text-gray-500">Bereich nicht gefunden</div>
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
// UserProfil Component
// ============================================================

function UserProfil() {
  const currentUser = getCurrentUser()
  const [currentTenant, setCurrentTenant] = useState(getCurrentTenant())
  const isAdmin = isAdminRole(currentTenant?.role ?? '')

  // Profil-Daten
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
  const [profileData, setProfileData] = useState<ProfileData>(emptyProfile)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    // Beide parallel laden: System-Rolle aus DB + Kontaktdaten
    Promise.all([
      getMyRole().catch(() => currentTenant?.role ?? ''),
      getMyContact(),
    ]).then(([freshRole, contact]) => {
      // Session-Cache aktualisieren falls Rolle veraltet
      if (freshRole && freshRole !== currentTenant?.role) {
        updateCurrentTenantRole(freshRole)
        setCurrentTenant(t => t ? { ...t, role: freshRole } : t)
      }
      // accessRights immer aus der echten System-Rolle befüllen
      const roleLabel = ROLE_LABELS[freshRole as TenantRole] ?? freshRole ?? ''
      // Namen aus Contacts in localStorage korrigieren (falls beim Invite falsch eingegeben)
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
      setProfileData({
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
      })
    }).catch(() => {}).finally(() => setProfileLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleProfileSave = async (data: ProfileData) => {
    setProfileData(data)
    await updateMyContact({
      firstName: data.firstName, lastName: data.lastName, function1: data.function1,
      function2: data.function2, function3: data.function3, specification: data.specification,
      accessRights: data.accessRights, email: data.email, phone: data.phone,
      mobile: data.mobile, address: data.address, postalCode: data.postalCode,
      residence: data.residence, taxId: data.taxId, website: '', birthDate: data.birthDate,
      gender: data.gender, pronouns: data.pronouns, birthPlace: data.birthPlace,
      nationality: data.nationality, idNumber: data.idNumber, socialSecurity: data.socialSecurity,
      diet: data.diet, glutenFree: data.glutenFree, lactoseFree: data.lactoseFree,
      allergies: data.allergies, emergencyContact: data.emergencyContact,
      emergencyPhone: data.emergencyPhone, shirtSize: data.shirtSize,
      hoodieSize: data.hoodieSize, pantsSize: data.pantsSize, shoeSize: data.shoeSize,
      languages: data.languages, driversLicense: data.driversLicense, railcard: data.railcard,
      frequentFlyer: data.frequentFlyer, bankAccount: data.bankAccount,
      bankIban: data.bankIban, bankBic: data.bankBic, taxNumber: data.taxNumber,
      vatId: data.vatId, notes: data.specialNotes, hotelInfo: data.hotelInfo,
      hotelAlias: data.hotelAlias, crewToolActive: data.crewToolActive,
    } as ContactFormData)
  }

  // Passwort
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [showPwForm, setShowPwForm] = useState(false)

  const handlePwChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)
    if (pwForm.next !== pwForm.confirm) { setPwError('Passwörter stimmen nicht überein'); return }
    if (pwForm.next.length < 6) { setPwError('Mindestens 6 Zeichen'); return }
    setPwSaving(true)
    try {
      await changePassword(pwForm.current, pwForm.next)
      setPwSuccess(true)
      setPwForm({ current: '', next: '', confirm: '' })
      setShowPwForm(false)
    } catch (e: any) {
      setPwError(e?.message ?? 'Fehler')
    } finally {
      setPwSaving(false)
    }
  }

  const displayFirst = profileData.firstName || currentUser?.firstName || ''
  const displayLast = profileData.lastName || currentUser?.lastName || ''
  const initials = `${displayFirst[0] ?? ''}${displayLast[0] ?? ''}`.toUpperCase() || '?'

  if (profileLoading) return (
    <div className="flex items-center gap-2 text-gray-500 text-sm py-8">
      <Loader2 className="animate-spin w-4 h-4" /> Wird geladen…
    </div>
  )

  return (
    <div className="flex gap-6 items-start">

      {/* Linke Spalte: Avatar + Kurzinfo */}
      <div className="w-44 flex-shrink-0 flex flex-col items-center gap-3 pt-1">
        {/* Avatar */}
        <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-semibold select-none">
          {initials}
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            {displayFirst} {displayLast}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{profileData.email || currentUser?.email}</p>
          <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {ROLE_LABELS[currentTenant?.role as TenantRole] ?? currentTenant?.role}
          </span>
        </div>
        <p className="text-xs text-gray-400 italic text-center mt-1">Profilbild folgt</p>
      </div>

      {/* Mittlere Spalte: Profildaten */}
      <div className="flex-1 min-w-0">
        <ProfileEditor
          isOpen={true}
          onClose={() => {}}
          profileData={profileData}
          onSave={handleProfileSave}
          isAdmin={isAdmin}
          isSelf={true}
          inline={true}
        />
      </div>

      {/* Rechte Spalte: Passwort */}
      <div className="w-56 flex-shrink-0">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Passwort
          </h4>
          <form onSubmit={handlePwChange} className="space-y-2.5">
            {pwError && <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{pwError}</div>}
            {pwSuccess && <div className="p-2 bg-green-50 border border-green-200 rounded text-green-700 text-xs">Gespeichert.</div>}
            {(['current','next','confirm'] as const).map((key, i) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">
                  {['Aktuell','Neu','Bestätigen'][i]}
                </label>
                <input
                  type="password"
                  value={pwForm[key]}
                  onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                  required
                  minLength={key !== 'current' ? 6 : undefined}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <button
              type="submit"
              disabled={pwSaving}
              className="w-full mt-1 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              {pwSaving ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : null}
              Speichern
            </button>
          </form>
        </div>
      </div>

    </div>
  )
}

// ============================================================
// UserManagement Component
// ============================================================

const USER_COLS: [string, keyof TenantUser][] = [
  ['Vorname', 'firstName'],
  ['Nachname', 'lastName'],
  ['E-Mail', 'email'],
  ['Rolle', 'role'],
]

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
  const filtered = users.filter(u =>
    `${u.firstName} ${u.lastName} ${u.email} ${u.role}`
      .toLowerCase().includes(searchTerm.toLowerCase())
  )
  const { sortKey, sortDir, sorted, toggleSort } = useSortable(
    filtered as unknown as Record<string, unknown>[],
    'lastName'
  )

  return (
    <div className="data-table-wrapper">
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
                {user.id === currentUserId && (
                  <span className="ml-1 text-xs text-blue-500">(du)</span>
                )}
              </td>
              <td className="font-medium">
                {user.lastName}
                {user.memberStatus === 'inactive' && (
                  <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">inaktiv</span>
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
              <td className="text-center">
                <div className="flex items-center justify-center gap-1">
                  {/* E-Mail ändern */}
                  <button
                    onClick={e => { e.stopPropagation(); onEditEmail(user) }}
                    className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                    title="E-Mail ändern"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  {/* Passwort setzen */}
                  <button
                    onClick={e => { e.stopPropagation(); onEditPassword(user) }}
                    className="p-1 text-gray-400 hover:text-yellow-500 transition-colors"
                    title="Passwort setzen"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </button>
                  {/* Aktivieren / Deaktivieren */}
                  {user.id !== currentUserId ? (
                    <button
                      onClick={e => { e.stopPropagation(); onToggleStatus(user.id) }}
                      className={`p-1 transition-colors ${user.memberStatus === 'inactive' ? 'text-green-500 hover:text-green-600' : 'text-gray-400 hover:text-orange-500'}`}
                      title={user.memberStatus === 'inactive' ? 'Aktivieren' : 'Deaktivieren'}
                    >
                      {user.memberStatus === 'inactive' ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                  ) : (
                    <span className="inline-block w-6 h-6" />
                  )}
                  {/* User entfernen */}
                  {user.id !== currentUserId ? (
                    <button
                      onClick={e => { e.stopPropagation(); onRemove(user.id) }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Entfernen"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="inline-block w-6 h-6" />
                  )}
                </div>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-gray-400 text-xs py-4">Keine Ergebnisse</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

interface ModalUser { userId: number; name: string; currentEmail: string }

function UserManagement() {
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
    if (!user.contactId) return
    setProfileLoading(true)
    try {
      const c = await getContact(user.contactId)
      setProfileContact(c)
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
    if (!emailValue.includes('@')) { setEmailError('Ungültige E-Mail'); return }
    if (emailValue.trim().toLowerCase() === emailModal.currentEmail.toLowerCase()) { setEmailError('Keine Änderung'); return }
    setEmailSaving(true); setEmailError(''); setEmailSuccess('')
    try {
      await adminSetUserEmail(emailModal.userId, emailValue.trim())
      setUsers(prev => prev.map(u => u.id === emailModal.userId ? { ...u, email: emailValue.trim() } : u))
      setEmailSuccess('Gespeichert.')
      setEmailModal(m => m ? { ...m, currentEmail: emailValue.trim() } : m)
    } catch (e: any) { setEmailError(e?.message ?? 'Fehler') } finally { setEmailSaving(false) }
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
    if (pwValue.length < 6) { setPwError('Mindestens 6 Zeichen'); return }
    if (pwValue !== pwConfirm) { setPwError('Passwörter stimmen nicht überein'); return }
    setPwSaving(true); setPwError(''); setPwSuccess('')
    try {
      await adminSetUserPassword(pwModal.userId, pwValue)
      setPwSuccess('Passwort gesetzt.')
      setPwValue(''); setPwConfirm('')
    } catch (e: any) { setPwError(e?.message ?? 'Fehler') } finally { setPwSaving(false) }
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
      setError(e?.message ?? 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => { load() }, [load])

  const handleRoleChange = async (userId: number, role: TenantRole) => {
    try {
      await updateUserRole(userId, role)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
      if (userId === currentUser?.id) updateCurrentTenantRole(role)
    } catch (e: any) {
      setError(e?.message ?? 'Fehler beim Speichern')
    }
  }

  const handleRemoveUser = async (userId: number) => {
    if (!confirm('User wirklich entfernen?')) return
    try {
      await removeUser(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (e: any) {
      setError(e?.message ?? 'Fehler beim Entfernen')
    }
  }

  const handleToggleStatus = async (userId: number) => {
    try {
      const newStatus = await adminToggleUserStatus(userId)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, memberStatus: newStatus } : u))
    } catch (e: any) {
      setError(e?.message ?? 'Fehler beim Statuswechsel')
    }
  }

  const handleRevokeInvite = async (tokenId: number) => {
    try {
      await revokeInvite(tokenId)
      setPending(prev => prev.filter(p => p.id !== tokenId))
    } catch (e: any) {
      setError(e?.message ?? 'Fehler beim Widerrufen')
    }
  }

  if (!isAdmin) {
    return (
      <div className="bg-gray-50 rounded-lg p-6">
        <p className="text-gray-500 text-sm">Nur Admins können Benutzer verwalten.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <UserGroupIcon className="w-5 h-5" />
          Benutzer-Verwaltung
        </h3>
        <p className="text-sm text-gray-500">
          Neue Mitglieder über <strong>Kontakte → Zugang-Icon</strong> einladen.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
          <Loader2 className="animate-spin w-4 h-4" /> Wird geladen…
        </div>
      ) : (
        <>
          {/* Aktive User */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700">Aktive Mitglieder</h4>
              <input
                type="text"
                placeholder="Suchen..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
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
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Offene Einladungen</h4>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vorname</th>
                      <th>Nachname</th>
                      <th>E-Mail</th>
                      <th>Rolle</th>
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
                          <button
                            onClick={() => handleRevokeInvite(inv.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            title="Widerrufen"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
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
              <h3 className="text-base font-semibold text-gray-900">E-Mail — {emailModal.name}</h3>
              <button onClick={closeEmailModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {emailError && <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{emailError}</div>}
            {emailSuccess && <div className="p-2 bg-green-50 border border-green-200 rounded text-green-700 text-xs">{emailSuccess}</div>}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">E-Mail</label>
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
              <button onClick={closeEmailModal} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Abbrechen</button>
              <button onClick={handleEmailSave} disabled={emailSaving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                {emailSaving ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : null}
                Speichern
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
              <h3 className="text-base font-semibold text-gray-900">Passwort — {pwModal.name}</h3>
              <button onClick={closePwModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {pwError && <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{pwError}</div>}
            {pwSuccess && <div className="p-2 bg-green-50 border border-green-200 rounded text-green-700 text-xs">{pwSuccess}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Neues Passwort</label>
                <input type="password" value={pwValue} onChange={e => setPwValue(e.target.value)} autoFocus placeholder="Mindestens 6 Zeichen"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Bestätigen</label>
                <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePwSave()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closePwModal} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Abbrechen</button>
              <button onClick={handlePwSave} disabled={pwSaving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                {pwSaving ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : null}
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
