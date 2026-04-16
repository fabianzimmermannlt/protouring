'use client'

import { useState, useEffect } from 'react'
import {
  KeyIcon,
  CheckCircleIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { Loader2, X, Save, Download, Upload, Plus } from 'lucide-react'
import { ProfileEditor, ProfileData } from '@/app/components/shared/ProfileEditor'
import CrewBookingView from './CrewBookingView'
import GastAnlegenModal from './GastAnlegenModal'
import {
  getContacts, createContact, updateContact, deleteContact,
  getCurrentUser, getCurrentTenant, createInvite, getFunctionCatalog,
  ROLE_LABELS, isAdminRole, isEditorRole, getEffectiveRole,
  type Contact, type ContactFormData, type TenantRole, type FunctionCatalogGroup
} from '@/lib/api-client'
import { useSortable } from '@/app/hooks/useSortable'

const CONTACT_COLS: [string, keyof Contact][] = [
  ['Vorname', 'firstName'],
  ['Nachname', 'lastName'],
  ['Funktion 1', 'function1'],
  ['Funktion 2', 'function2'],
  ['Funktion 3', 'function3'],
  ['Spezifikation', 'specification'],
  ['Zugriffsrechte', 'accessRights'],
]

export interface ContactsProps {
  activeSubTab?: string
}

// ProfileEditor-Daten ↔ Contact konvertieren
function profileToContact(data: ProfileData): ContactFormData {
  return {
    firstName: data.firstName || '', lastName: data.lastName || '',
    function1: data.function1 || '', function2: data.function2 || '', function3: data.function3 || '',
    specification: (data as any).specification || data.specialNotes || '',
    accessRights: data.accessRights || 'Crew',
    email: data.email || '', phone: data.phone || '', mobile: data.mobile || '',
    address: data.address || '', postalCode: data.postalCode || '', residence: data.residence || '',
    taxId: data.taxId || '', website: '', birthDate: data.birthDate || '',
    gender: data.gender || '', pronouns: data.pronouns || '', birthPlace: data.birthPlace || '',
    nationality: data.nationality || '', idNumber: data.idNumber || '', socialSecurity: data.socialSecurity || '',
    diet: data.diet || '', glutenFree: data.glutenFree || false, lactoseFree: data.lactoseFree || false,
    allergies: data.allergies || '', emergencyContact: data.emergencyContact || '', emergencyPhone: data.emergencyPhone || '',
    shirtSize: data.shirtSize || '', hoodieSize: data.hoodieSize || '', pantsSize: data.pantsSize || '',
    shoeSize: data.shoeSize || '', languages: data.languages || '', driversLicense: data.driversLicense || '',
    railcard: data.railcard || '', frequentFlyer: data.frequentFlyer || '',
    bankAccount: data.bankAccount || '', bankIban: data.bankIban || '', bankBic: data.bankBic || '',
    taxNumber: data.taxNumber || '', vatId: data.vatId || '', crewToolActive: data.crewToolActive || false,
    hourlyRate: 0, dailyRate: 0, notes: data.specialNotes || '',
    hotelInfo: '', hotelAlias: '',
  }
}

function contactToProfile(c: Contact): ProfileData {
  return {
    firstName: c.firstName, lastName: c.lastName,
    function1: c.function1, function2: c.function2, function3: c.function3,
    specification: c.specification,
    accessRights: c.tenantRole ? (ROLE_LABELS[c.tenantRole as TenantRole] ?? c.tenantRole) : c.accessRights,
    email: c.email, phone: c.phone, mobile: c.mobile,
    address: c.address, postalCode: c.postalCode, residence: c.residence,
    taxId: c.taxId, birthDate: c.birthDate, gender: c.gender, pronouns: c.pronouns,
    birthPlace: c.birthPlace, nationality: c.nationality, idNumber: c.idNumber,
    socialSecurity: c.socialSecurity, diet: c.diet, glutenFree: c.glutenFree,
    lactoseFree: c.lactoseFree, allergies: c.allergies,
    emergencyContact: c.emergencyContact, emergencyPhone: c.emergencyPhone,
    shirtSize: c.shirtSize, hoodieSize: c.hoodieSize, pantsSize: c.pantsSize,
    shoeSize: c.shoeSize, languages: c.languages, driversLicense: c.driversLicense,
    railcard: c.railcard, frequentFlyer: c.frequentFlyer,
    bankAccount: c.bankAccount, bankIban: c.bankIban, bankBic: c.bankBic,
    taxNumber: c.taxNumber, vatId: c.vatId, crewToolActive: c.crewToolActive,
    specialNotes: c.notes, hotelInfo: '', hotelAlias: '', personalFiles: [],
  } as unknown as ProfileData
}

export default function ContactsModule({ activeSubTab = 'overview' }: ContactsProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showGastModal, setShowGastModal] = useState(false)
  const [editingGast, setEditingGast] = useState<Contact | null>(null)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  // Neuer-Kontakt-Modal (nur Einladen)
  const [addInviteEmail, setAddInviteEmail] = useState('')
  const [addInviteRole, setAddInviteRole] = useState<TenantRole>('crew')
  const [addInviteLink, setAddInviteLink] = useState('')
  const [addInviteCopied, setAddInviteCopied] = useState(false)
  const [addInviteSaving, setAddInviteSaving] = useState(false)
  const [addInviteError, setAddInviteError] = useState('')
  const [functionCatalog, setFunctionCatalog] = useState<FunctionCatalogGroup[]>([])

  // Invite-Modal (von bestehendem Kontakt aus)
  const [inviteContact, setInviteContact] = useState<Contact | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TenantRole>('crew')
  const [inviteSaving, setInviteSaving] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)

  const currentTenant = getCurrentTenant()
  const isAdmin  = isAdminRole(currentTenant?.role ?? '')
  const isEditor = isEditorRole(getEffectiveRole())

  useEffect(() => {
    loadContacts()
  }, [])

  const loadContacts = async () => {
    try {
      setLoading(true)
      setError('')
      const [data, catalog] = await Promise.all([getContacts(), getFunctionCatalog()])
      setContacts(data)
      setFunctionCatalog(catalog)
    } catch (e) {
      setError('Kontakte konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddContact = async (profileData: ProfileData) => {
    try {
      const newContact = await createContact(profileToContact(profileData))
      setContacts(prev => [...prev, newContact])
      setShowAddModal(false)
    } catch (e) {
      setError('Kontakt konnte nicht gespeichert werden.')
    }
  }

  const handleUpdateContact = async (profileData: ProfileData) => {
    if (!editingContact) return
    try {
      const updated = await updateContact(editingContact.id, profileToContact(profileData))
      setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))
      setEditingContact(null)
      setShowAddModal(false)
    } catch (e) {
      setError('Kontakt konnte nicht aktualisiert werden.')
    }
  }

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Möchten Sie diesen Kontakt wirklich löschen?')) return
    try {
      await deleteContact(contactId)
      setContacts(prev => prev.filter(c => c.id !== contactId))
      setEditingContact(null)
      setShowAddModal(false)
    } catch (e) {
      setError('Kontakt konnte nicht gelöscht werden.')
    }
  }

  const openAddModal = () => {
    setAddInviteEmail(''); setAddInviteRole('crew'); setAddInviteLink('')
    setAddInviteCopied(false); setAddInviteError(''); setAddInviteSaving(false)
    setShowAddModal(true)
  }

  const handleAddInvite = async () => {
    if (!addInviteEmail.trim()) { setAddInviteError('E-Mail fehlt'); return }
    setAddInviteSaving(true); setAddInviteError('')
    try {
      const result = await createInvite(addInviteEmail.trim(), addInviteRole)
      setAddInviteLink(`${window.location.origin}${result.invite_url}`)
    } catch (e: any) {
      setAddInviteError(e?.message ?? 'Fehler beim Erstellen')
    } finally {
      setAddInviteSaving(false)
    }
  }

  const openInviteModal = (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation()
    setInviteError('')
    setInviteLink('')
    setInviteCopied(false)
    setInviteEmail(contact.email || '')
    setInviteRole('crew')
    setInviteContact(contact)
  }

  const handleCreateInvite = async () => {
    if (!inviteContact) return
    if (!inviteEmail) { setInviteError('E-Mail fehlt'); return }
    setInviteSaving(true)
    setInviteError('')
    try {
      const result = await createInvite(inviteEmail, inviteRole, typeof inviteContact.id === 'number' ? inviteContact.id : parseInt(inviteContact.id as string))
      const baseUrl = window.location.origin
      setInviteLink(`${baseUrl}${result.invite_url}`)
    } catch (e: any) {
      setInviteError(e?.message ?? 'Fehler beim Erstellen')
    } finally {
      setInviteSaving(false)
    }
  }

  const handleCopyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2500)
    } catch {
      setInviteError('Kopieren fehlgeschlagen – Link manuell kopieren')
    }
  }

  const handleCSVExport = () => {
    const headers = ['Vorname', 'Nachname', 'Funktion 1', 'Funktion 2', 'Funktion 3',
      'Spezifikation', 'Zugriffsrechte', 'E-Mail', 'Telefon', 'Anschrift', 'PLZ', 'Ort',
      'Steuer-ID', 'Stundensatz', 'Tagessatz', 'Notizen']
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csvContent = [
      headers.join(','),
      ...contacts.map(c => [
        c.firstName, c.lastName, c.function1, c.function2, c.function3,
        c.specification, c.accessRights, c.email, c.phone, c.address,
        c.postalCode, c.residence, c.taxId, c.hourlyRate, c.dailyRate, c.notes
      ].map(escape).join(','))
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `kontakte_${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      const lines = text.trim().split('\n')
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.replace(/^"|"$/g, '').trim())
        if (values.length >= 7 && values[0]) {
          try {
            const c = await createContact({
              firstName: values[0] || '', lastName: values[1] || '',
              function1: values[2] || '', function2: values[3] || '', function3: values[4] || '',
              specification: values[5] || '', accessRights: values[6] || '',
              email: values[7] || '', phone: values[8] || '', mobile: '',
              address: values[9] || '', postalCode: values[10] || '', residence: values[11] || '',
              taxId: values[12] || '', website: '', birthDate: '', gender: '', pronouns: '',
              birthPlace: '', nationality: '', idNumber: '', socialSecurity: '', diet: '',
              glutenFree: false, lactoseFree: false, allergies: '', emergencyContact: '',
              emergencyPhone: '', shirtSize: '', hoodieSize: '', pantsSize: '', shoeSize: '',
              languages: '', driversLicense: '', railcard: '', frequentFlyer: '',
              bankAccount: '', bankIban: '', bankBic: '', taxNumber: '', vatId: '',
              crewToolActive: true, hourlyRate: parseFloat(values[13]) || 0,
              dailyRate: parseFloat(values[14]) || 0, notes: values[15] || '',
              hotelInfo: '', hotelAlias: '',
            })
            setContacts(prev => [...prev, c])
          } catch {}
        }
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const filteredContacts = contacts.filter(c => {
    // Deaktivierte User (userId vorhanden, aber keine Rolle = inactive) nur für Admin sichtbar
    if (c.userId && !c.tenantRole && !isAdmin) return false
    return `${c.firstName} ${c.lastName} ${c.function1} ${c.function2} ${c.function3} ${c.specification}`
      .toLowerCase().includes(searchTerm.toLowerCase())
  })

  const renderContent = () => {
    switch (activeSubTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {isEditor && (
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <button
                    onClick={openAddModal}
                    className="btn btn-primary"
                  >
                    <Plus className="w-4 h-4" />
                    Einladen
                  </button>
                  <button
                    onClick={() => setShowGastModal(true)}
                    className="btn btn-ghost"
                    title="Manuellen Kontakt anlegen (kein Login)"
                  >
                    <Plus className="w-4 h-4" />
                    Manuell anlegen
                  </button>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCSVExport}
                    className="btn btn-success"
                  >
                    <Download className="w-4 h-4" />
                    CSV-Export
                  </button>
                  <label className="btn btn-primary cursor-pointer">
                    <Upload className="w-4 h-4" />
                    CSV-Import
                    <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
                  </label>
                </div>
              </div>
            )}

            <div>
              <input
                type="text"
                placeholder="Kontakte durchsuchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="data-table-wrapper">
              {loading ? (
                <div className="text-center py-8 text-gray-500">Wird geladen...</div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Keine Kontakte gefunden</div>
              ) : (
                <ContactTable
                  contacts={filteredContacts}
                  isAdmin={isAdmin}
                  canEdit={isEditor}
                  onEdit={(contact) => {
                    if (contact.contactType === 'guest') {
                      setEditingGast(contact)
                    } else {
                      setEditingContact(contact)
                      setShowAddModal(true)
                    }
                  }}
                  onInviteModal={openInviteModal}
                />
              )}
            </div>
          </div>
        )

      case 'crew-booking':
        return (
          <div className="space-y-4">
            <CrewBookingView isAdmin={isAdmin} />
          </div>
        )

      case 'conditions':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Konditionen</h2>
            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-gray-600">Verträge und Konditionen werden hier implementiert...</p>
            </div>
          </div>
        )

      default:
        return <div className="text-center py-8 text-gray-500">Bereich nicht gefunden</div>
    }
  }

  return (
    <div className="space-y-6">
      {renderContent()}

      {/* Neuer-Kontakt-Modal (nur Einladen) */}
      {showAddModal && !editingContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Crew einladen</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-xs text-gray-500">
                Person erhält einen Einladungslink. Existiert der Account bereits, wird er automatisch verknüpft.
              </p>
              {addInviteError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{addInviteError}</div>
              )}
              {!addInviteLink ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">E-Mail *</label>
                    <input
                      type="email"
                      value={addInviteEmail}
                      onChange={e => setAddInviteEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddInvite()}
                      placeholder="email@beispiel.de"
                      autoFocus
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Rolle</label>
                    <select
                      value={addInviteRole}
                      onChange={e => setAddInviteRole(e.target.value as TenantRole)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {(Object.entries(ROLE_LABELS) as [TenantRole, string][]).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-600">Einladungslink</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={addInviteLink}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-xs font-mono bg-gray-50"
                    />
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(addInviteLink)
                        setAddInviteCopied(true)
                        setTimeout(() => setAddInviteCopied(false), 2500)
                      }}
                      className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                        addInviteCopied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {addInviteCopied ? 'Kopiert ✓' : 'Kopieren'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">Gültig 7 Tage. Manuell verschicken.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
                {addInviteLink ? 'Schließen' : 'Abbrechen'}
              </button>
              {!addInviteLink && (
                <button
                  onClick={handleAddInvite}
                  disabled={addInviteSaving}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {addInviteSaving ? 'Erstelle...' : 'Link erstellen'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Kontakt bearbeiten — volles ProfileEditor-Modal */}
      {showAddModal && editingContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Kontakt bearbeiten</h3>
              <div className="flex items-center gap-2">
                {!editingContact.userId && (
                  <button
                    onClick={() => handleDeleteContact(editingContact.id)}
                    className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                  >
                    Löschen
                  </button>
                )}
                <button
                  onClick={() => { setShowAddModal(false); setEditingContact(null) }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <ProfileEditor
              isOpen={true}
              onClose={() => { setShowAddModal(false); setEditingContact(null) }}
              profileData={contactToProfile(editingContact)}
              onSave={handleUpdateContact}
              onDelete={!editingContact.userId ? () => handleDeleteContact(editingContact.id) : undefined}
              isAdmin={isAdmin}
              isSelf={!!editingContact.userId && editingContact.userId === getCurrentUser()?.id}
            />
          </div>
        </div>
      )}

      {/* Manuell-Anlegen-Modal */}
      {showGastModal && (
        <GastAnlegenModal
          onClose={() => setShowGastModal(false)}
          onAdded={(contact) => setContacts(prev => [...prev, contact])}
        />
      )}

      {/* Gast-Kontakt bearbeiten */}
      {editingGast && (
        <GastAnlegenModal
          contact={editingGast}
          onClose={() => setEditingGast(null)}
          onUpdated={(updated) => setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))}
          onDeleted={(id) => setContacts(prev => prev.filter(c => String(c.id) !== id))}
        />
      )}

      {/* Invite-Modal */}
      {inviteContact && (
        <div className="modal-overlay">
          <div className="modal-container max-w-md">
            <div className="modal-header">
              <h2 className="modal-title">Zugang einrichten</h2>
              <button onClick={() => setInviteContact(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body space-y-4">
              <p className="text-sm text-gray-500">
                {inviteContact.firstName} {inviteContact.lastName} erhält einen Einladungs-Link (7 Tage gültig).
              </p>

              {inviteError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{inviteError}</div>
              )}

              {!inviteLink ? (
                <>
                  <div>
                    <label className="form-label">E-Mail-Adresse</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      className="form-input"
                      placeholder="email@beispiel.de"
                    />
                  </div>
                  <div>
                    <label className="form-label">Rolle</label>
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as TenantRole)}
                      className="form-input"
                    >
                      {(Object.entries(ROLE_LABELS) as [TenantRole, string][]).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <label className="form-label">Einladungs-Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      className="form-input text-xs font-mono"
                    />
                    <button
                      onClick={handleCopyInviteLink}
                      className={`btn flex-shrink-0 ${inviteCopied ? 'btn-success' : 'btn-primary'}`}
                    >
                      {inviteCopied ? <CheckCircleIcon className="w-4 h-4" /> : <Save size={13} />}
                      {inviteCopied ? 'Kopiert' : 'Kopieren'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">Link an {inviteEmail} schicken. Gültig 7 Tage.</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <div />
              <div className="flex gap-2">
                <button onClick={() => setInviteContact(null)} className="btn btn-ghost">
                  {inviteLink ? 'Schließen' : 'Abbrechen'}
                </button>
                {!inviteLink && (
                  <button onClick={handleCreateInvite} disabled={inviteSaving} className="btn btn-primary disabled:opacity-50">
                    {inviteSaving ? <Loader2 size={13} className="animate-spin" /> : <KeyIcon className="w-4 h-4" />}
                    Link erstellen
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ContactTable({
  contacts,
  isAdmin,
  canEdit = false,
  onEdit,
  onInviteModal,
}: {
  contacts: Contact[]
  isAdmin: boolean
  canEdit?: boolean
  onEdit: (c: Contact) => void
  onInviteModal: (c: Contact, e: React.MouseEvent) => void
}) {
  const { sortKey, sortDir, sorted, toggleSort } = useSortable(
    contacts as unknown as Record<string, unknown>[],
    'lastName'
  )
  return (
    <table className="data-table">
      <thead>
        <tr>
          {CONTACT_COLS.map(([label, key]) => (
            <th key={key as string} className="sortable" onClick={() => toggleSort(key as string)}>
              {label}
              <span className={`sort-indicator${sortKey === key ? ' active' : ''}`}>
                {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
              </span>
            </th>
          ))}
          {isAdmin && <th className="text-center">Zugang</th>}
        </tr>
      </thead>
      <tbody>
        {(sorted as unknown as Contact[]).map((contact) => (
          <tr key={contact.id} className={`${canEdit ? 'clickable' : ''}${contact.tenantRole === null && contact.userId ? ' opacity-50' : ''}`} onClick={canEdit ? () => onEdit(contact) : undefined}>
            <td>
              {contact.firstName}
              {contact.contactType === 'guest' && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: '#f3f4f6', color: '#9ca3af', letterSpacing: '0.04em' }}>
                  Manuell
                </span>
              )}
            </td>
            <td>{contact.lastName}</td>
            <td>{contact.function1}</td>
            <td>{contact.function2}</td>
            <td>{contact.function3}</td>
            <td>{contact.specification}</td>
            <td>{contact.tenantRole ? (ROLE_LABELS[contact.tenantRole as TenantRole] ?? contact.tenantRole) : contact.accessRights}</td>
            {isAdmin && (
              <td className="text-center" onClick={e => e.stopPropagation()}>
                {contact.contactType === 'guest' ? (
                  <span title="Manueller Kontakt – kein Login" className="inline-flex items-center justify-center text-gray-300">
                    <UserIcon className="w-4 h-4" />
                  </span>
                ) : contact.userId ? (
                  <button
                    onClick={e => onInviteModal(contact, e)}
                    className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-800 transition-colors"
                    title="Login aktiv – Passwort zurücksetzen"
                  >
                    <CheckCircleIcon className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={e => onInviteModal(contact, e)}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                    title="Login einrichten"
                  >
                    <KeyIcon className="w-4 h-4" />
                  </button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
