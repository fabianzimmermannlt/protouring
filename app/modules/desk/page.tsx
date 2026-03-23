'use client'

import { useState, useEffect } from 'react'
import { Edit, Upload, File, Trash2, AlertCircle, X } from 'lucide-react'
import { ProfileEditor, ProfileData as EditorProfileData } from '@/components/ProfileEditor'
import { UploadSection } from '@/components/UploadSection'
import { TextSection } from '@/components/TextSection'
import { FreeTextEditor } from '@/components/FreeTextEditor'
import { Communication } from '@/app/components/shared/Communication'
import { FileUpload } from '@/app/components/shared/FileUpload'

// Helper functions for localStorage
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
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isNotesEditorOpen, setIsNotesEditorOpen] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadCategory, setUploadCategory] = useState<'general' | 'personal'>('general')
  
  const [buhneFreiContent, setBuhneFreiContent] = useState({
    title: 'BÜHNE FREI',
    content: '🎭 Willkommen im ProTouring Dashboard!\n\nHier findest du alle wichtigen Informationen und Tools für deine Tour-Management Aufgaben.'
  })
  
  const [personalNotesContent, setPersonalNotesContent] = useState({
    title: 'PERSÖNLICHE NOTIZEN',
    content: '📝 Deine persönlichen Notizen...\n\nHier kannst du wichtige Informationen, Aufgaben oder Gedanken notieren.'
  })
  
  const [profileData, setProfileData] = useState<EditorProfileData>({
    firstName: 'Fabian',
    lastName: 'Zimmermann',
    email: 'fabian@blindpage.de',
    phone: '+49 1749181911',
    mobile: '',
    residence: 'Andernach',
    postalCode: '56626',
    address: '',
    birthDate: '',
    gender: '',
    pronouns: '',
    birthPlace: '',
    nationality: 'deutsch',
    idNumber: '',
    taxId: '',
    socialSecurity: '',
    function1: 'Sound Operating',
    function2: 'Sound Operating FOH',
    function3: '',
    diet: 'alles',
    glutenFree: false,
    lactoseFree: true,
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

  const currentUserId = 'fabianzimmermann'

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load Bühne Frei content
        const savedContent = await loadFromFile('buhneFreiContent')
        if (savedContent) {
          const parsed = JSON.parse(savedContent)
          setBuhneFreiContent(parsed)
        }

        // Load Personal Notes content
        const savedNotes = await loadFromFile('personalNotesContent')
        if (savedNotes) {
          const parsed = JSON.parse(savedNotes)
          setPersonalNotesContent(parsed)
        }

        // Load Profile data
        const savedProfile = await loadFromFile('profileData')
        if (savedProfile) {
          const parsed = JSON.parse(savedProfile)
          setProfileData({
            ...parsed,
            personalFiles: parsed.personalFiles || [],
            generalFiles: parsed.generalFiles || [],
            crewToolActive: parsed.crewToolActive !== false
          })
        }
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }

    loadData()
  }, [])

  const handleProfileSave = async (updatedProfile: EditorProfileData) => {
    setProfileData(updatedProfile)
    await saveToFile('profileData', JSON.stringify(updatedProfile))
  }

  const handleBuhneFreiSave = async (content: { title: string; content: string }) => {
    const updatedContent = { ...buhneFreiContent, ...content }
    setBuhneFreiContent(updatedContent)
    await saveToFile('buhneFreiContent', JSON.stringify(updatedContent))
  }

  const handlePersonalNotesSaveTextSection = async (content: { title: string; content: string }) => {
    const updatedContent = { ...personalNotesContent, ...content }
    setPersonalNotesContent(updatedContent)
    await saveToFile('personalNotesContent', JSON.stringify(updatedContent))
  }

  const handlePersonalNotesSave = async (title: string, content: string) => {
    const updatedContent = { title, content }
    setPersonalNotesContent(updatedContent)
    await saveToFile('personalNotesContent', JSON.stringify(updatedContent))
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

  console.log('DESK - profileData.accessRights:', profileData.accessRights)
  
  return (
    <>
      {/* Datum Zeile */}
      <div className="mb-4">
        <div className="text-lg font-medium text-gray-700 text-center">
          {new Date().toLocaleDateString('de-DE', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Zeile 1: 4 Spalten */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        
        {/* DEIN PROFIL Section */}
        <div className="bg-white rounded-lg border p-4 h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">DEIN PROFIL</h3>
            <button
              onClick={() => setIsProfileEditorOpen(true)}
              className="text-blue-600 hover:text-blue-800 p-1 rounded"
            >
              <Edit className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto text-sm">
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

        {/* BÜHNE FREI Section */}
        <div className="bg-white rounded-lg border p-4 h-[400px] flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <TextSection
              title={buhneFreiContent.title}
              content={buhneFreiContent.content}
              onContentChange={handleBuhneFreiSave}
              storageKey="buhneFreiContent"
              className="h-full"
            />
          </div>
        </div>

        {/* ALLGEMEINE DATEIEN Section */}
        <div className="bg-white rounded-lg border p-4 h-[400px] flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <FileUpload
              title="ALLGEMEINE DATEIEN"
              category="general"
              userId={currentUserId}
              maxFiles={10}
              maxFileSizeMB={50}
              className="h-full"
            />
          </div>
        </div>
        
        {/* PERSÖNLICHE DATEIEN Section */}
        <div className="bg-white rounded-lg border p-4 h-[400px] flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <FileUpload
              title="PERSÖNLICHE DATEIEN"
              category="personal"
              userId={currentUserId}
              maxFiles={10}
              maxFileSizeMB={20}
              className="h-full"
            />
          </div>
        </div>
      </div>

      {/* Zeile 2: 4 Spalten */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* ALLGEMEINE KONVERSATION Section */}
        <div className="bg-white rounded-lg border h-[400px] flex flex-col">
          <div className="flex items-center justify-between p-3">
            <h3 className="text-base font-semibold text-gray-900">ALLGEMEINE KONVERSATION</h3>
            {profileData.accessRights === 'Admin' && (
              <button
                onClick={() => {
                  // Direct localStorage access for deletion
                  if (typeof window !== 'undefined') {
                    if (confirm('Möchten Sie wirklich den gesamten Chat-Verlauf löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
                      localStorage.removeItem('generalConversation')
                      window.location.reload() // Reload to clear the messages
                    }
                  }
                }}
                className="p-2 text-red-500 hover:text-red-700 rounded transition-colors"
                title="Chat-Verlauf löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex-1">
            <Communication 
              title=""
              storageKey="generalConversation"
              className="h-full"
              showHeader={false}
              userName={`${profileData.firstName} ${profileData.lastName}`}
              userRole={profileData.accessRights || 'user'}
            />
          </div>
        </div>

        {/* Freie Section (Platzhalter) */}
        <div className="bg-white rounded-lg border p-4 h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">Freie Section</h3>
          </div>
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-sm">Platzhalter für zukünftige Inhalte</div>
            </div>
          </div>
        </div>

        {/* Freie Section (Platzhalter) */}
        <div className="bg-white rounded-lg border p-4 h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">Freie Section</h3>
          </div>
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-sm">Platzhalter für zukünftige Inhalte</div>
            </div>
          </div>
        </div>

        {/* PERSÖNLICHE NOTIZEN Section */}
        <div className="bg-white rounded-lg border p-4 h-[400px] flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <TextSection
              title={personalNotesContent.title}
              content={personalNotesContent.content}
              onContentChange={handlePersonalNotesSaveTextSection}
              storageKey="personalNotesContent"
              className="h-full"
            />
          </div>
        </div>
      </div>

      {/* Notes Editor Modal */}
      {isNotesEditorOpen && (
        <FreeTextEditor
          isOpen={isNotesEditorOpen}
          onClose={() => setIsNotesEditorOpen(false)}
          title={personalNotesContent.title}
          content={personalNotesContent.content}
          onSave={handlePersonalNotesSave}
        />
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
            />
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {uploadCategory === 'general' ? 'Allgemeine Dateien' : 'Persönliche Dateien'} hochladen
              </h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <UploadSection
              title={uploadCategory === 'general' ? 'Allgemeine Dateien' : 'Persönliche Dateien'}
              category={uploadCategory}
              userId={currentUserId}
              maxFiles={10}
              maxFileSizeMB={uploadCategory === 'general' ? 50 : 20}
            />
          </div>
        </div>
      )}
    </>
  )
}
