'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Plus, Check, Loader2 } from 'lucide-react'
import {
  getTravelPartyPicker,
  addTravelPartyMember,
  type TravelPartyPickerContact,
  type TravelPartyMember,
} from '@/lib/api-client'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'

interface ReisegruppePickerProps {
  terminId: number
  onClose: () => void
  onAdded: (member: TravelPartyMember) => void
}

const AVAIL = {
  available:   { color: '#22c55e', symbol: '✓', label: 'verfügbar' },
  maybe:       { color: '#eab308', symbol: '?', label: 'vielleicht' },
  unavailable: { color: '#ef4444', symbol: '✗', label: 'nicht verfügbar' },
  null:        { color: '#9ca3af', symbol: '–', label: 'keine Angabe' },
}

function AvailIcon({ status }: { status: TravelPartyPickerContact['availabilityStatus'] }) {
  const a = AVAIL[status ?? 'null'] ?? AVAIL.null
  return <span style={{ fontSize: 13, fontWeight: 700, color: a.color, flexShrink: 0, width: 16, textAlign: 'center' }} title={a.label}>{a.symbol}</span>
}

export default function ReisegruppePicker({ terminId, onClose, onAdded }: ReisegruppePickerProps) {
  const { layout } = useLayout()
  const dark = layout === 'L2'

  const [contacts, setContacts] = useState<TravelPartyPickerContact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<number | null>(null)

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

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
        .toLowerCase().includes(q)
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

  // Colors
  const bg         = dark ? '#2d2d2d' : '#ffffff'
  const border      = dark ? '#4a4a4a' : '#e5e7eb'
  const titleColor  = dark ? '#e0e0e0' : '#111827'
  const labelColor  = dark ? '#b0b0b0' : '#6b7280'
  const rowHoverBg  = dark ? '#383838' : '#f9fafb'
  const rowAddedBg  = dark ? '#1e3a1e' : '#f0fdf4'
  const inputBg     = dark ? '#3c3c3c' : '#ffffff'
  const inputBorder = dark ? '#555555' : '#d1d5db'
  const inputColor  = dark ? '#e0e0e0' : '#111827'
  const dividerColor = dark ? '#3c3c3c' : '#f3f4f6'
  const namColor    = dark ? '#e0e0e0' : '#111827'
  const metaColor   = dark ? '#9ca3af' : '#6b7280'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: bg, borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: '100%', maxWidth: 560, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: titleColor, margin: 0 }}>Kontakt zur Reisegruppe hinzufügen</h3>
          <button onClick={onClose} style={{ color: labelColor, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2 }}>
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <input
            autoFocus
            type="text"
            placeholder="Suche: Name, Funktion, Stadt …"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '7px 12px', fontSize: 13, background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 4, color: inputColor, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
              <Loader2 size={16} className="animate-spin" style={{ color: labelColor }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 20px', fontSize: 13, color: labelColor }}>Keine Kontakte gefunden.</div>
          ) : (
            filtered.map((c, i) => {
              const roles = [c.function1, c.function2, c.function3].filter(Boolean).join(' · ')
              const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || '(ohne Name)'
              return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px',
                    borderBottom: i < filtered.length - 1 ? `1px solid ${dividerColor}` : 'none',
                    background: c.alreadyAdded ? rowAddedBg : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!c.alreadyAdded) (e.currentTarget as HTMLDivElement).style.background = rowHoverBg }}
                  onMouseLeave={e => { if (!c.alreadyAdded) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <AvailIcon status={c.availabilityStatus} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: namColor, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {name}
                      {c.contactType === 'guest' && (
                        <span style={{ fontSize: 10, fontWeight: 600, background: '#dbeafe', color: '#1d4ed8', padding: '1px 5px', borderRadius: 3 }}>Gast</span>
                      )}
                    </div>
                    {(roles || c.residence) && (
                      <div style={{ fontSize: 11, color: metaColor, marginTop: 1 }}>
                        {[roles, c.residence].filter(Boolean).join(' — ')}
                      </div>
                    )}
                  </div>
                  {c.alreadyAdded ? (
                    <span style={{ fontSize: 11, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                      <Check size={11} /> hinzugefügt
                    </span>
                  ) : (
                    <button
                      disabled={adding === c.id}
                      onClick={() => handleAdd(c)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                        fontSize: 12, fontWeight: 500, background: '#3b82f6', color: '#fff',
                        border: 'none', borderRadius: 4, cursor: adding === c.id ? 'not-allowed' : 'pointer',
                        opacity: adding === c.id ? 0.6 : 1, flexShrink: 0,
                      }}
                    >
                      {adding === c.id ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                      Hinzufügen
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ padding: '7px 16px', fontSize: 13, fontWeight: 500, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  )
}
