'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Plus, Check, Loader2 } from 'lucide-react'
import {
  getTravelPartyPicker,
  addTravelPartyMember,
  type TravelPartyPickerContact,
  type TravelPartyMember,
} from '@/lib/api-client'

interface ReisegruppePickerProps {
  terminId: number
  onClose: () => void
  onAdded: (member: TravelPartyMember) => void
}

function AvailIcon({ status }: { status: TravelPartyPickerContact['availabilityStatus'] }) {
  if (status === 'available')   return <span className="pt-travel-avail pt-travel-avail--available"  title="verfügbar">✓</span>
  if (status === 'maybe')       return <span className="pt-travel-avail pt-travel-avail--maybe"      title="vielleicht">?</span>
  if (status === 'unavailable') return <span className="pt-travel-avail pt-travel-avail--unavailable" title="nicht verfügbar">✗</span>
  return <span className="pt-travel-avail pt-travel-avail--unknown" title="keine Angabe">–</span>
}

export default function ReisegruppePicker({ terminId, onClose, onAdded }: ReisegruppePickerProps) {
  const [contacts, setContacts] = useState<TravelPartyPickerContact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<number | null>(null)

  useEffect(() => {
    getTravelPartyPicker(terminId)
      .then(setContacts)
      .catch(() => setContacts([]))
      .finally(() => setLoading(false))
  }, [terminId])

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts
    const q = search.toLowerCase()
    return contacts.filter(c =>
      `${c.firstName} ${c.lastName} ${c.email} ${c.function1} ${c.function2} ${c.function3} ${c.residence}`
        .toLowerCase()
        .includes(q)
    )
  }, [contacts, search])

  const handleAdd = async (contact: TravelPartyPickerContact) => {
    setAdding(contact.id)
    try {
      const member = await addTravelPartyMember(terminId, {
        contactId: contact.id,
        role1: contact.function1 ?? '',
        role2: contact.function2 ?? '',
        role3: contact.function3 ?? '',
      })
      onAdded(member)
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, alreadyAdded: true } : c))
    } catch (e) {
      console.error(e)
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-2xl">
        <div className="modal-header">
          <h2 className="modal-title">Kontakt zur Reisegruppe hinzufügen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <input
            type="text"
            placeholder="Suche: Name, Funktion, Stadt …"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pt-picker-search"
          />

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="pt-travel-empty">Keine Kontakte gefunden.</div>
          ) : (
            <div className="pt-picker-list">
              {filtered.map(c => {
                const roles = [c.function1, c.function2, c.function3].filter(Boolean).join(' · ')
                return (
                  <div key={c.id} className={`pt-picker-row ${c.alreadyAdded ? 'pt-picker-row--added' : ''}`}>
                    <AvailIcon status={c.availabilityStatus} />
                    <div>
                      <div className="pt-picker-name">
                        {[c.firstName, c.lastName].filter(Boolean).join(' ') || '(ohne Name)'}
                        {c.contactType === 'guest' && <span className="pt-guest-badge">Gast</span>}
                      </div>
                      {(roles || c.residence) && (
                        <div className="pt-picker-meta">
                          {[roles, c.residence].filter(Boolean).join(' — ')}
                        </div>
                      )}
                    </div>
                    {c.alreadyAdded ? (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Check size={12} /> hinzugefügt
                      </span>
                    ) : (
                      <button
                        className="pt-picker-add-btn"
                        disabled={adding === c.id}
                        onClick={() => handleAdd(c)}
                      >
                        {adding === c.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Plus size={12} />}
                        Hinzufügen
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div />
          <button onClick={onClose} className="btn btn-primary">Fertig</button>
        </div>
      </div>
    </div>
  )
}
