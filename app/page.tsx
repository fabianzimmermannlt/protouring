'use client'

import { useState, useEffect, useRef } from 'react'
import { Calendar, Users, MapPin, Hotel, Car, FileText, Settings, Home, Users2, Edit, Upload, File, Trash2, AlertCircle, X } from 'lucide-react'
import { FreeTextEditor } from '@/components/FreeTextEditor'
import { ProfileEditor, ProfileData } from '@/components/ProfileEditor'

// File system functions
const saveToFile = async (filename: string, content: string) => {
  try {
    localStorage.setItem(`protouring_${filename}`, content)
    return true
  } catch (error) {
    console.error('Failed to save:', error)
    return false
  }
}

const loadFromFile = async (filename: string): Promise<string> => {
  try {
    const content = localStorage.getItem(`protouring_${filename}`)
    return content || ''
  } catch (error) {
    console.error('Failed to load:', error)
    return ''
  }
}

const navigationItems = [
  { id: 'desk', name: 'SCHREIBTISCH', icon: Home, description: 'Main dashboard' },
  { id: 'appointments', name: 'TERMINE', icon: Calendar, description: 'Appointments & scheduling' },
  { id: 'people', name: 'MENSCHEN', icon: Users, description: 'People & contacts' },
  { id: 'venues', name: 'SPIELSTÄTTEN', icon: MapPin, description: 'Venues & locations' },
  { id: 'partners', name: 'PARTNER', icon: Users2, description: 'Partners & collaborators' },
  { id: 'hotels', name: 'HOTELS', icon: Hotel, description: 'Hotel accommodations' },
  { id: 'vehicles', name: 'FAHRZEUGE', icon: Car, description: 'Vehicles & transport' },
  { id: 'templates', name: 'VORLAGEN', icon: FileText, description: 'Templates & documents' },
  { id: 'settings', name: 'EINSTELLUNGEN', icon: Settings, description: 'Settings & configuration' }
]

export default function ProTouringApp() {
  const [activeTab, setActiveTab] = useState('desk')
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [buhneFreiContent, setBuhneFreiContent] = useState({
    title: '',
    content: ''
  })
  const [profileData, setProfileData] = useState<ProfileData>({
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
    driversLicense: '',
    railcard: '',
    frequentFlyer: '',
    accessRights: '',
    personalFiles: [],
    bankAccount: '',
    bankIban: '',
    bankBic: '',
    taxNumber: '',
    vatId: '',
    crewToolActive: true
  })
  const [isLoading, setIsLoading] = useState(true)

  // Load data from localStorage on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load Bühne Frei content
        const savedContent = await loadFromFile('buhneFreiContent')
        if (savedContent) {
          const parsed = JSON.parse(savedContent)
          setBuhneFreiContent(parsed)
        } else {
          setBuhneFreiContent({
            title: 'Start der Live Saison 2026!',
            content: '🎸 Start der Live Saison 2026!\n\nWICHTIG: Adressänderung für Rechnungen'
          })
        }

        // Load Profile data
        const savedData = await loadFromFile('profileData')
        if (savedData) {
          const parsed = JSON.parse(savedData)
          setProfileData({
            firstName: parsed.firstName || 'Fabian',
            lastName: parsed.lastName || 'Zimmermann',
            email: parsed.email || 'fabian@blindpage.de',
            phone: parsed.phone || '+49 1749181911',
            mobile: parsed.mobile || '',
            residence: parsed.residence || 'Andernach',
            postalCode: parsed.postalCode || '56626',
            address: parsed.address || '',
            birthDate: parsed.birthDate || '',
            gender: parsed.gender || '',
            pronouns: parsed.pronouns || '',
            birthPlace: parsed.birthPlace || '',
            nationality: parsed.nationality || 'deutsch',
            idNumber: parsed.idNumber || '',
            taxId: parsed.taxId || '',
            socialSecurity: parsed.socialSecurity || '',
            function1: parsed.function1 || 'Sound Operating',
            function2: parsed.function2 || 'Sound Operating FOH',
            function3: parsed.function3 || '',
            diet: parsed.diet || 'alles',
            glutenFree: parsed.glutenFree || false,
            lactoseFree: parsed.lactoseFree || true,
            allergies: parsed.allergies || '',
            specialNotes: parsed.specialNotes || '',
            shirtSize: parsed.shirtSize || '',
            hoodieSize: parsed.hoodieSize || '',
            pantsSize: parsed.pantsSize || '',
            shoeSize: parsed.shoeSize || '',
            specification: parsed.specification || '',
            languages: parsed.languages || '',
            emergencyContact: parsed.emergencyContact || '',
            emergencyPhone: parsed.emergencyPhone || '',
            hotelInfo: parsed.hotelInfo || '',
            hotelAlias: parsed.hotelAlias || '',
            accessRights: parsed.accessRights || '',
            personalFiles: parsed.personalFiles || [],
            bankAccount: parsed.bankAccount || '',
            bankIban: parsed.bankIban || '',
            driversLicense: parsed.driversLicense || '',
            railcard: parsed.railcard || '',
            frequentFlyer: parsed.frequentFlyer || '',
            bankBic: parsed.bankBic || '',
            taxNumber: parsed.taxNumber || '',
            vatId: parsed.vatId || '',
            crewToolActive: parsed.crewToolActive !== false
          })
        } else {
          // Set default profile data
          setProfileData({
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
        }
      } catch (error) {
        console.error('Failed to load saved data:', error)
        // Set default data on error
        setBuhneFreiContent({
          title: 'Start der Live Saison 2026!',
          content: '🎸 Start der Live Saison 2026!\n\nWICHTIG: Adressänderung für Rechnungen'
        })
        setProfileData({
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
      }
    }

    loadData()
    setIsLoading(false)
  }, [])

  // Datei-Upload Funktionen
  const validateFile = (file: File): string | null => {
    // Dateigröße prüfen (50MB)
    if (file.size > 50 * 1024 * 1024) {
      return 'Die Datei ist größer als 50MB'
    }
    
    // Anzahl der Dateien prüfen (max 10)
    if (profileData.personalFiles.length >= 10) {
      return 'Die maximale Anzahl von 10 Dateien wurde erreicht'
    }
    
    return null
  }

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return
    
    const newFiles: File[] = []
    const errors: string[] = []
    
    Array.from(files).forEach(file => {
      const error = validateFile(file)
      if (error) {
        errors.push(`${file.name}: ${error}`)
      } else {
        newFiles.push(file)
      }
    })
    
    if (errors.length > 0) {
      setUploadError(errors.join('\n'))
    } else {
      setUploadError('')
      setProfileData(prev => ({
        ...prev,
        personalFiles: [...prev.personalFiles, ...newFiles]
      }))
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const removeFile = (index: number) => {
    const newFiles = [...profileData.personalFiles]
    newFiles.splice(index, 1)
    setProfileData(prev => ({ ...prev, personalFiles: newFiles }))
  }

  const openFile = (file: File) => {
    // Create a temporary URL for the file
    const fileUrl = URL.createObjectURL(file)
    // Open the file in a new tab
    window.open(fileUrl, '_blank')
    // Clean up the URL after a short delay
    setTimeout(() => URL.revokeObjectURL(fileUrl), 1000)
  }

  const handleSaveBuhneFrei = async (title: string, content: string) => {
    console.log('Saving:', { title, content }); // Debug log
    const success = await saveToFile('buhneFreiContent', JSON.stringify({ title, content }))
    if (success) {
      setBuhneFreiContent({ title, content })
      console.log('State updated:', { title, content }); // Debug log
    } else {
      alert('Fehler beim Speichern!')
    }
  }

  const handleSaveProfile = async (data: ProfileData) => {
    const success = await saveToFile('profileData', JSON.stringify(data))
    if (success) {
      setProfileData(data)
    } else {
      alert('Fehler beim Speichern des Profils!')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Navigation */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">ProTouring</h1>
            </div>
            <nav className="flex space-x-1">
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                      isActive 
                        ? 'bg-yellow-400 text-gray-900' 
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.name}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-4 py-8 max-w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {navigationItems.find(item => item.id === activeTab)?.name}
          </h1>
          <p className="text-gray-600 mb-8">
            {navigationItems.find(item => item.id === activeTab)?.description}
          </p>
          
          {/* Content based on active tab */}
          <div className="bg-gray-50 rounded-lg p-4 min-h-[600px]">
            {activeTab === 'desk' && (
              <div>
                {/* Date Header */}
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900">FREITAG, 20. MÄRZ 2026</h2>
                </div>
                
                {/* 4-Spalten Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* DEIN PROFIL Section */}
                  <div className="bg-white rounded-lg border p-4 h-[400px] flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-semibold text-gray-900">DEIN PROFIL</h3>
                      <button
                        onClick={() => setIsProfileEditorOpen(true)}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-2 text-sm flex-grow">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Name:</span>
                        <span className="font-medium">{profileData.firstName} {profileData.lastName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Email:</span>
                        <span className="font-medium truncate ml-2">{profileData.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Telefon:</span>
                        <span className="font-medium">{profileData.phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Wohnort:</span>
                        <span className="font-medium">{profileData.postalCode} {profileData.residence}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Funktion:</span>
                        <span className="font-medium">{profileData.function1}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Crew Tool:</span>
                        <span className={`font-medium ${profileData.crewToolActive ? 'text-green-600' : 'text-gray-400'}`}>
                          {profileData.crewToolActive ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Free Text Section */}
                  <div className="bg-white rounded-lg border p-4 h-[400px] flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-semibold text-gray-900">{buhneFreiContent.title || 'BÜHNE FREI'}</h3>
                      <button
                        onClick={() => setIsEditorOpen(true)}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-2 flex-grow">
                      <div 
                        className="text-sm text-gray-600 whitespace-pre-wrap overflow-hidden"
                        dangerouslySetInnerHTML={{ __html: buhneFreiContent.content.replace(/\n/g, '<br>') }}
                      />
                    </div>
                  </div>

                  {/* ALLGEMEINE DATEIEN Section */}
                  <div className="bg-white rounded-lg border p-4 h-[400px] flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-semibold text-gray-900">ALLGEMEINE DATEIEN</h3>
                      <button className="text-blue-600 hover:text-blue-800 p-1 rounded">
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-2 flex-grow">
                      <div className="text-sm text-gray-600 mb-2">Tour-Dokumente</div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between p-1 bg-gray-50 rounded text-sm">
                          <span className="truncate flex-1">Rider_2026.pdf</span>
                          <span className="text-gray-500 ml-1">(2.4 MB)</span>
                        </div>
                        <div className="flex items-center justify-between p-1 bg-gray-50 rounded text-sm">
                          <span className="truncate flex-1">Tourplan_Maerz.xlsx</span>
                          <span className="text-gray-500 ml-1">(1.1 MB)</span>
                        </div>
                        <div className="flex items-center justify-between p-1 bg-gray-50 rounded text-sm">
                          <span className="truncate flex-1">Technische_Spezifikationen.docx</span>
                          <span className="text-gray-500 ml-1">(3.7 MB)</span>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-500 mt-auto">
                        3 Dateien • 7.2 MB gesamt
                      </div>
                    </div>
                  </div>
                  
                  {/* PERSÖNLICHE DATEIEN Section */}
                  <div className="bg-white rounded-lg border p-4 h-[400px] flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-semibold text-gray-900">PERSÖNLICHE DATEIEN</h3>
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {/* Dateiliste */}
                    {profileData.personalFiles && profileData.personalFiles.length > 0 ? (
                      <div className="space-y-2 flex-grow">
                        <div className="text-sm text-gray-600">
                          {profileData.personalFiles.length} von 10 Dateien
                        </div>
                        <div className="space-y-1">
                          {profileData.personalFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-1 bg-gray-50 rounded text-sm">
                              <button
                                onClick={() => openFile(file)}
                                className="truncate flex-1 text-left hover:text-blue-600 transition-colors"
                                title="Datei in neuem Tab öffnen"
                              >
                                {file.name}
                              </button>
                              <span className="text-gray-500 ml-1">
                                ({(file.size / 1024 / 1024).toFixed(1)} MB)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 flex-grow flex flex-col justify-center">
                        <div className="text-gray-400 text-sm mb-2">Keine Dateien</div>
                        <button
                          onClick={() => setShowUploadModal(true)}
                          className="text-blue-600 hover:text-blue-800 text-sm underline"
                        >
                          Dateien hinzufügen
                        </button>
                      </div>
                    )}
                    
                    <div className="text-sm text-gray-500 mt-auto">
                      Max. 50MB pro Datei
                    </div>
                  </div>
                </div>
                
                {/* ALLGEMEINE KONVERSATION Section (volle Breite) */}
                <div className="mt-4 bg-white rounded-lg border p-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">ALLGEMEINE KONVERSATION</h3>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-gray-500 text-center mb-3">
                      <p className="text-sm">Noch keine Nachrichten</p>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="text"
                        placeholder="Schreibe eine Nachricht..."
                        className="flex-1 px-3 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <button className="px-4 py-2 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600 text-sm">
                        Senden
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Other tabs content */}
            {activeTab === 'appointments' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Appointments & Scheduling</h2>
                <p className="text-gray-700">Manage your calendar and schedule appointments.</p>
              </div>
            )}
            
            {activeTab === 'people' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">People & Contacts</h2>
                <p className="text-gray-700">Manage your contacts and team members.</p>
              </div>
            )}
            
            {activeTab === 'venues' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Venues & Locations</h2>
                <p className="text-gray-700">Manage venue information and locations.</p>
              </div>
            )}
            
            {activeTab === 'partners' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Partners & Collaborators</h2>
                <p className="text-gray-700">Manage partnerships and collaborations.</p>
              </div>
            )}
            
            {activeTab === 'hotels' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Hotel Accommodations</h2>
                <p className="text-gray-700">Manage hotel bookings and accommodations.</p>
              </div>
            )}
            
            {activeTab === 'vehicles' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Vehicles & Transport</h2>
                <p className="text-gray-700">Manage vehicles and transportation logistics.</p>
              </div>
            )}
            
            {activeTab === 'templates' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Templates & Documents</h2>
                <p className="text-gray-700">Manage document templates and resources.</p>
              </div>
            )}
            
            {activeTab === 'settings' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Settings & Configuration</h2>
                <p className="text-gray-700">Application settings and preferences.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Free Text Editor Modal */}
      <FreeTextEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={buhneFreiContent.title}
        content={buhneFreiContent.content}
        onSave={handleSaveBuhneFrei}
      />

      {/* Profile Editor Modal */}
      <ProfileEditor
        isOpen={isProfileEditorOpen}
        onClose={() => setIsProfileEditorOpen(false)}
        profileData={profileData}
        onSave={handleSaveProfile}
      />

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Dateien hochladen</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setUploadError('')
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4">
              {/* Drag & Drop Bereich */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-2">
                  Ziehe Dateien hierher oder klicke unten
                </p>
                <p className="text-xs text-gray-500">
                  Max. 50MB pro Datei, max. 10 Dateien
                </p>
              </div>

              {/* Datei auswählen Button */}
              <div className="mt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                >
                  Datei auswählen
                </button>
              </div>

              {/* Fehlermeldung */}
              {uploadError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-700 whitespace-pre-line">
                      {uploadError}
                    </div>
                  </div>
                </div>
              )}

              {/* Aktuelle Dateien */}
              {profileData.personalFiles && profileData.personalFiles.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Bereits hochgeladen ({profileData.personalFiles.length}/10):
                  </p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {profileData.personalFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                        <button
                          onClick={() => openFile(file)}
                          className="truncate flex-1 text-left hover:text-blue-600 transition-colors"
                          title="Datei in neuem Tab öffnen"
                        >
                          {file.name}
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">
                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                          <button
                            onClick={() => removeFile(index)}
                            className="text-red-500 hover:bg-red-50 p-1 rounded"
                            title="Datei löschen"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setUploadError('')
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
