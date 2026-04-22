'use client'

import { useState, useEffect } from 'react'
import { Edit, X, KeyRound, Loader2, Save } from 'lucide-react'
import { ProfileEditor, ProfileData as EditorProfileData } from '@/app/components/shared/ProfileEditor'
import { Communication } from '@/app/components/shared/Communication'
import { FileCard } from '@/app/components/shared/FileCard'
import ContentBoard from '@/app/components/shared/ContentBoard'
import GlobalTodoOverview from '@/app/components/shared/GlobalTodoOverview'
import { getCurrentUser, getCurrentTenant, getMyContact, getMyRole, updateMyContact, changeMyPassword, isAdminRole, isEditorRole, getEffectiveRole, updateCurrentTenantRole, canDo, CAN_EDIT_ANKUENDIGUNG, ROLE_LABELS, type TenantRole } from '@/lib/api-client'
import { AccordionSection } from '@/app/components/shared/AccordionSection'

// Helper functions for localStorage (user-scoped keys)
const loadFromFile = async (key: string): Promise<string | null> => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(key)
  }
  return null
}

const saveToFile = async (key: string, content: string): Promise<void> => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, content)
  }
}

export default function SchreibtischModule() {
  const effectiveRole = getEffectiveRole()
  const isAdmin    = isAdminRole(effectiveRole)
  const isEditor   = isEditorRole(effectiveRole)   // admin + agency + tourmanagement
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  // Get real user from session
  const currentUser = getCurrentUser()
  const currentUserId = currentUser ? String(currentUser.id) : 'unknown'

  const [profileData, setProfileData] = useState<EditorProfileData>({
    firstName: currentUser?.firstName || '',
    lastName: currentUser?.lastName || '',
    email: currentUser?.email || '',
    phone: '',
    mobile: '',
    residence: '',
    postalCode: '',
    address: '',
    birthDate: '',
    gender: '',
    pronouns: '',
    birthPlace: '',
    nationality: '',
    idNumber: '',
    taxId: '',
    socialSecurity: '',
    function1: '',
    function2: '',
    function3: '',
    diet: 'alles',
    glutenFree: false,
    lactoseFree: false,
    allergies: '',
    specialNotes: '',
    shirtSize: '',
    hoodieSize: '',
    pantsSize: '',
    shoeSize: '',
    specification: '',
    languages: '',
    emergencyContact: '',
    emergencyPhone: '',
    hotelInfo: '',
    hotelAlias: '',
    accessRights: '',
    personalFiles: [],
    bankAccount: '',
    bankIban: '',
    driversLicense: '',
    railcard: '',
    frequentFlyer: '',
    bankBic: '',
    taxNumber: '',
    vatId: '',
    crewToolActive: true
  })

  // User-scoped localStorage keys so each user has their own data
  const profileKey = `profileData_${currentUserId}`
  useEffect(() => {
    const loadData = async () => {
      try {
        // Profil vom eigenen Kontakt-Eintrag laden
        try {
          const [contact, freshRole] = await Promise.all([
            getMyContact(),
            getMyRole().catch(() => getCurrentTenant()?.role ?? ''),
          ])
          if (freshRole && freshRole !== getCurrentTenant()?.role) {
            updateCurrentTenantRole(freshRole)
          }
          const roleLabel = ROLE_LABELS[freshRole as TenantRole] ?? freshRole ?? ''
          setProfileData(prev => ({
            ...prev,
            firstName: (contact.firstName as string) || prev.firstName,
            lastName: (contact.lastName as string) || prev.lastName,
            email: (contact.email as string) || prev.email,
            phone: contact.phone || '',
            mobile: contact.mobile || '',
            address: contact.address || '',
            postalCode: contact.postalCode || '',
            residence: contact.residence || '',
            birthDate: contact.birthDate || '',
            gender: contact.gender || '',
            pronouns: contact.pronouns || '',
            birthPlace: contact.birthPlace || '',
            nationality: contact.nationality || '',
            idNumber: contact.idNumber || '',
            taxId: contact.taxId || '',
            socialSecurity: contact.socialSecurity || '',
            taxNumber: contact.taxNumber || '',
            vatId: contact.vatId || '',
            diet: contact.diet || 'alles',
            glutenFree: Boolean(contact.glutenFree),
            lactoseFree: Boolean(contact.lactoseFree),
            allergies: contact.allergies || '',
            specialNotes: contact.notes || '',
            emergencyContact: contact.emergencyContact || '',
            emergencyPhone: contact.emergencyPhone || '',
            shirtSize: contact.shirtSize || '',
            hoodieSize: contact.hoodieSize || '',
            pantsSize: contact.pantsSize || '',
            shoeSize: contact.shoeSize || '',
            hotelInfo: contact.hotelInfo || '',
            hotelAlias: contact.hotelAlias || '',
            languages: contact.languages || '',
            driversLicense: contact.driversLicense || '',
            railcard: contact.railcard || '',
            frequentFlyer: contact.frequentFlyer || '',
            bankAccount: contact.bankAccount || '',
            bankIban: contact.bankIban || '',
            bankBic: contact.bankBic || '',
            function1: contact.function1 || '',
            function2: contact.function2 || '',
            function3: contact.function3 || '',
            specification: contact.specification || '',
            accessRights: roleLabel,
            crewToolActive: contact.crewToolActive !== false,
            personalFiles: [],
          }))
        } catch {
          // Fallback auf localStorage
          const savedProfile = await loadFromFile(profileKey) || await loadFromFile('profileData')
          if (savedProfile) {
            const parsed = JSON.parse(savedProfile)
            setProfileData(prev => ({ ...prev, ...parsed, personalFiles: parsed.personalFiles || [] }))
          }
        }

        // Pinnwand aus Backend laden
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }

    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId])

  const handleProfileSave = async (updatedProfile: EditorProfileData) => {
    setProfileData(updatedProfile)
    try {
      await updateMyContact({
        firstName: updatedProfile.firstName,
        lastName: updatedProfile.lastName,
        function1: updatedProfile.function1,
        function2: updatedProfile.function2,
        function3: updatedProfile.function3,
        specification: updatedProfile.specification,
        accessRights: updatedProfile.accessRights,
        email: updatedProfile.email,
        phone: updatedProfile.phone,
        mobile: updatedProfile.mobile,
        address: updatedProfile.address,
        postalCode: updatedProfile.postalCode,
        residence: updatedProfile.residence,
        taxId: updatedProfile.taxId,
        website: '',
        birthDate: updatedProfile.birthDate,
        gender: updatedProfile.gender,
        pronouns: updatedProfile.pronouns,
        birthPlace: updatedProfile.birthPlace,
        nationality: updatedProfile.nationality,
        idNumber: updatedProfile.idNumber,
        socialSecurity: updatedProfile.socialSecurity,
        diet: updatedProfile.diet,
        glutenFree: updatedProfile.glutenFree,
        lactoseFree: updatedProfile.lactoseFree,
        allergies: updatedProfile.allergies,
        emergencyContact: updatedProfile.emergencyContact,
        emergencyPhone: updatedProfile.emergencyPhone,
        shirtSize: updatedProfile.shirtSize,
        hoodieSize: updatedProfile.hoodieSize,
        pantsSize: updatedProfile.pantsSize,
        shoeSize: updatedProfile.shoeSize,
        languages: updatedProfile.languages,
        driversLicense: updatedProfile.driversLicense,
        railcard: updatedProfile.railcard,
        frequentFlyer: updatedProfile.frequentFlyer,
        bankAccount: updatedProfile.bankAccount,
        bankIban: updatedProfile.bankIban,
        bankBic: updatedProfile.bankBic,
        taxNumber: updatedProfile.taxNumber,
        vatId: updatedProfile.vatId,
        crewToolActive: updatedProfile.crewToolActive,
        hourlyRate: 0,
        dailyRate: 0,
        notes: updatedProfile.specialNotes,
        hotelInfo: '',
        hotelAlias: '',
      })
    } catch (err) {
      console.error('Profil-Speichern fehlgeschlagen:', err)
    }
  }

  const handlePasswordSave = async () => {
    setPasswordError('')
    setPasswordSuccess(false)
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError('Neue Passwörter stimmen nicht überein')
      return
    }
    if (passwordForm.next.length < 6) {
      setPasswordError('Passwort muss mindestens 6 Zeichen lang sein')
      return
    }
    setPasswordSaving(true)
    try {
      await changeMyPassword(passwordForm.current, passwordForm.next)
      setPasswordSuccess(true)
      setPasswordForm({ current: '', next: '', confirm: '' })
      setTimeout(() => { setIsPasswordModalOpen(false); setPasswordSuccess(false) }, 1500)
    } catch (e: any) {
      setPasswordError(e?.message ?? 'Fehler beim Ändern des Passworts')
    } finally {
      setPasswordSaving(false)
    }
  }

  const formatBirthDate = (dateString: string) => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      })
    } catch {
      return dateString
    }
  }

  const formatDietaryInfo = (profile: EditorProfileData) => {
    const dietary = []
    // Immer die Ernährungsweise anzeigen
    if (profile.diet) {
      dietary.push(profile.diet === 'alles' ? 'alles' : profile.diet)
    } else {
      dietary.push('alles')
    }
    if (profile.glutenFree) dietary.push('glutenfrei')
    if (profile.lactoseFree) dietary.push('laktosefrei')
    return dietary.join(', ')
  }

  return (
    <>
      {/* Datum Zeile */}
      <div className="mb-2 md:mb-4">
        <div className="text-lg font-medium text-gray-700 text-center">
          {new Date().toLocaleDateString('de-DE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>

      {/* ── MOBILE: Accordion ── */}
      <div className="md:hidden flex flex-col gap-2">
        <AccordionSection title="Ankündigung" defaultOpen>
          <ContentBoard
            entityType="desk"
            entityId="announcement"
            title=""
            isAdmin={canDo(effectiveRole, CAN_EDIT_ANKUENDIGUNG)}
            singleItem
            hideEmptyButton
            allowDelete={false}
            modalTitle={{ new: 'Ankündigung erstellen', edit: 'Ankündigung bearbeiten' }}
            titlePlaceholder="Titel der Ankündigung"
            newItemLabel="Ankündigung erstellen"
            defaultContent={{
              title: 'Willkommen bei ProTouring 👋',
              content: 'Hier kannst du aktuelle Infos, Ankündigungen oder Hinweise für dein Team hinterlegen.'
            }}
          />
        </AccordionSection>

        <AccordionSection title="Offene Aufgaben" defaultOpen>
          <div className="p-1">
            <GlobalTodoOverview hideHeader />
          </div>
        </AccordionSection>

        <AccordionSection title="Persönliche Notizen" defaultOpen>
          <div className="p-3">
            <ContentBoard
              entityType="desk_personal"
              entityId={currentUserId}
              title=""
              isAdmin={true}
              singleItem
              hideEmptyButton
              allowDelete={false}
              fixedTitle="Persönliche Notizen"
              showTitleField={false}
              modalTitle={{ new: 'Notiz bearbeiten', edit: 'Notiz bearbeiten' }}
              newItemLabel="Notiz erstellen"
              defaultContent={{ title: 'Persönliche Notizen', content: '' }}
            />
          </div>
        </AccordionSection>

        <AccordionSection title="Dein Profil">
          <div className="px-4 py-3 text-sm space-y-1">
            <div className="font-medium text-gray-900">{profileData.firstName} {profileData.lastName}</div>
            <div className="text-gray-500">{profileData.email}</div>
            {profileData.phone && <div className="text-gray-500">{profileData.phone}</div>}
            {profileData.function1 && (
              <div className="text-gray-500">{[profileData.function1, profileData.function2, profileData.function3].filter(Boolean).join(', ')}</div>
            )}
          </div>
        </AccordionSection>

        <AccordionSection title="Pinnwand">
          <div className="p-3">
            <ContentBoard
              entityType="desk"
              entityId="notice_board"
              title=""
              isAdmin={isAdmin}
              modalTitle={{ new: 'Neue Mitteilung', edit: 'Mitteilung bearbeiten' }}
              titlePlaceholder="Titel der Mitteilung"
              newItemLabel="Neue Mitteilung"
            />
          </div>
        </AccordionSection>

        {effectiveRole !== 'guest' && (
          <AccordionSection title="Allgemeine Dateien">
            <FileCard
              title=""
              entityType="desk"
              entityId="shared"
              category="general"
              maxFiles={10}
              maxFileSizeMB={50}
              canManage={isEditor}
            />
          </AccordionSection>
        )}

        {effectiveRole !== 'guest' && (
          <AccordionSection title="Persönliche Dateien">
            <FileCard
              title=""
              entityType="desk"
              entityId={currentUserId}
              category="personal"
              maxFiles={10}
              maxFileSizeMB={20}
              canManage={true}
            />
          </AccordionSection>
        )}

        <AccordionSection title="Allgemeiner Chat" defaultOpen>
          <Communication
            entityType="desk"
            entityId="general"
            showHeader={false}
            className="h-64"
          />
        </AccordionSection>
      </div>

      {/* ── DESKTOP: Grid ── */}
      {/* Zeile 1: 4 Spalten */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        
        {/* DEIN PROFIL Section */}
        <div className="pt-card h-[400px] flex flex-col">
          <div className="pt-card-header">
            <span className="pt-card-title">Dein Profil</span>
          </div>
          <div className="flex-1 overflow-y-auto text-sm pt-card-body">
            <div className="space-y-2">
              <div>
                <span className="font-medium">{profileData.firstName} {profileData.lastName}</span>
              </div>
              <div className="text-gray-600">
                <div>{profileData.email}</div>
                <div>{profileData.phone}</div>
                {profileData.mobile && <div>{profileData.mobile}</div>}
              </div>
              <div className="text-gray-600">
                <div>{profileData.address}</div>
                <div>{profileData.postalCode} {profileData.residence}</div>
              </div>
              {profileData.birthDate && (
                <div className="text-gray-600">
                  <div>Geburtstag: {formatBirthDate(profileData.birthDate)}</div>
                </div>
              )}
              {profileData.birthDate && <hr className="border-gray-200 my-2" />}
              {profileData.function1 && (
                <div className="text-gray-600">
                  <div>Funktionen: {[
                    profileData.function1,
                    profileData.function2,
                    profileData.function3
                  ].filter(Boolean).join(', ')}</div>
                </div>
              )}
              <hr className="border-gray-200 my-2" />
              <div className="text-gray-600">
                <div>Ernährung: {formatDietaryInfo(profileData)}</div>
              </div>
              {profileData.allergies && (
                <div className="text-gray-600">
                  <div>Allergien: {profileData.allergies}</div>
                </div>
              )}
              {profileData.specialNotes && (
                <div className="text-gray-600">
                  <div>Besonderheiten: {profileData.specialNotes}</div>
                </div>
              )}
              {profileData.emergencyContact && (
                <div className="text-gray-600">
                  <div>Notfallkontakt: {profileData.emergencyContact}</div>
                  {profileData.emergencyPhone && <div>{profileData.emergencyPhone}</div>}
                </div>
              )}
              <div className="pt-2 border-t">
                <div className="flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-2 ${profileData.crewToolActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="text-xs">Crew Tool {profileData.crewToolActive ? 'aktiv' : 'inaktiv'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CREW INFOS — editierbar für Admin/Agency/Tourmanagement, alle lesen */}
        <div className="pt-card h-[400px] flex flex-col">
          <ContentBoard
            entityType="desk"
            entityId="announcement"
            title=""
            isAdmin={canDo(effectiveRole, CAN_EDIT_ANKUENDIGUNG)}
            singleItem
            hideEmptyButton
            allowDelete={false}
            modalTitle={{ new: 'Ankündigung erstellen', edit: 'Ankündigung bearbeiten' }}
            titlePlaceholder="Titel der Ankündigung"
            newItemLabel="Ankündigung erstellen"
            defaultContent={{
              title: 'Willkommen bei ProTouring 👋',
              content: 'Hier kannst du aktuelle Infos, Ankündigungen oder Hinweise für dein Team hinterlegen. Admins, Tourmanager und Agencies können diesen Text bearbeiten.'
            }}
            className="flex-1"
          />
        </div>

        {/* ALLGEMEINE DATEIEN – Gast sieht "Kein Zugriff", 4-6 nur lesen, 1-3 verwalten */}
        {effectiveRole !== 'guest' ? (
          <FileCard
            title="ALLGEMEINE DATEIEN"
            entityType="desk"
            entityId="shared"
            category="general"
            maxFiles={10}
            maxFileSizeMB={50}
            className="h-[400px]"
            canManage={isEditor}
          />
        ) : (
          <div className="pt-card h-[400px] flex flex-col">
            <div className="pt-card-header"><span className="pt-card-title">Allgemeine Dateien</span></div>
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Kein Zugriff</div>
          </div>
        )}

        {/* PERSÖNLICHE DATEIEN – Gast sieht "Kein Zugriff", alle anderen verwalten ihre eigenen */}
        {effectiveRole !== 'guest' ? (
          <FileCard
            title="PERSÖNLICHE DATEIEN"
            entityType="desk"
            entityId={currentUserId}
            category="personal"
            maxFiles={10}
            maxFileSizeMB={20}
            className="h-[400px]"
            canManage={true}
          />
        ) : (
          <div className="pt-card h-[400px] flex flex-col">
            <div className="pt-card-header"><span className="pt-card-title">Persönliche Dateien</span></div>
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Kein Zugriff</div>
          </div>
        )}
      </div>

      {/* Zeile 2: 4 Spalten */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* ALLGEMEINE KONVERSATION Section */}
        <div className="pt-card h-[400px] flex flex-col">
          <div className="flex-1 min-h-0">
            <Communication
              title="Allgemeine Konversation"
              entityType="desk"
              entityId="general"
              className="h-full"
            />
          </div>
        </div>

        {/* PINNWAND — ContentBoard (identisch zu Zeitplan-Kacheln) */}
        <div className="pt-card h-[400px] flex flex-col">
          <div className="pt-card-header">
            <span className="pt-card-title">Pinnwand</span>
          </div>
          <div className="flex-1 overflow-y-auto pt-card-body space-y-3">
            <ContentBoard
              entityType="desk"
              entityId="notice_board"
              title=""
              isAdmin={isAdmin}
              modalTitle={{ new: 'Neue Mitteilung', edit: 'Mitteilung bearbeiten' }}
              titlePlaceholder="Titel der Mitteilung"
              newItemLabel="Neue Mitteilung"
            />
          </div>
        </div>

        {/* OFFENE AUFGABEN — globale Todo-Übersicht */}
        <div className="pt-card h-[400px] flex flex-col">
          <GlobalTodoOverview />
        </div>

        {/* PERSÖNLICHE NOTIZEN — pro User, nur für eingeloggten User sichtbar */}
        <div className="pt-card h-[400px] flex flex-col">
          <ContentBoard
            entityType="desk_personal"
            entityId={currentUserId}
            title=""
            isAdmin={true}
            singleItem
            hideEmptyButton
            allowDelete={false}
            fixedTitle="Persönliche Notizen"
            showTitleField={false}
            modalTitle={{ new: 'Notiz bearbeiten', edit: 'Notiz bearbeiten' }}
            newItemLabel="Notiz erstellen"
            defaultContent={{ title: 'Persönliche Notizen', content: '' }}
            className="flex-1"
          />
        </div>
      </div>

      {/* Passwort-Ändern-Modal */}
      {isPasswordModalOpen && (
        <div className="modal-overlay">
          <div className="modal-container max-w-sm">
            <div className="modal-header">
              <h2 className="modal-title">Passwort ändern</h2>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body space-y-4">
              {passwordError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{passwordError}</div>
              )}
              {passwordSuccess && (
                <div className="p-2 bg-green-50 border border-green-200 rounded text-green-700 text-xs">Passwort erfolgreich geändert ✓</div>
              )}
              <div>
                <label className="form-label">Aktuelles Passwort</label>
                <input type="password" value={passwordForm.current} onChange={e => setPasswordForm(f => ({ ...f, current: e.target.value }))} className="form-input" />
              </div>
              <div>
                <label className="form-label">Neues Passwort</label>
                <input type="password" value={passwordForm.next} onChange={e => setPasswordForm(f => ({ ...f, next: e.target.value }))} className="form-input" placeholder="Mindestens 6 Zeichen" />
              </div>
              <div>
                <label className="form-label">Neues Passwort bestätigen</label>
                <input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))} className="form-input" />
              </div>
            </div>
            <div className="modal-footer">
              <div />
              <div className="flex gap-2">
                <button onClick={() => setIsPasswordModalOpen(false)} className="btn btn-ghost">Abbrechen</button>
                <button onClick={handlePasswordSave} disabled={passwordSaving} className="btn btn-primary disabled:opacity-50">
                  {passwordSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Editor Modal */}
      {isProfileEditorOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Profil bearbeiten</h2>
              <button
                onClick={() => setIsProfileEditorOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <ProfileEditor
              isOpen={isProfileEditorOpen}
              onClose={() => setIsProfileEditorOpen(false)}
              profileData={profileData}
              onSave={handleProfileSave}
              isAdmin={isAdmin}
              isSelf={true}
              onDelete={() => {
                // Reset profile data to default values
                const defaultProfile = {
                  firstName: '',
                  lastName: '',
                  email: '',
                  phone: '',
                  mobile: '',
                  residence: '',
                  postalCode: '',
                  address: '',
                  birthDate: '',
                  gender: '',
                  pronouns: '',
                  birthPlace: '',
                  nationality: '',
                  idNumber: '',
                  taxId: '',
                  socialSecurity: '',
                  function1: '',
                  function2: '',
                  function3: '',
                  diet: 'alles',
                  glutenFree: false,
                  lactoseFree: false,
                  allergies: '',
                  specialNotes: '',
                  shirtSize: '',
                  hoodieSize: '',
                  pantsSize: '',
                  shoeSize: '',
                  specification: '',
                  languages: '',
                  emergencyContact: '',
                  emergencyPhone: '',
                  hotelInfo: '',
                  hotelAlias: '',
                  accessRights: '',
                  personalFiles: [],
                  bankAccount: '',
                  bankIban: '',
                  driversLicense: '',
                  railcard: '',
                  frequentFlyer: '',
                  bankBic: '',
                  taxNumber: '',
                  vatId: '',
                  crewToolActive: true
                }
                setProfileData(defaultProfile)
                saveToFile(profileKey, JSON.stringify(defaultProfile))
              }}
            />
          </div>
        </div>
      )}

    </>
  )
}
