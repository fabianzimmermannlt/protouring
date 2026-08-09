'use client'

import { useState, useEffect, useMemo, type CSSProperties } from 'react'
import { X, Plus, Check, Loader2, UserPlus, Mail } from 'lucide-react'
import {
  getTravelPartyPicker,
  addTravelPartyMember,
  createGuestTravelPartyMember,
  createInvite,
  ROLE_LABELS,
  isAdminRole,
  getEffectiveRole,
  type TravelPartyPickerContact,
  type TravelPartyMember,
  type TenantRole,
} from '@/lib/api-client'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'

interface ReisegruppePickerProps {
  terminId: number
  onClose: () => void
  onAdded: (member: TravelPartyMember) => void
}

const AVAIL = {
  available:   { color: 'var(--success)', symbol: '✓', label: 'verfügbar' },
  maybe:       { color: '#eab308', symbol: '?', label: 'vielleicht' },
  unavailable: { color: 'var(--danger)', symbol: '✗', label: 'nicht verfügbar' },
  null:        { color: 'var(--text-muted)', symbol: '–', label: 'keine Angabe' },
}

function AvailIcon({ status }: { status: TravelPartyPickerContact['availabilityStatus'] }) {
  const a = AVAIL[status ?? 'null'] ?? AVAIL.null
  return <span style={{ fontSize: 13, fontWeight: 700, color: a.color, flexShrink: 0, width: 16, textAlign: 'center' }} title={a.label}>{a.symbol}</span>
}

export default function ReisegruppePicker({ terminId, onClose, onAdded }: ReisegruppePickerProps) {
  const { layout } = useLayout()
  const dark = true // App fest Dark-Mode

  const [contacts, setContacts] = useState<TravelPartyPickerContact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<number | null>(null)

  // Neu anlegen / Einladen
  const [mode, setMode] = useState<'none' | 'guest' | 'invite'>('none')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [gFirst, setGFirst] = useState(''); const [gLast, setGLast] = useState(''); const [gFunc, setGFunc] = useState('')
  const [iFirst, setIFirst] = useState(''); const [iLast, setILast] = useState(''); const [iEmail, setIEmail] = useState('')
  const [iRole, setIRole] = useState<TenantRole>('crew')
  const canInvite = isAdminRole(getEffectiveRole())

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

  const submitGuest = async () => {
    if (!gFirst.trim() && !gLast.trim()) { setCreateError('Bitte einen Namen eingeben.'); return }
    setCreating(true); setCreateError('')
    try {
      const member = await createGuestTravelPartyMember(terminId, { firstName: gFirst.trim(), lastName: gLast.trim(), function1: gFunc.trim() })
      onAdded(member)
      setGFirst(''); setGLast(''); setGFunc(''); setMode('none')
    } catch { setCreateError('Anlegen fehlgeschlagen.') } finally { setCreating(false) }
  }

  const submitInvite = async () => {
    if (!iEmail.trim()) { setCreateError('Bitte eine E-Mail-Adresse eingeben.'); return }
    setCreating(true); setCreateError('')
    try {
      const inv = await createInvite(iEmail.trim(), iRole, undefined, iFirst.trim(), iLast.trim())
      if (inv.contact_id) {
        const member = await addTravelPartyMember(terminId, { contactId: inv.contact_id, role1: '', role2: '', role3: '' })
        onAdded(member)
      }
      setIFirst(''); setILast(''); setIEmail(''); setMode('none')
    } catch { setCreateError('Einladung fehlgeschlagen (fehlen dir die Rechte?).') } finally { setCreating(false) }
  }

  // Colors
  const bg         = dark ? 'var(--surface)' : '#ffffff'
  const border      = dark ? 'var(--border-strong)' : '#e5e7eb'
  const titleColor  = dark ? 'var(--text)' : '#111827'
  const labelColor  = dark ? '#b0b0b0' : 'var(--text-subtle)'
  const rowHoverBg  = dark ? 'var(--hover)' : '#f9fafb'
  const rowAddedBg  = dark ? '#1e3a1e' : '#f0fdf4'
  const inputBg     = dark ? 'var(--border)' : '#ffffff'
  const inputBorder = dark ? '#555555' : '#d1d5db'
  const inputColor  = dark ? 'var(--text)' : '#111827'
  const dividerColor = dark ? 'var(--border)' : '#f3f4f6'
  const namColor    = dark ? 'var(--text)' : '#111827'
  const metaColor   = dark ? 'var(--text-muted)' : 'var(--text-subtle)'

  const inpStyle: CSSProperties = { flex: 1, minWidth: 0, padding: '7px 10px', fontSize: 13, background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 0, color: inputColor, outline: 'none', boxSizing: 'border-box' }
  const tabStyle = (active: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer', borderRadius: 0, background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : titleColor, border: `1px solid ${active ? 'var(--primary)' : inputBorder}` })
  const submitStyle = (busy: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: 600, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 0, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: bg, borderRadius: 0, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: '100%', maxWidth: 560, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>

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
            style={{ width: '100%', padding: '7px 12px', fontSize: 13, background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 0, color: inputColor, outline: 'none', boxSizing: 'border-box' }}
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
                        <span style={{ fontSize: 10, fontWeight: 600, background: '#dbeafe', color: '#1d4ed8', padding: '1px 5px', borderRadius: 0}}>Gast</span>
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
                        fontSize: 12, fontWeight: 500, background: 'var(--primary)', color: '#fff',
                        border: 'none', borderRadius: 0, cursor: adding === c.id ? 'not-allowed' : 'pointer',
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

        {/* Neu anlegen / Einladen */}
        <div style={{ borderTop: `1px solid ${border}`, padding: '10px 20px', flexShrink: 0, background: dark ? 'var(--surface-2)' : '#fafafa' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setMode(mode === 'guest' ? 'none' : 'guest'); setCreateError('') }} style={tabStyle(mode === 'guest')}>
              <UserPlus size={13} /> Neue Person (Gast)
            </button>
            {canInvite && (
              <button onClick={() => { setMode(mode === 'invite' ? 'none' : 'invite'); setCreateError('') }} style={tabStyle(mode === 'invite')}>
                <Mail size={13} /> Einladen (Login)
              </button>
            )}
          </div>

          {mode === 'guest' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder="Vorname" value={gFirst} onChange={e => setGFirst(e.target.value)} style={inpStyle} />
                <input placeholder="Nachname" value={gLast} onChange={e => setGLast(e.target.value)} style={inpStyle} />
              </div>
              <input placeholder="Funktion (optional)" value={gFunc} onChange={e => setGFunc(e.target.value)} style={inpStyle} />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={submitGuest} disabled={creating} style={submitStyle(creating)}>
                  {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Anlegen &amp; hinzufügen
                </button>
              </div>
            </div>
          )}

          {mode === 'invite' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder="Vorname" value={iFirst} onChange={e => setIFirst(e.target.value)} style={inpStyle} />
                <input placeholder="Nachname" value={iLast} onChange={e => setILast(e.target.value)} style={inpStyle} />
              </div>
              <input placeholder="E-Mail" type="email" value={iEmail} onChange={e => setIEmail(e.target.value)} style={inpStyle} />
              <select value={iRole} onChange={e => setIRole(e.target.value as TenantRole)} style={inpStyle}>
                {(Object.keys(ROLE_LABELS) as TenantRole[]).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={submitInvite} disabled={creating} style={submitStyle(creating)}>
                  {creating ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />} Einladen &amp; hinzufügen
                </button>
              </div>
            </div>
          )}

          {createError && <div style={{ color: 'var(--neg)', fontSize: 12, marginTop: 8 }}>{createError}</div>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ padding: '7px 16px', fontSize: 13, fontWeight: 500, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 0, cursor: 'pointer' }}
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  )
}
