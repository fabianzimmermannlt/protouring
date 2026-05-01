'use client'

import React, { useState, useEffect } from 'react'
import { X, Save, Trash2, Loader2, Check } from 'lucide-react'
import { getActiveFunctions, type ActiveFunction } from '@/lib/api-client'

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
  onSave: (data: ProfileData) => Promise<void> | void
  onDelete?: () => void
  isAdmin?: boolean
  isSelf?: boolean  // eigenes Profil → accessRights immer read-only
  inline?: boolean  // kein Modal-Wrapper, direkt eingebettet
  hasUserAccount?: boolean  // Kontakt hat App-Account → "Entfernen" statt "Löschen"
}

export function ProfileEditor({ isOpen, onClose, profileData, onSave, onDelete, isAdmin = false, isSelf = false, inline = false, hasUserAccount = false }: ProfileEditorProps) {
  const [formData, setFormData] = useState<ProfileData>(profileData)
  const [activeFunctions, setActiveFunctions] = useState<ActiveFunction[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Update form data when props change
  useEffect(() => {
    if (isOpen) {
      setFormData(profileData)
    }
  }, [isOpen, profileData])

  // Aktive Funktionen einmalig laden
  useEffect(() => {
    getActiveFunctions().then(setActiveFunctions).catch(() => setActiveFunctions([]))
  }, [])

  if (!isOpen) return null

  const handleChange = (field: keyof ProfileData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await onSave(formData)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
    if (!inline) onClose()
  }

  const handleDelete = () => {
    const msg = hasUserAccount
      ? `${profileData.firstName} ${profileData.lastName} wirklich aus diesem Artist entfernen? Der App-Account bleibt erhalten, der Zugang zu diesem Artist wird entzogen.`
      : `${profileData.firstName} ${profileData.lastName} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`
    if (confirm(msg)) {
      if (onDelete) {
        onDelete()
      }
      onClose()
    }
  }

  const content = (
    <>
        {/* Editor Content */}
        <div className={inline ? '' : 'modal-body'}>
          <div className="space-y-6">

            {/* Persönliche Daten */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Persönliche Daten</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Vorname</label>
                  <input type="text" value={formData.firstName} onChange={(e) => handleChange('firstName', e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Nachname</label>
                  <input type="text" value={formData.lastName} onChange={(e) => handleChange('lastName', e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Geburtstag</label>
                  <input type="date" value={formData.birthDate} onChange={(e) => handleChange('birthDate', e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Geschlecht</label>
                  <select value={formData.gender} onChange={(e) => handleChange('gender', e.target.value)} className="form-input">
                    <option value="">Bitte wählen...</option>
                    <option value="männlich">Männlich</option>
                    <option value="weiblich">Weiblich</option>
                    <option value="divers">Divers</option>
                    <option value="keine_angabe">Keine Angabe</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Pronomen</label>
                  <input type="text" value={formData.pronouns} onChange={(e) => handleChange('pronouns', e.target.value)} className="form-input" placeholder="er/ihm, sie/ihr, divers" />
                </div>
              </div>
            </div>

            {/* Kontaktdaten */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Kontaktdaten</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Email</label>
                  <input type="email" value={formData.email} readOnly className="form-input bg-gray-50 text-gray-500 cursor-not-allowed" title="E-Mail kann nur von einem Admin geändert werden" />
                </div>
                <div>
                  <label className="form-label">Telefon</label>
                  <input type="tel" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} className="form-input" />
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-1">
                  <div>
                    <label className="form-label">PLZ</label>
                    <input type="text" value={formData.postalCode} onChange={(e) => handleChange('postalCode', e.target.value)} maxLength={5} className="form-input !w-20" placeholder="12345" />
                  </div>
                  <div>
                    <label className="form-label">Wohnort</label>
                    <input type="text" value={formData.residence} onChange={(e) => handleChange('residence', e.target.value)} className="form-input" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Adresse</label>
                  <input type="text" value={formData.address} onChange={(e) => handleChange('address', e.target.value)} className="form-input" />
                </div>
              </div>
            </div>

            {/* Berufliche Daten */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Berufliche Daten</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['function1', 'function2', 'function3'] as const).map((field, i) => {
                  const currentVal = formData[field]
                  const activeNames = new Set(activeFunctions.map(f => f.name))
                  const showLegacy = currentVal && !activeNames.has(currentVal)
                  return (
                    <div key={field}>
                      <label className="form-label">{i + 1}. Funktion</label>
                      <select value={currentVal} onChange={(e) => handleChange(field, e.target.value)} className="form-input">
                        <option value="">– keine –</option>
                        {showLegacy && <option value={currentVal}>{currentVal} ⚠ (deaktiviert)</option>}
                        {activeFunctions.map(fn => <option key={fn.name} value={fn.name}>{fn.name}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Spezifikation</label>
                  <input type="text" value={formData.specification} onChange={(e) => handleChange('specification', e.target.value)} className="form-input" placeholder="z.B. Schlagzeug" />
                </div>
                <div>
                  <label className="form-label">Sprachen</label>
                  <input type="text" value={formData.languages} onChange={(e) => handleChange('languages', e.target.value)} className="form-input" placeholder="Deutsch, Englisch, Französisch" />
                </div>
              </div>
            </div>

            {/* Reisedaten */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Reisedaten</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Führerschein</label>
                  <input type="text" value={formData.driversLicense} onChange={(e) => handleChange('driversLicense', e.target.value)} className="form-input" placeholder="z.B. Klasse B, Klasse C, Internationaler Führerschein..." />
                </div>
                <div>
                  <label className="form-label">Bahncard</label>
                  <input type="text" value={formData.railcard} onChange={(e) => handleChange('railcard', e.target.value)} className="form-input" placeholder="z.B. Bahncard 25, Bahncard 50, Business..." />
                </div>
                <div>
                  <label className="form-label">Vielfliegernummer</label>
                  <input type="text" value={formData.frequentFlyer} onChange={(e) => handleChange('frequentFlyer', e.target.value)} className="form-input" placeholder="z.B. Lufthansa Miles & More, Emirates Skywards..." />
                </div>
                <div>
                  <label className="form-label">Hotel Deckname</label>
                  <input type="text" value={formData.hotelAlias} onChange={(e) => handleChange('hotelAlias', e.target.value)} className="form-input" placeholder="z.B. John Smith, Mike Johnson..." />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Hotelwünsche</label>
                  <textarea value={formData.hotelInfo} onChange={(e) => handleChange('hotelInfo', e.target.value)} className="form-input" rows={2} placeholder="z.B. Einzelzimmer bevorzugt, ruhiges Zimmer, hohe Etage, Suite wenn möglich..." />
                </div>
              </div>
            </div>

            {/* Ernährung */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Ernährung</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Ernährungsweise</label>
                  <select value={formData.diet} onChange={(e) => handleChange('diet', e.target.value)} className="form-input">
                    <option value="">Bitte wählen...</option>
                    <option value="alles">Alles</option>
                    <option value="vegetarisch">Vegetarisch</option>
                    <option value="vegan">Vegan</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Allergien</label>
                  <input type="text" value={formData.allergies} onChange={(e) => handleChange('allergies', e.target.value)} className="form-input" placeholder="z.B. Nüsse, Erdnüsse, Fisch..." />
                </div>
                <div>
                  <label className="form-label block text-xs text-gray-500 mb-1">Unverträglichkeiten</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={formData.glutenFree} onChange={(e) => handleChange('glutenFree', e.target.checked)} />
                      Glutenfrei
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={formData.lactoseFree} onChange={(e) => handleChange('lactoseFree', e.target.checked)} />
                      Laktosefrei
                    </label>
                  </div>
                </div>
                <div>
                  <label className="form-label">Besonderheiten</label>
                  <input type="text" value={formData.specialNotes} onChange={(e) => handleChange('specialNotes', e.target.value)} className="form-input" placeholder="z.B. scharf essen, kein Koffein..." />
                </div>
              </div>
            </div>

            {/* Kleidergrößen */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Kleidergrößen</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="form-label">Shirt</label>
                  <input type="text" value={formData.shirtSize} onChange={(e) => handleChange('shirtSize', e.target.value)} className="form-input" placeholder="S, M, L, XL" />
                </div>
                <div>
                  <label className="form-label">Hoodie</label>
                  <input type="text" value={formData.hoodieSize} onChange={(e) => handleChange('hoodieSize', e.target.value)} className="form-input" placeholder="S, M, L, XL" />
                </div>
                <div>
                  <label className="form-label">Hose</label>
                  <input type="text" value={formData.pantsSize} onChange={(e) => handleChange('pantsSize', e.target.value)} className="form-input" placeholder="32, 34, 36" />
                </div>
                <div>
                  <label className="form-label">Schuhe</label>
                  <input type="text" value={formData.shoeSize} onChange={(e) => handleChange('shoeSize', e.target.value)} className="form-input" placeholder="42, 43, 44" />
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

        </div>

        {/* Action Buttons */}
        <div className={inline ? 'flex justify-end pt-4 border-t mt-4' : 'modal-footer'}>
          {!inline && (onDelete ? (
            <button onClick={handleDelete} className="btn btn-danger">
              <Trash2 className="h-4 w-4" />
              {hasUserAccount ? 'Entfernen' : 'Löschen'}
            </button>
          ) : <div />)}
          <div className="flex space-x-3">
            {!inline && (
              <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
            )}
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Speichern…</>
                : saved
                ? <><Check className="h-4 w-4" /> Gespeichert</>
                : <><Save className="h-4 w-4" /> Speichern</>
              }
            </button>
          </div>
        </div>
    </>
  )

  if (inline) return <div>{content}</div>

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-2xl">
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Profil bearbeiten</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {content}
      </div>
    </div>
  )
}

export default ProfileEditor
