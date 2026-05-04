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
import {
  getContacts, createContact, updateContact, updateMyContact, deleteContact, createGuestContact,
  getCurrentUser, getCurrentTenant, createInvite, getFunctionCatalog,
  ROLE_LABELS, isAdminRole, isEditorRole, getEffectiveRole,
  type Contact, type ContactFormData, type TenantRole, type FunctionCatalogGroup
} from '@/lib/api-client'
import { useSortable } from '@/app/hooks/useSortable'
import { parseCSV, col } from '@/lib/csvParser'
import { useIsMobile } from '@/app/hooks/useIsMobile'

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
    specification: data.specification || '',
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
    hotelInfo: data.hotelInfo || '', hotelAlias: data.hotelAlias || '',
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
    specialNotes: c.notes, hotelInfo: c.hotelInfo || '', hotelAlias: c.hotelAlias || '', personalFiles: [],
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
  const [addInviteFirstName, setAddInviteFirstName] = useState('')
  const [addInviteLastName, setAddInviteLastName] = useState('')
  const [addInviteRole, setAddInviteRole] = useState<TenantRole>('crew')
  const [addInviteLink, setAddInviteLink] = useState('')
  const [addInviteCopied, setAddInviteCopied] = useState(false)
  const [addInviteSaving, setAddInviteSaving] = useState(false)
  const [addInviteError, setAddInviteError] = useState('')
  const [functionCatalog, setFunctionCatalog] = useState<FunctionCatalogGroup[]>([])

  // Invite-Modal (von bestehendem Kontakt aus)
  const [inviteContact, setInviteContact] = useState<Contact | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteLastName, setInviteLastName] = useState('')
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

  useEffect(() => {
    const onInvite = () => openAddModal()
    const onCreate = () => setShowGastModal(true)
    window.addEventListener('contact-sidebar-invite', onInvite)
    window.addEventListener('contact-sidebar-create', onCreate)
    return () => {
      window.removeEventListener('contact-sidebar-invite', onInvite)
      window.removeEventListener('contact-sidebar-create', onCreate)
    }
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

  const openAddModal = () => {
    setAddInviteEmail(''); setAddInviteFirstName(''); setAddInviteLastName('')
    setAddInviteRole('crew'); setAddInviteLink('')
    setAddInviteCopied(false); setAddInviteError(''); setAddInviteSaving(false)
    setShowAddModal(true)
  }

  const handleAddInvite = async () => {
    if (!addInviteEmail.trim()) { setAddInviteError('E-Mail fehlt'); return }
    if (!addInviteFirstName.trim()) { setAddInviteError('Vorname fehlt'); return }
    if (!addInviteLastName.trim()) { setAddInviteError('Nachname fehlt'); return }
    setAddInviteSaving(true); setAddInviteError('')
    try {
      const result = await createInvite(addInviteEmail.trim(), addInviteRole, undefined, addInviteFirstName.trim(), addInviteLastName.trim())
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
    setInviteFirstName(contact.firstName || '')
    setInviteLastName(contact.lastName || '')
    setInviteRole('crew')
    setInviteContact(contact)
  }

  const handleCreateInvite = async () => {
    if (!inviteContact) return
    if (!inviteEmail) { setInviteError('E-Mail fehlt'); return }
    if (!inviteFirstName.trim()) { setInviteError('Vorname fehlt'); return }
    if (!inviteLastName.trim()) { setInviteError('Nachname fehlt'); return }
    setInviteSaving(true)
    setInviteError('')
    try {
      const contactId = typeof inviteContact.id === 'number' ? inviteContact.id : parseInt(inviteContact.id as string)
      const result = await createInvite(inviteEmail, inviteRole, contactId, inviteFirstName.trim(), inviteLastName.trim())
      const baseUrl = window.location.origin
      setInviteLink(`${baseUrl}${result.invite_url}`)
    } catch (e: any) {
      setInviteError(e?.message ?? 'Fehler beim Erstellen')
    } finally {
      setInviteSaving(false)
    }
  }

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        const el = document.createElement('textarea')
        el.value = text
        el.style.position = 'fixed'
        el.style.left = '-9999px'
        document.body.appendChild(el)
        el.focus()
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      return true
    } catch {
      return false
    }
  }

  const handleCopyInviteLink = async () => {
    const ok = await copyToClipboard(inviteLink)
    if (ok) {
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2500)
    } else {
      setInviteError('Kopieren fehlgeschlagen – Link manuell kopieren')
    }
  }

  const handleCSVExport = () => {
    const headers = ['Vorname', 'Nachname', 'Funktion 1', 'Funktion 2', 'Funktion 3',
      'Spezifikation', 'Zugriffsrechte', 'E-Mail', 'Telefon', 'Anschrift', 'PLZ', 'Ort',
      'Steuer-ID', 'Stundensatz', 'Tagessatz', 'Notizen']
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csvContent = [
      headers.join(';'),
      ...contacts.map(c => [
        c.firstName, c.lastName, c.function1, c.function2, c.function3,
        c.specification, c.accessRights, c.email, c.phone, c.address,
        c.postalCode, c.residence, c.taxId, c.hourlyRate, c.dailyRate, c.notes
      ].map(escape).join(';'))
    ].join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
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
      const rows = parseCSV(text).slice(1) // Header überspringen
      for (const row of rows) {
        if (!col(row, 0)) continue
        try {
            const c = await createContact({
              firstName: col(row, 0), lastName: col(row, 1),
              function1: col(row, 2), function2: col(row, 3), function3: col(row, 4),
              specification: col(row, 5), accessRights: col(row, 6),
              email: col(row, 7), phone: col(row, 8), mobile: '',
              address: col(row, 9), postalCode: col(row, 10), residence: col(row, 11),
              taxId: col(row, 12), website: '', birthDate: '', gender: '', pronouns: '',
              birthPlace: '', nationality: '', idNumber: '', socialSecurity: '', diet: '',
              glutenFree: false, lactoseFree: false, allergies: '', emergencyContact: '',
              emergencyPhone: '', shirtSize: '', hoodieSize: '', pantsSize: '', shoeSize: '',
              languages: '', driversLicense: '', railcard: '', frequentFlyer: '',
              bankAccount: '', bankIban: '', bankBic: '', taxNumber: '', vatId: '',
              crewToolActive: true, hourlyRate: parseFloat(col(row, 13)) || 0,
              dailyRate: parseFloat(col(row, 14)) || 0, notes: col(row, 15),
              hotelInfo: '', hotelAlias: '',
            })
            setContacts(prev => [...prev, c])
          } catch {}

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

  const isMobile = useIsMobile()

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact)
  }

  const handleCreateGast = async (profileData: ProfileData) => {
    try {
      const created = await createGuestContact({
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        phone: profileData.phone || '',
        function1: profileData.function1 || '',
        function2: profileData.function2 || '',
        function3: profileData.function3 || '',
      })
      if (created.id) {
        const updated = await updateContact(created.id, profileToContact(profileData))
        setContacts(prev => [...prev, updated])
        window.dispatchEvent(new CustomEvent('contact-created', { detail: { contact: updated } }))
      } else {
        setContacts(prev => [...prev, created])
        window.dispatchEvent(new CustomEvent('contact-created', { detail: { contact: created } }))
      }
      setShowGastModal(false)
    } catch (e) {
      setError('Kontakt konnte nicht angelegt werden.')
    }
  }

  const handleUpdateContact = async (profileData: ProfileData) => {
    if (!editingContact) return
    const currentUser = getCurrentUser()
    const isOwnContact = editingContact.userId && String(editingContact.userId) === String(currentUser?.id)
    try {
      let updated: Contact
      if (isOwnContact) {
        // Eigenes Profil: PUT /api/me/contact (kein requireEditor, schreibt global in users)
        updated = await updateMyContact(profileToContact(profileData))
      } else {
        updated = await updateContact(editingContact.id, profileToContact(profileData))
      }
      setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))
      setEditingContact(null)
    } catch (e) {
      setError('Kontakt konnte nicht aktualisiert werden.')
      throw e // re-throw damit ProfileEditor den Fehler kennt
    }
  }

  const handleDeleteContact = async () => {
    if (!editingContact) return
    try {
      await deleteContact(editingContact.id)
      setContacts(prev => prev.filter(c => c.id !== editingContact.id))
      setEditingContact(null)
    } catch (e) {
      setError('Kontakt konnte nicht entfernt werden.')
    }
  }

  const renderContent = () => {
    switch (activeSubTab) {
      case 'overview':
        return (
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {isMobile ? (
              /* ── Mobile Toolbar ── */
              isEditor && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <button onClick={openAddModal} className="btn btn-primary">
                      <Plus className="w-4 h-4" /> Einladen
                    </button>
                    <button onClick={() => setShowGastModal(true)} title="Manuell anlegen" className="btn btn-ghost">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={handleCSVExport} title="CSV Export" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                      <Download className="w-5 h-5" />
                    </button>
                    <label className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer" title="CSV Import">
                      <Upload className="w-5 h-5" />
                      <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
                    </label>
                  </div>
                </div>
              )
            ) : (
              /* ── Desktop Toolbar ── */
              isEditor && (
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <button onClick={openAddModal} className="btn btn-primary">
                      <Plus className="w-4 h-4" /> Einladen
                    </button>
                    <button onClick={() => setShowGastModal(true)} className="btn btn-ghost" title="Manuellen Kontakt anlegen (kein Login)">
                      <Plus className="w-4 h-4" /> Manuell anlegen
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleCSVExport} className="btn btn-ghost">
                      <Download className="w-4 h-4" /> CSV
                    </button>
                    <label className="btn btn-ghost cursor-pointer">
                      <Upload className="w-4 h-4" /> CSV
                      <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
                    </label>
                  </div>
                </div>
              )
            )}

            <input
              type="text"
              placeholder="Kontakte durchsuchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />

            {loading ? (
              <div className="text-center py-8 text-gray-500">Wird geladen...</div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Keine Kontakte gefunden</div>
            ) : isMobile ? (
              /* ── Mobile Card List ── */
              <div className="flex flex-col gap-2">
                {filteredContacts.map(contact => {
                  const functions = [contact.function1, contact.function2, contact.function3].filter(Boolean).join(' · ')
                  const role = contact.tenantRole
                    ? (ROLE_LABELS[contact.tenantRole as TenantRole] ?? contact.tenantRole)
                    : contact.accessRights
                  const initials = [contact.firstName?.[0], contact.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
                  return (
                    <div
                      key={contact.id}
                      className={`bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 ${contact.tenantRole === null && contact.userId ? 'opacity-50' : ''} ${contact.invitePending ? 'opacity-50' : ''}`}
                      onClick={isEditor ? () => handleEdit(contact) : undefined}
                    >
                      {/* Initials avatar */}
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                        {initials}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold text-sm text-gray-900 ${contact.invitePending ? 'italic' : ''}`}>
                            {contact.firstName} {contact.lastName}
                          </span>
                          {contact.contactType === 'guest' && (
                            <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-medium">Manuell</span>
                          )}
                          {contact.invitePending && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-medium">Eingeladen</span>
                          )}
                        </div>
                        {functions && <div className="text-xs text-gray-500 mt-0.5">{functions}</div>}
                        {role && <div className="text-xs text-gray-400">{role}</div>}
                      </div>
                      {/* Access status */}
                      {isAdmin && (
                        <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                          {contact.contactType === 'guest' ? (
                            <UserIcon className="w-4 h-4 text-gray-300" />
                          ) : contact.userId ? (
                            <button onClick={e => openInviteModal(contact, e)} title="Login aktiv">
                              <CheckCircleIcon className="w-4 h-4 text-green-500" />
                            </button>
                          ) : (
                            <button onClick={e => openInviteModal(contact, e)} title="Login einrichten">
                              <KeyIcon className="w-4 h-4 text-gray-300 hover:text-blue-500" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              /* ── Desktop Table ── */
              <div className="data-table-wrapper">
                <ContactTable
                  contacts={filteredContacts}
                  isAdmin={isAdmin}
                  canEdit={isEditor}
                  onEdit={handleEdit}
                  onInviteModal={openInviteModal}
                />
              </div>
            )}
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
    <div className="space-y-4">
      {renderContent()}

      {/* Neuer-Kontakt-Modal (nur Einladen) */}
      {showAddModal && (
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Vorname *</label>
                      <input
                        type="text"
                        value={addInviteFirstName}
                        onChange={e => setAddInviteFirstName(e.target.value)}
                        placeholder="Max"
                        autoFocus
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nachname *</label>
                      <input
                        type="text"
                        value={addInviteLastName}
                        onChange={e => setAddInviteLastName(e.target.value)}
                        placeholder="Mustermann"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">E-Mail *</label>
                    <input
                      type="email"
                      value={addInviteEmail}
                      onChange={e => setAddInviteEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddInvite()}
                      placeholder="email@beispiel.de"
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
                        const ok = await copyToClipboard(addInviteLink)
                        if (ok) {
                          setAddInviteCopied(true)
                          setTimeout(() => setAddInviteCopied(false), 2500)
                        }
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


      {/* Manuell-Anlegen-Modal – gleiche Ansicht wie Bearbeiten */}
      {showGastModal && (
        <div className="modal-overlay">
          <div className="modal-container max-w-3xl">
            <div className="modal-header">
              <h2 className="modal-title">Manuellen Kontakt anlegen</h2>
              <button onClick={() => setShowGastModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <ProfileEditor
              isOpen={true}
              onClose={() => setShowGastModal(false)}
              profileData={{} as ProfileData}
              onSave={handleCreateGast}
              isAdmin={isAdmin}
              isSelf={false}
            />
          </div>
        </div>
      )}

      {/* Kontakt bearbeiten – ProfileEditor (keine Tabs) */}
      {editingContact && (
        <div className="modal-overlay">
          <div className="modal-container max-w-3xl">
            <div className="modal-header">
              <h2 className="modal-title">{editingContact.firstName} {editingContact.lastName}</h2>
              <button onClick={() => setEditingContact(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <ProfileEditor
              isOpen={true}
              onClose={() => setEditingContact(null)}
              profileData={contactToProfile(editingContact)}
              onSave={handleUpdateContact}
              onDelete={isAdmin ? handleDeleteContact : undefined}
              isAdmin={isAdmin}
              isSelf={false}
              hasUserAccount={!!editingContact.userId}
            />
          </div>
        </div>
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
                Einladungs-Link (7 Tage gültig). Name und Rolle sind sofort in den Berechtigungen sichtbar.
              </p>

              {inviteError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{inviteError}</div>
              )}

              {!inviteLink ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Vorname *</label>
                      <input
                        type="text"
                        value={inviteFirstName}
                        onChange={e => setInviteFirstName(e.target.value)}
                        className="form-input"
                        placeholder="Max"
                      />
                    </div>
                    <div>
                      <label className="form-label">Nachname *</label>
                      <input
                        type="text"
                        value={inviteLastName}
                        onChange={e => setInviteLastName(e.target.value)}
                        className="form-input"
                        placeholder="Mustermann"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">E-Mail-Adresse *</label>
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
          <tr key={contact.id}
            className={`${canEdit ? 'clickable' : ''}${contact.tenantRole === null && contact.userId ? ' opacity-50' : ''}${contact.invitePending ? ' opacity-50 italic' : ''}`}
            onClick={canEdit ? () => onEdit(contact) : undefined}>
            <td>
              {contact.firstName}
              {contact.contactType === 'guest' && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: '#f3f4f6', color: '#9ca3af', letterSpacing: '0.04em' }}>
                  Manuell
                </span>
              )}
              {contact.invitePending && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: '#fef9c3', color: '#92400e', letterSpacing: '0.04em' }}>
                  Eingeladen
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
