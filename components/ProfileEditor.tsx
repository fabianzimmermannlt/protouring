'use client'

import React, { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'

export interface ProfileData {
  firstName: string
  lastName: string
  email: string
  phone: string
  mobile: string
  residence: string
  postalCode: string
  address: string
  birthDate: string
  gender: string
  pronouns: string
  birthPlace: string
  nationality: string
  idNumber: string
  taxId: string
  socialSecurity: string
  function1: string
  function2: string
  function3: string
  diet: string
  glutenFree: boolean
  lactoseFree: boolean
  allergies: string
  specialNotes: string
  shirtSize: string
  hoodieSize: string
  pantsSize: string
  shoeSize: string
  specification: string
  languages: string
  emergencyContact: string
  emergencyPhone: string
  hotelInfo: string
  hotelAlias: string
  driversLicense: string
  railcard: string
  frequentFlyer: string
  accessRights: string
  personalFiles: File[]
  bankAccount: string
  bankIban: string
  bankBic: string
  taxNumber: string
  vatId: string
  crewToolActive: boolean
}

interface ProfileEditorProps {
  isOpen: boolean
  onClose: () => void
  profileData: ProfileData
  onSave: (data: ProfileData) => void
}

export function ProfileEditor({ isOpen, onClose, profileData, onSave }: ProfileEditorProps) {
  const [formData, setFormData] = useState<ProfileData>(profileData)

  // Update form data when props change
  useEffect(() => {
    if (isOpen) {
      setFormData(profileData)
    }
  }, [isOpen, profileData])

  if (!isOpen) return null

  const handleChange = (field: keyof ProfileData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    onSave(formData)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">PROFIL BEARBEITEN</h2>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Editor Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="space-y-6">
            
            {/* Erste Zeile: Persönliche Daten und Kontaktdaten */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Persönliche Daten */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Persönliche Daten</h3>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Vorname</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nachname</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Geburtstag</label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => handleChange('birthDate', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Geschlecht</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleChange('gender', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Bitte wählen...</option>
                    <option value="männlich">Männlich</option>
                    <option value="weiblich">Weiblich</option>
                    <option value="divers">Divers</option>
                    <option value="keine_angabe">Keine Angabe</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Pronomen</label>
                  <input
                    type="text"
                    value={formData.pronouns}
                    onChange={(e) => handleChange('pronouns', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    placeholder="er/ihm, sie/ihr, divers"
                  />
                </div>
              </div>

              {/* Kontaktdaten */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Kontaktdaten</h3>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-[auto_1fr] gap-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">PLZ</label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => handleChange('postalCode', e.target.value)}
                      maxLength={5}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="12345"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Wohnort</label>
                    <input
                      type="text"
                      value={formData.residence}
                      onChange={(e) => handleChange('residence', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Adresse</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Berufliche Daten - einspaltig */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Berufliche Daten</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">1. Funktion</label>
                  <select
                    value={formData.function1}
                    onChange={(e) => handleChange('function1', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Bitte wählen...</option>
                    <option value="Sound Operating">Sound Operating</option>
                    <option value="Sound Operating FOH">Sound Operating FOH</option>
                    <option value="Monitor Engineer">Monitor Engineer</option>
                    <option value="Lighting Designer">Lighting Designer</option>
                    <option value="Tour Manager">Tour Manager</option>
                    <option value="Production Manager">Production Manager</option>
                    <option value="Stage Manager">Stage Manager</option>
                    <option value="Backline Tech">Backline Tech</option>
                    <option value="System Engineer">System Engineer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">2. Funktion</label>
                  <select
                    value={formData.function2}
                    onChange={(e) => handleChange('function2', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Bitte wählen...</option>
                    <option value="Sound Operating">Sound Operating</option>
                    <option value="Sound Operating FOH">Sound Operating FOH</option>
                    <option value="Monitor Engineer">Monitor Engineer</option>
                    <option value="Lighting Designer">Lighting Designer</option>
                    <option value="Tour Manager">Tour Manager</option>
                    <option value="Production Manager">Production Manager</option>
                    <option value="Stage Manager">Stage Manager</option>
                    <option value="Backline Tech">Backline Tech</option>
                    <option value="System Engineer">System Engineer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">3. Funktion</label>
                  <select
                    value={formData.function3}
                    onChange={(e) => handleChange('function3', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Bitte wählen...</option>
                    <option value="Sound Operating">Sound Operating</option>
                    <option value="Sound Operating FOH">Sound Operating FOH</option>
                    <option value="Monitor Engineer">Monitor Engineer</option>
                    <option value="Lighting Designer">Lighting Designer</option>
                    <option value="Tour Manager">Tour Manager</option>
                    <option value="Production Manager">Production Manager</option>
                    <option value="Stage Manager">Stage Manager</option>
                    <option value="Backline Tech">Backline Tech</option>
                    <option value="System Engineer">System Engineer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Spezifikation</label>
                  <input
                    type="text"
                    value={formData.specification}
                    onChange={(e) => handleChange('specification', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    placeholder="z.B. Schlagzeug"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Sprachen</label>
                  <input
                    type="text"
                    value={formData.languages}
                    onChange={(e) => handleChange('languages', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    placeholder="Deutsch, Englisch, Französisch"
                  />
                </div>
              </div>
            </div>

            {/* Zweite Zeile: Ernährung und Reisedaten */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Ernährung */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Ernährung</h3>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ernährungsweise</label>
                  <select
                    value={formData.diet}
                    onChange={(e) => handleChange('diet', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Bitte wählen...</option>
                    <option value="alles">Alles</option>
                    <option value="vegetarisch">Vegetarisch</option>
                    <option value="vegan">Vegan</option>
                  </select>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-gray-700 mb-2">Unverträglichkeiten</h4>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.glutenFree}
                        onChange={(e) => handleChange('glutenFree', e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Glutenfrei</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.lactoseFree}
                        onChange={(e) => handleChange('lactoseFree', e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Laktosefrei</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Allergien</label>
                  <input
                    type="text"
                    value={formData.allergies}
                    onChange={(e) => handleChange('allergies', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    placeholder="z.B. Nüsse, Erdnüsse, Fisch..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Besonderheiten</label>
                  <input
                    type="text"
                    value={formData.specialNotes}
                    onChange={(e) => handleChange('specialNotes', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    placeholder="z.B. scharf essen, keine Koffein..."
                  />
                </div>
              </div>

              {/* Reisedaten */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Reisedaten</h3>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Führerschein</label>
                  <input
                    type="text"
                    value={formData.driversLicense}
                    onChange={(e) => handleChange('driversLicense', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    placeholder="z.B. Klasse B, Klasse C, Internationaler Führerschein..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bahncard</label>
                  <input
                    type="text"
                    value={formData.railcard}
                    onChange={(e) => handleChange('railcard', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    placeholder="z.B. Bahncard 25, Bahncard 50, Business..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Vielfliegernummer</label>
                  <input
                    type="text"
                    value={formData.frequentFlyer}
                    onChange={(e) => handleChange('frequentFlyer', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    placeholder="z.B. Lufthansa Miles & More, Emirates Skywards..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Hotelwünsche</label>
                  <textarea
                    value={formData.hotelInfo}
                    onChange={(e) => handleChange('hotelInfo', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    rows={3}
                    placeholder="z.B. Einzelzimmer bevorzugt, ruhiges Zimmer, hohe Etage, Suite wenn möglich..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Hotel Deckname</label>
                  <input
                    type="text"
                    value={formData.hotelAlias}
                    onChange={(e) => handleChange('hotelAlias', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    placeholder="z.B. John Smith, Mike Johnson..."
                  />
                </div>
              </div>
            </div>

            {/* Dritte Zeile: Kleidergrößen und Zugriffsrechte */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Kleidergrößen */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Kleidergrößen</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Shirt</label>
                      <input
                        type="text"
                        value={formData.shirtSize}
                        onChange={(e) => handleChange('shirtSize', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="z.B. S, M, L, XL"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Hoodie</label>
                      <input
                        type="text"
                        value={formData.hoodieSize}
                        onChange={(e) => handleChange('hoodieSize', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="z.B. S, M, L, XL"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Hose</label>
                      <input
                        type="text"
                        value={formData.pantsSize}
                        onChange={(e) => handleChange('pantsSize', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="z.B. 32, 34, 36, 38"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Schuhe</label>
                      <input
                        type="text"
                        value={formData.shoeSize}
                        onChange={(e) => handleChange('shoeSize', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="z.B. 42, 43, 44, 45"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Zugriffsrechte */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Zugriffsrechte</h3>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Zugriffsrechte</label>
                  <select
                    value={formData.accessRights}
                    onChange={(e) => handleChange('accessRights', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Bitte wählen...</option>
                    <option value="Admin">Admin</option>
                    <option value="Agentur">Agentur</option>
                    <option value="Tourmanagement">Tourmanagement</option>
                    <option value="Artist">Artist</option>
                    <option value="Crew+">Crew+</option>
                    <option value="Crew">Crew</option>
                    <option value="Gast">Gast</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Crew Tool Status */}
          <div className="flex items-center mt-4 pt-4 border-t">
            <input
              type="checkbox"
              id="crewToolActive"
              checked={formData.crewToolActive}
              onChange={(e) => handleChange('crewToolActive', e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="crewToolActive" className="text-sm text-gray-700">
              Crew Tool aktiv
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 mt-6 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfileEditor
