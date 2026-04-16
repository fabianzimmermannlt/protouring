'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import {
  createGuestContact,
  updateContact,
  deleteContact,
  getFunctionCatalog,
  type Contact,
  type FunctionCatalogGroup,
} from '@/lib/api-client'

interface GastAnlegenModalProps {
  onClose: () => void
  onAdded?: (contact: Contact) => void
  onUpdated?: (contact: Contact) => void
  onDeleted?: (id: string) => void
  /** Wenn übergeben → Edit-Modus */
  contact?: Contact
}

function contactToForm(c: Contact) {
  return {
    firstName:     c.firstName     ?? '',
    lastName:      c.lastName      ?? '',
    phone:         c.phone         ?? '',
    function1:     c.function1     ?? '',
    function2:     c.function2     ?? '',
    function3:     c.function3     ?? '',
    specification: c.specification ?? '',
    diet:          c.diet          ?? '',
    allergies:     c.allergies     ?? '',
    glutenFree:    c.glutenFree    ?? false,
    lactoseFree:   c.lactoseFree   ?? false,
    notes:         c.notes         ?? '',
  }
}

const emptyForm = () => ({
  firstName: '', lastName: '', phone: '',
  function1: '', function2: '', function3: '',
  specification: '', diet: '', allergies: '',
  glutenFree: false, lactoseFree: false, notes: '',
})

export default function GastAnlegenModal({
  onClose, onAdded, onUpdated, onDeleted, contact,
}: GastAnlegenModalProps) {
  const isEdit = !!contact
  const [form, setForm] = useState(isEdit ? contactToForm(contact!) : emptyForm())
  const [catalog, setCatalog] = useState<FunctionCatalogGroup[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
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
      if (isEdit) {
        // Nur die Gast-relevanten Felder updaten, Rest unverändert lassen
        const updated = await updateContact(String(contact!.id), {
          firstName:     form.firstName,
          lastName:      form.lastName,
          phone:         form.phone,
          function1:     form.function1,
          function2:     form.function2,
          function3:     form.function3,
          specification: form.specification,
          diet:          form.diet,
          allergies:     form.allergies,
          glutenFree:    form.glutenFree,
          lactoseFree:   form.lactoseFree,
          notes:         form.notes,
          // Pflichtfelder die der Server erwartet, aber hier irrelevant sind
          accessRights: contact!.accessRights || '',
          email: contact!.email || '',
          mobile: '', address: '', postalCode: '', residence: '',
          taxId: '', website: '', birthDate: '', gender: '', pronouns: '',
          birthPlace: '', nationality: '', idNumber: '', socialSecurity: '',
          emergencyContact: '', emergencyPhone: '', shirtSize: '', hoodieSize: '',
          pantsSize: '', shoeSize: '', languages: '', driversLicense: '',
          railcard: '', frequentFlyer: '', bankAccount: '', bankIban: '', bankBic: '',
          taxNumber: '', vatId: '', crewToolActive: true,
          hourlyRate: 0, dailyRate: 0, hotelInfo: '', hotelAlias: '',
        })
        onUpdated?.(updated)
      } else {
        const created = await createGuestContact(form)
        onAdded?.(created)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!contact) return
    if (!confirm(`${contact.firstName} ${contact.lastName} wirklich löschen?`)) return
    setDeleting(true)
    try {
      await deleteContact(String(contact.id))
      onDeleted?.(String(contact.id))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen')
      setDeleting(false)
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
          <h2 className="modal-title">
            {isEdit ? `${contact!.firstName} ${contact!.lastName}` : 'Manuellen Kontakt anlegen'}
          </h2>
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
          <div>
            {isEdit && (
              <button onClick={handleDelete} disabled={deleting}
                className="btn text-red-400 hover:text-red-300 hover:bg-red-900/20 border border-red-800">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : 'Löschen'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Speichern…</> : isEdit ? 'Speichern' : 'Anlegen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
