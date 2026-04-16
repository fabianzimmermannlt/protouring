'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import {
  createGuestTravelPartyMember,
  getFunctionCatalog,
  type TravelPartyMember,
  type FunctionCatalogGroup,
} from '@/lib/api-client'

interface GastModalProps {
  terminId: number
  onClose: () => void
  onAdded: (member: TravelPartyMember) => void
}

export default function GastModal({ terminId, onClose, onAdded }: GastModalProps) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '',
    function1: '', function2: '', function3: '',
    specification: '', diet: '', allergies: '',
    glutenFree: false, lactoseFree: false, notes: '',
  })
  const [catalog, setCatalog] = useState<FunctionCatalogGroup[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getFunctionCatalog().then(setCatalog).catch(() => setCatalog([]))
  }, [])

  const set = <K extends keyof typeof form>(field: K, value: typeof form[K]) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!form.firstName.trim() && !form.lastName.trim()) {
      setError('Vor- oder Nachname ist erforderlich.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const member = await createGuestTravelPartyMember(terminId, form)
      onAdded(member)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const FunctionSelect = ({ field, label }: { field: 'function1' | 'function2' | 'function3'; label: string }) => (
    <div>
      <label className="form-label">{label}</label>
      <select className="form-input" value={form[field]} onChange={e => set(field, e.target.value)}>
        <option value="">– keine –</option>
        {catalog.map(group => (
          <optgroup key={group.group} label={group.group}>
            {group.functions.filter(fn => fn.active).map(fn => (
              <option key={fn.name} value={fn.name}>{fn.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-lg">
        <div className="modal-header">
          <h2 className="modal-title">Manuellen Kontakt hinzufügen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="modal-body space-y-4">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>
          )}

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Vorname</label>
              <input autoFocus type="text" className="form-input" value={form.firstName}
                onChange={e => set('firstName', e.target.value)} placeholder="Vorname" />
            </div>
            <div>
              <label className="form-label">Nachname</label>
              <input type="text" className="form-input" value={form.lastName}
                onChange={e => set('lastName', e.target.value)} placeholder="Nachname" />
            </div>
          </div>

          {/* Telefon */}
          <div>
            <label className="form-label">Telefon</label>
            <input type="tel" className="form-input" value={form.phone}
              onChange={e => set('phone', e.target.value)} placeholder="+49 …" />
          </div>

          {/* Funktionen */}
          <div className="grid grid-cols-3 gap-3">
            <FunctionSelect field="function1" label="Funktion 1" />
            <FunctionSelect field="function2" label="Funktion 2" />
            <FunctionSelect field="function3" label="Funktion 3" />
          </div>

          {/* Spezifikation */}
          <div>
            <label className="form-label">Spezifikation</label>
            <input type="text" className="form-input" value={form.specification}
              onChange={e => set('specification', e.target.value)}
              placeholder="z.B. DiGiCo SD12, 60m Line-Array" />
          </div>

          {/* Ernährung */}
          <div>
            <label className="form-label">Ernährungsweise</label>
            <select className="form-input" value={form.diet} onChange={e => set('diet', e.target.value)}>
              <option value="">Bitte wählen…</option>
              <option value="alles">Alles</option>
              <option value="vegetarisch">Vegetarisch</option>
              <option value="vegan">Vegan</option>
            </select>
          </div>

          {/* Allergien */}
          <div>
            <label className="form-label">Allergien</label>
            <input type="text" className="form-input" value={form.allergies}
              onChange={e => set('allergies', e.target.value)}
              placeholder="z.B. Nüsse, Gluten" />
          </div>

          {/* Unverträglichkeiten */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.glutenFree}
                onChange={e => set('glutenFree', e.target.checked)} className="rounded" />
              Glutenfrei
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.lactoseFree}
                onChange={e => set('lactoseFree', e.target.checked)} className="rounded" />
              Laktosefrei
            </label>
          </div>

          {/* Besonderheiten */}
          <div>
            <label className="form-label">Besonderheiten / Notizen</label>
            <input type="text" className="form-input" value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="z.B. Freundin von Artist X, nur 1x dabei" />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Speichern…</> : 'Hinzufügen'}
          </button>
        </div>
      </div>
    </div>
  )
}
