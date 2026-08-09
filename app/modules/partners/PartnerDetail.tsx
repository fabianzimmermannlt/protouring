'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertCircle, Save, Loader2, Building2, MapPin, Phone, X, ArrowLeft, Plus, UserCircle, Mail, Trash2, Check, Pencil, GripVertical } from 'lucide-react'
import {
  isEditorRole, getEffectiveRole,
  getPartner, updatePartner, type Partner, type PartnerFormData,
  getPartnerContacts, createPartnerContact, updatePartnerContact, deletePartnerContact, reorderPartnerContacts, type PartnerContact,
  getPartnerTypes,
} from '@/lib/api-client'
import { useT } from '@/app/lib/i18n/LanguageContext'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'
import { AutoGrowTextarea } from '@/app/components/shared/AutoGrowTextarea'
import { CollapsibleCard } from '@/app/components/shared/CollapsibleCard'
import { NameAddressAutocomplete, type AddressResult } from '@/app/components/shared/AddressAutocomplete'

const PARTNER_TYPES = [
  'Veranstaltende', 'Autovermietung', 'Trucking-Firma', 'Reisebüro', 'Technik-Lieferant',
  'Backline-Firma', 'Medien-/Videoproduktion', 'Catering-Firma', 'Sicherheits-Firma',
  'Merchandise-Dienstleister', 'Ticketing-Dienstleister', 'Support-Band', 'Booking Agentur',
  'Zulieferer Sonstiges', 'Endorser', 'Brand', 'Management', 'Studio', 'Label', 'Marketing',
]

function IField({ label, value, onChange, placeholder = '', readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="detail-label">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} readOnly={readOnly} className="detail-input" />
    </div>
  )
}

function ISelect({ label, value, onChange, options, placeholder = '– bitte wählen –', readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="detail-label">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={readOnly}
        className="detail-input">
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function ITextarea({ label, value, onChange, placeholder = '', readOnly = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="detail-label">{label}</label>
      <AutoGrowTextarea value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={3} readOnly={readOnly}
        className="detail-input resize-none" />
    </div>
  )
}

export function PartnerDetailContent({ partnerId, onNotFound, onBack, headerRight }: { partnerId: string; onNotFound?: () => void; onBack?: () => void; headerRight?: React.ReactNode }) {
  const t = useT()
  const { layout } = useLayout()
  const isL2 = true // App fest Dark-Mode
  const isEditor = isEditorRole(getEffectiveRole())

  const [partner, setPartner] = useState<Partner | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState<Record<string, string>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showDirtyDialog, setShowDirtyDialog] = useState(false)
  const [partnerTypes, setPartnerTypes] = useState<string[]>(PARTNER_TYPES)
  const originalRef = useRef<Record<string, string>>({})

  const loadPartner = useCallback(async () => {
    setLoading(true)
    try {
      const p = await getPartner(partnerId)
      setPartner(p)
      const data = p as unknown as Record<string, string>
      setForm(data)
      originalRef.current = data
      setIsDirty(false)
    } catch {
      if (onNotFound) { onNotFound(); return }
      setLoadError(t('partners.notFound'))
    } finally {
      setLoading(false)
    }
  }, [partnerId, onNotFound, t])

  useEffect(() => { loadPartner() }, [loadPartner])

  useEffect(() => {
    getPartnerTypes()
      .then(data => {
        const visible = data.filter(pt => pt.visible !== 0).map(pt => pt.name)
        if (visible.length > 0) setPartnerTypes(visible)
      })
      .catch(() => { /* Fallback bleibt */ })
  }, [])

  const f = (key: string, val: string) => {
    const next = { ...form, [key]: val }
    setForm(next)
    const orig = originalRef.current
    setIsDirty(Object.keys(next).some(k => next[k] !== (orig[k] ?? '')))
  }

  const cancelEdit = () => { setForm(originalRef.current); setIsDirty(false); setSaveError('') }

  const saveEdit = async (): Promise<boolean> => {
    if (!partner) return false
    setSaving(true); setSaveError('')
    try {
      const updated = await updatePartner(partnerId, form as unknown as PartnerFormData)
      setPartner(updated)
      const data = updated as unknown as Record<string, string>
      setForm(data)
      originalRef.current = data
      setIsDirty(false)
      window.dispatchEvent(new CustomEvent('partner-updated', { detail: updated }))
      return true
    } catch (e) {
      setSaveError((e as Error).message || t('general.saveFailed'))
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => { if (isDirty) setShowDirtyDialog(true); else onBack?.() }

  useEffect(() => {
    ;(window as any).__pt_isDirty = isDirty
    return () => { ;(window as any).__pt_isDirty = false }
  }, [isDirty])

  useEffect(() => {
    ;(window as any).__pt_save = saveEdit
    return () => { ;(window as any).__pt_save = null }
  })

  const ro = !isEditor
  const titleColor = 'var(--text)'  // App ist fest Dark-Mode → Titel immer hell (auch mobil, wo isL2 false ist)
  const dirtyColor = isL2 ? '#b0b0b0' : 'var(--text-subtle)'

  return (
    <div className="module-content">
      {onBack && (
        <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Zurück zur Übersicht
        </button>
      )}
      {/* Header */}
      <div className="flex items-center justify-between" style={{ minHeight: '32px', gap: '12px' }}>
        <h2 style={{ color: titleColor, fontSize: '17px', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loading ? '' : (form.companyName || partner?.companyName || '')}
        </h2>
        {isDirty ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '12px', color: dirtyColor }}>Ungespeicherte Änderungen</span>
            <button onClick={cancelEdit}
              style={{ padding: '5px 12px', fontSize: '13px', color: dirtyColor, background: 'none', border: `1px solid ${isL2 ? '#555' : '#d1d5db'}`, borderRadius: 0, cursor: 'pointer' }}>
              <X className="w-3 h-3 inline mr-1" />{t('general.cancel')}
            </button>
            <button onClick={saveEdit} disabled={saving}
              style={{ padding: '5px 12px', fontSize: '13px', fontWeight: 500, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 0, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '5px' }}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {t('general.save')}
            </button>
          </div>
        ) : headerRight ? (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>{headerRight}</div>
        ) : null}
      </div>

      {loadError && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4"><AlertCircle className="w-4 h-4 shrink-0" />{loadError}</div>}
      {saveError && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4"><AlertCircle className="w-4 h-4 shrink-0" />{saveError}</div>}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="pt-card">
              <div className="pt-card-header"><div className="h-3 w-24 bg-gray-100 animate-pulse rounded" /></div>
              <div className="pt-card-body space-y-3">{[...Array(4)].map((_, j) => <div key={j} className="h-7 bg-gray-100 animate-pulse rounded" />)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Allgemein */}
          <CollapsibleCard title={<><Building2 className="w-3.5 h-3.5 inline mr-1" />{t('partners.cardGeneral')}</>}>
              <div className="space-y-2">
                {ro ? (
                  <IField label={t('partners.company')} value={form.companyName ?? ''} onChange={v => f('companyName', v)} readOnly />
                ) : (
                  <NameAddressAutocomplete
                    label={t('partners.company')}
                    variant="inline"
                    value={form.companyName ?? ''}
                    onChange={v => f('companyName', v)}
                    onAddressSelect={(a: AddressResult) => {
                      setForm(prev => ({
                        ...prev,
                        ...(a.name ? { companyName: a.name } : {}),
                        ...(a.street ? { street: a.street } : {}),
                        ...(a.postalCode ? { postalCode: a.postalCode } : {}),
                        ...(a.city ? { city: a.city } : {}),
                        ...(a.state ? { state: a.state } : {}),
                        ...(a.country ? { country: a.country } : {}),
                      }))
                      setIsDirty(true)
                    }}
                  />
                )}
                <ISelect label={t('partners.type')} value={form.type ?? ''} onChange={v => f('type', v)} options={partnerTypes} placeholder={t('partners.selectTypeOption')} readOnly={ro} />
                <IField label={t('partners.contactPerson')} value={form.contactPerson ?? ''} onChange={v => f('contactPerson', v)} readOnly={ro} />
              </div>
          </CollapsibleCard>

          {/* Adresse */}
          <CollapsibleCard title={<><MapPin className="w-3.5 h-3.5 inline mr-1" />{t('partners.cardAddress')}</>}>
              <div className="space-y-2">
                <IField label={t('address.street')} value={form.street ?? ''} onChange={v => f('street', v)} readOnly={ro} />
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <IField label={t('address.postalCode')} value={form.postalCode ?? ''} onChange={v => f('postalCode', v)} readOnly={ro} />
                  <IField label={t('address.city')} value={form.city ?? ''} onChange={v => f('city', v)} readOnly={ro} />
                </div>
                <IField label={t('address.state')} value={form.state ?? ''} onChange={v => f('state', v)} readOnly={ro} />
                <IField label={t('address.country')} value={form.country ?? ''} onChange={v => f('country', v)} readOnly={ro} />
              </div>
          </CollapsibleCard>

          {/* Kontakt */}
          <CollapsibleCard title={<><Phone className="w-3.5 h-3.5 inline mr-1" />{t('partners.cardContact')}</>}>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('general.email')} value={form.email ?? ''} onChange={v => f('email', v)} readOnly={ro} />
                  <IField label={t('general.phone')} value={form.phone ?? ''} onChange={v => f('phone', v)} readOnly={ro} />
                </div>
                <IField label={t('partners.taxIdFull')} value={form.taxId ?? ''} onChange={v => f('taxId', v)} readOnly={ro} />
                <ITextarea label={t('partners.billingAddress')} value={form.billingAddress ?? ''} onChange={v => f('billingAddress', v)} readOnly={ro} />
                <ITextarea label={t('venues.notesTitle')} value={form.notes ?? ''} onChange={v => f('notes', v)} readOnly={ro} />
              </div>
          </CollapsibleCard>

          {/* Ansprechpartner */}
          <PartnerContactsCard partnerId={partnerId} isEditor={isEditor} />

        </div>
      )}

      {showDirtyDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: isL2 ? '#2a2a2a' : '#fff', borderRadius: 0, padding: '24px', maxWidth: '360px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ color: titleColor, fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Ungespeicherte Änderungen</h3>
            <p style={{ color: dirtyColor, fontSize: '14px', marginBottom: '20px' }}>Möchtest du die Änderungen speichern oder verwerfen?</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDirtyDialog(false)}
                style={{ padding: '8px 16px', fontSize: '13px', color: dirtyColor, background: 'none', border: `1px solid ${isL2 ? '#555' : '#d1d5db'}`, borderRadius: 0, cursor: 'pointer' }}>
                Abbrechen
              </button>
              <button onClick={() => { setShowDirtyDialog(false); cancelEdit(); onBack?.() }}
                style={{ padding: '8px 16px', fontSize: '13px', color: dirtyColor, background: 'none', border: `1px solid ${isL2 ? '#555' : '#d1d5db'}`, borderRadius: 0, cursor: 'pointer' }}>
                Verwerfen
              </button>
              <button onClick={async () => { const ok = await saveEdit(); if (ok) { setShowDirtyDialog(false); onBack?.() } }} disabled={saving}
                style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 0, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Ansprechpartner (analog Venue) ───────────────────────────────────────────

function PartnerContactsCard({ partnerId, isEditor }: { partnerId: string; isEditor: boolean }) {
  const [contacts, setContacts] = useState<PartnerContact[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ firstName: '', name: '', role: '', phone: '', email: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getPartnerContacts(partnerId).then(setContacts).catch(() => {}).finally(() => setLoading(false))
  }, [partnerId])

  const startAdd = () => { setForm({ firstName: '', name: '', role: '', phone: '', email: '', notes: '' }); setEditingId(null); setAdding(true) }
  const startEdit = (c: PartnerContact) => { setForm({ firstName: c.firstName, name: c.name, role: c.role, phone: c.phone, email: c.email, notes: c.notes }); setEditingId(c.id); setAdding(false) }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        const u = await updatePartnerContact(partnerId, editingId, form)
        setContacts(prev => prev.map(c => c.id === editingId ? u : c))
      } else {
        const c = await createPartnerContact(partnerId, form)
        setContacts(prev => [...prev, c])
      }
      setAdding(false); setEditingId(null)
    } catch { /* silent */ } finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('Ansprechpartner wirklich löschen?')) return
    try { await deletePartnerContact(partnerId, id); setContacts(prev => prev.filter(c => c.id !== id)) } catch { /* silent */ }
  }

  // Drag & Drop Reihenfolge
  const dragIdx = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const onDrop = async (targetIdx: number) => {
    const from = dragIdx.current
    dragIdx.current = null; setDragOver(null); setDragging(null)
    if (from === null || from === targetIdx) return
    const next = [...contacts]
    const [moved] = next.splice(from, 1)
    next.splice(targetIdx, 0, moved)
    setContacts(next)
    try { await reorderPartnerContacts(partnerId, next.map(c => c.id)) } catch { /* silent */ }
  }

  return (
    <CollapsibleCard
      title={<><UserCircle className="w-3.5 h-3.5 inline mr-1" />Ansprechpartner</>}
      actions={isEditor ? <button onClick={startAdd} className="text-gray-400 hover:text-blue-600 transition-colors"><Plus className="w-3.5 h-3.5" /></button> : undefined}
    >
      {loading ? (
        <div className="flex items-center justify-center h-16 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin mr-2" />Lädt…</div>
      ) : (
        <>
          {contacts.map((c, idx) => (
            editingId === c.id ? (
              <PContactForm key={c.id} form={form} onChange={setForm} onSave={save} onCancel={() => setEditingId(null)} saving={saving} />
            ) : (
              <div
                key={c.id}
                draggable={isEditor}
                onDragStart={() => { dragIdx.current = idx; setDragging(idx) }}
                onDragEnter={() => { if (dragIdx.current !== idx) setDragOver(idx) }}
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop(idx)}
                onDragEnd={() => { dragIdx.current = null; setDragOver(null); setDragging(null) }}
                className={`relative py-2 border-b border-gray-50 last:border-0 group transition-all duration-150 ${dragging === idx ? 'opacity-40 scale-[.99]' : ''}`}
              >
                {dragOver === idx && dragging !== idx && (
                  <div className="absolute -top-px left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                )}
                <div className="flex items-start gap-2">
                  {isEditor && (
                    <span className="mt-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0" title="Ziehen zum Sortieren"><GripVertical className="w-4 h-4" /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-200">{`${c.firstName} ${c.name}`.trim()}</p>
                    {c.role && <p className="text-xs text-gray-500">{c.role}</p>}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-blue-500 hover:underline"><Phone className="w-2.5 h-2.5" />{c.phone}</a>}
                      {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-blue-500 hover:underline"><Mail className="w-2.5 h-2.5" />{c.email}</a>}
                    </div>
                    {c.notes && <p className="text-xs text-gray-400 mt-0.5">{c.notes}</p>}
                  </div>
                  {isEditor && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => startEdit(c)} className="text-gray-400 hover:text-blue-600 p-0.5"><Pencil className="w-3 h-3" /></button>
                      <button onClick={() => remove(c.id)} className="text-gray-400 hover:text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              </div>
            )
          ))}
          {adding && <PContactForm form={form} onChange={setForm} onSave={save} onCancel={() => setAdding(false)} saving={saving} />}
          {contacts.length === 0 && !adding && (
            <div className="flex flex-col items-center justify-center h-16 text-gray-400">
              <UserCircle className="w-5 h-5 mb-1" /><span className="text-xs">Noch keine Ansprechpartner</span>
            </div>
          )}
        </>
      )}
    </CollapsibleCard>
  )
}

function PContactForm({ form, onChange, onSave, onCancel, saving }: {
  form: { firstName: string; name: string; role: string; phone: string; email: string; notes: string }
  onChange: (f: any) => void; onSave: () => void; onCancel: () => void; saving: boolean
}) {
  const f = (key: string, value: string) => onChange((prev: any) => ({ ...prev, [key]: value }))
  return (
    <div className="py-2 border-b border-gray-100 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={form.firstName} onChange={e => f('firstName', e.target.value)} placeholder="Vorname" className="form-input text-xs py-1" />
        <input value={form.name} onChange={e => f('name', e.target.value)} placeholder="Name *" className="form-input text-xs py-1" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={form.role} onChange={e => f('role', e.target.value)} placeholder="Rolle / Funktion" className="form-input text-xs py-1" />
        <input value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="Telefon" className="form-input text-xs py-1" />
      </div>
      <input value={form.email} onChange={e => f('email', e.target.value)} placeholder="E-Mail" className="form-input text-xs py-1 w-full" />
      <input value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Notiz" className="form-input text-xs py-1 w-full" />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn btn-ghost text-xs py-1 px-2">Abbrechen</button>
        <button onClick={onSave} disabled={saving || !form.name.trim()} className="btn btn-primary text-xs py-1 px-2 disabled:opacity-50">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Speichern
        </button>
      </div>
    </div>
  )
}
