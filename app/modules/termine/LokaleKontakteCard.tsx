'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Loader2 } from 'lucide-react'
import {
  getTerminContacts,
  type TerminContact,
} from '@/lib/api-client'
import KontaktModal from './KontaktModal'

export default function LokaleKontakteCard({ terminId, isAdmin, layout = 'stack' }: { terminId: number; isAdmin: boolean; layout?: 'stack' | 'grid-3' }) {
  const [contacts, setContacts] = useState<TerminContact[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TerminContact | null>(null)

  useEffect(() => {
    getTerminContacts(terminId)
      .then(setContacts)
      .catch(() => setContacts([]))
      .finally(() => setLoading(false))
  }, [terminId])

  const openNew  = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (c: TerminContact) => { setEditing(c); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleSaved = (saved: TerminContact) => {
    setContacts(prev => {
      const exists = prev.find(c => c.id === saved.id)
      return exists ? prev.map(c => c.id === saved.id ? saved : c) : [...prev, saved]
    })
    closeModal()
  }

  const handleDeleted = () => {
    if (editing) setContacts(prev => prev.filter(c => c.id !== editing.id))
    closeModal()
  }

  if (loading) {
    return (
      <div className="pt-card">
        <div className="pt-card-header"><span className="pt-card-title">Lokale Ansprechpartner</span></div>
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  const cards = contacts.map(contact => (
        <div key={contact.id} className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title">{contact.label || 'Ansprechpartner'}</span>
            {isAdmin && (
              <button
                onClick={() => openEdit(contact)}
                className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                title="Bearbeiten"
              >
                <Pencil size={12} />
              </button>
            )}
          </div>
          <div className="pt-card-body space-y-0">
            {(contact.firstName || contact.name) && (
              <div className="pt-contact-row">
                <span className="pt-contact-field-label">Name</span>
                <span className="text-sm text-gray-800">
                  {[contact.firstName, contact.name].filter(Boolean).join(' ')}
                </span>
              </div>
            )}
            {contact.phone && (
              <div className="pt-contact-row">
                <span className="pt-contact-field-label">Telefon</span>
                <a href={`tel:${contact.phone}`} className="text-sm text-blue-600 hover:underline">
                  {contact.phone}
                </a>
              </div>
            )}
            {contact.email && (
              <div className="pt-contact-row">
                <span className="pt-contact-field-label">E-Mail</span>
                <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:underline">
                  {contact.email}
                </a>
              </div>
            )}
            {contact.notes && (
              <div className="pt-contact-row" style={{ alignItems: 'flex-start' }}>
                <span className="pt-contact-field-label" style={{ paddingTop: '0.1rem' }}>Hinweis</span>
                <span className="text-sm text-gray-500 whitespace-pre-wrap">{contact.notes}</span>
              </div>
            )}
          </div>
        </div>
  ))

  const addButton = isAdmin && (
    <button onClick={openNew} className="pt-card-new">
      <div className="flex items-center justify-center gap-2 px-4 py-4 text-gray-300">
        <Plus size={14} />
        <span className="text-xs font-medium">Neuer Ansprechpartner</span>
      </div>
    </button>
  )

  return (
    <>
      {layout === 'grid-3' ? (
        <div className="grid grid-cols-3 gap-4">
          {cards}
          {addButton}
        </div>
      ) : (
        <>
          {cards}
          {addButton}
        </>
      )}

      {modalOpen && (
        <KontaktModal
          terminId={terminId}
          contact={editing}
          sortOrder={contacts.length}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={editing ? handleDeleted : undefined}
        />
      )}
    </>
  )
}
