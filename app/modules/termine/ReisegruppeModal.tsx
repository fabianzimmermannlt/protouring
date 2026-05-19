'use client'

import { useState, useMemo, useEffect } from 'react'
import { X, Save, Trash2, Loader2 } from 'lucide-react'
import {
  updateTravelPartyMember,
  deleteTravelPartyMember,
  type TravelPartyMember,
} from '@/lib/api-client'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'

interface ReisegruppeModalProps {
  terminId: number
  member: TravelPartyMember
  onClose: () => void
  onSaved: (m: TravelPartyMember) => void
  onDeleted: () => void
}

export default function ReisegruppeModal({ terminId, member, onClose, onSaved, onDeleted }: ReisegruppeModalProps) {
  const { layout } = useLayout()
  const dark = layout === 'L2'

  const [role1, setRole1] = useState(member.role1)
  const [role2, setRole2] = useState(member.role2)
  const [role3, setRole3] = useState(member.role3)
  const [spec, setSpec]   = useState(member.specification)
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const roleOptions = useMemo(() => {
    const set = new Set<string>()
    ;[member.function1, member.function2, member.function3].forEach(f => { if (f?.trim()) set.add(f.trim()) })
    return Array.from(set)
  }, [member])

  const handleSave = async () => {
    setSaving(true); setError(null)
    try {
      const saved = await updateTravelPartyMember(terminId, member.id, {
        role1, role2, role3, specification: spec, sortOrder: member.sortOrder,
      })
      onSaved(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || 'Mitglied'
    if (!confirm(`„${name}" aus der Reisegruppe entfernen?`)) return
    setDeleting(true)
    try {
      await deleteTravelPartyMember(terminId, member.id)
      onDeleted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Entfernen')
    } finally {
      setDeleting(false)
    }
  }

  // Colors
  const bg          = dark ? '#2d2d2d' : '#ffffff'
  const border      = dark ? '#4a4a4a' : '#e5e7eb'
  const titleColor  = dark ? '#e0e0e0' : '#111827'
  const labelColor  = dark ? '#b0b0b0' : '#6b7280'
  const inputBg     = dark ? '#3c3c3c' : '#ffffff'
  const inputBorder = dark ? '#555555' : '#d1d5db'
  const inputColor  = dark ? '#e0e0e0' : '#111827'
  const hintColor   = dark ? '#6b7280' : '#9ca3af'

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 12px', fontSize: 13,
    background: inputBg, border: `1px solid ${inputBorder}`,
    borderRadius: 4, color: inputColor, outline: 'none', boxSizing: 'border-box',
  }

  const name = [member.firstName, member.lastName].filter(Boolean).join(' ')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: bg, borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: '100%', maxWidth: 420, border: `1px solid ${border}` }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${border}` }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: titleColor, margin: 0 }}>
            {name || 'Reisegruppe'}
          </h3>
          <button onClick={onClose} style={{ color: labelColor, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ fontSize: 12, color: '#f87171', background: dark ? '#3d1f1f' : '#fef2f2', border: `1px solid ${dark ? '#7f1d1d' : '#fecaca'}`, borderRadius: 4, padding: '8px 12px' }}>
              {error}
            </div>
          )}

          <datalist id="role-options-reisegruppe">
            {roleOptions.map(r => <option key={r} value={r} />)}
          </datalist>

          {(['Funktion 1', 'Funktion 2', 'Funktion 3'] as const).map((label, i) => {
            const value  = i === 0 ? role1 : i === 1 ? role2 : role3
            const setter = i === 0 ? setRole1 : i === 1 ? setRole2 : setRole3
            return (
              <div key={label}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: labelColor, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                <input
                  list="role-options-reisegruppe"
                  type="text"
                  value={value}
                  onChange={e => setter(e.target.value)}
                  placeholder="z.B. Tour Manager, FOH, Keys"
                  style={inputStyle}
                />
              </div>
            )
          })}

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: labelColor, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Spezifikation</label>
            <textarea
              value={spec}
              onChange={e => setSpec(e.target.value)}
              placeholder="Details zur Rolle für diese Show…"
              rows={3}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>

          <div style={{ fontSize: 11, color: hintColor, paddingTop: 4, borderTop: `1px solid ${border}` }}>
            Stammdaten werden live aus dem Kontakt-Profil übernommen und können dort geändert werden.
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: `1px solid ${border}` }}>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 13, fontWeight: 500, background: dark ? '#3d1f1f' : '#fef2f2', color: '#ef4444', border: `1px solid ${dark ? '#7f1d1d' : '#fecaca'}`, borderRadius: 4, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1 }}
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Entfernen
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{ padding: '7px 14px', fontSize: 13, color: labelColor, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4 }}
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', fontSize: 13, fontWeight: 500, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
