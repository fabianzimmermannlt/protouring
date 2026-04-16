'use client'

import { useState, useMemo } from 'react'
import { X, Save, Trash2, Loader2 } from 'lucide-react'
import {
  updateTravelPartyMember,
  deleteTravelPartyMember,
  type TravelPartyMember,
} from '@/lib/api-client'

interface ReisegruppeModalProps {
  terminId: number
  member: TravelPartyMember
  onClose: () => void
  onSaved: (m: TravelPartyMember) => void
  onDeleted: () => void
}

export default function ReisegruppeModal({ terminId, member, onClose, onSaved, onDeleted }: ReisegruppeModalProps) {
  const [role1, setRole1] = useState(member.role1)
  const [role2, setRole2] = useState(member.role2)
  const [role3, setRole3] = useState(member.role3)
  const [spec, setSpec]   = useState(member.specification)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dropdown options: collect distinct functions from contact profile
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

  const RoleField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <label className="form-label">{label}</label>
      <input
        list="role-options"
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="z.B. Tour Manager, FOH, Keys"
        className="form-input"
      />
    </div>
  )

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-md">
        <div className="modal-header">
          <h2 className="modal-title">
            Reisegruppe: {[member.firstName, member.lastName].filter(Boolean).join(' ')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body space-y-4">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>
          )}

          <datalist id="role-options">
            {roleOptions.map(r => <option key={r} value={r} />)}
          </datalist>

          <RoleField label="Funktion 1" value={role1} onChange={setRole1} />
          <RoleField label="Funktion 2" value={role2} onChange={setRole2} />
          <RoleField label="Funktion 3" value={role3} onChange={setRole3} />

          <div>
            <label className="form-label">Spezifikation</label>
            <textarea
              value={spec}
              onChange={e => setSpec(e.target.value)}
              placeholder="Details zur Rolle für diese Show…"
              rows={3}
              className="form-input resize-none"
            />
          </div>

          <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
            Stammdaten (E-Mail, Telefon, Adresse) werden live aus dem Kontakt-Profil übernommen und können dort geändert werden.
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={handleDelete} disabled={deleting} className="btn btn-danger disabled:opacity-50">
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Entfernen
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
