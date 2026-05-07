'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, AlertCircle, Save, Loader2, Building2, MapPin, Phone } from 'lucide-react'
import {
  isEditorRole, getEffectiveRole,
  getPartner, updatePartner, type Partner, type PartnerFormData,
} from '@/lib/api-client'
import { NameAddressAutocomplete } from '@/app/components/shared/AddressAutocomplete'
import { useT } from '@/app/lib/i18n/LanguageContext'

function KV({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-400 font-medium text-xs uppercase tracking-wide leading-5">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  )
}

const PARTNER_TYPES = [
  'Veranstaltende', 'Autovermietung', 'Trucking-Firma', 'Reisebüro', 'Technik-Lieferant',
  'Backline-Firma', 'Medien-/Videoproduktion', 'Catering-Firma', 'Sicherheits-Firma',
  'Merchandise-Dienstleister', 'Ticketing-Dienstleister', 'Support-Band', 'Booking Agentur',
  'Zulieferer Sonstiges', 'Endorser', 'Brand', 'Management', 'Studio', 'Label', 'Marketing',
]

function IField({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 bg-white" />
    </div>
  )
}

function ISelect({ label, value, onChange, options, placeholder = '– bitte wählen –' }: { label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 bg-white">
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function ITextarea({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2}
        className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 bg-white resize-none" />
    </div>
  )
}

function InlineSaveBar({ onSave, onCancel, saving, error }: { onSave: () => void; onCancel: () => void; saving: boolean; error?: string }) {
  const t = useT()
  return (
    <div className="pt-2 border-t border-gray-100 mt-2">
      {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">{t('general.cancel')}</button>
        <button onClick={onSave} disabled={saving}
          className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {t('general.save')}
        </button>
      </div>
    </div>
  )
}

export function PartnerDetailContent({ partnerId, onNotFound }: { partnerId: string; onNotFound?: () => void }) {
  const t = useT()
  const isEditor = isEditorRole(getEffectiveRole())

  const [partner, setPartner] = useState<Partner | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  type EditSection = 'allgemein' | 'adresse' | 'kontakt'
  const [editingSection, setEditingSection] = useState<EditSection | null>(null)
  const [inlineForm, setInlineForm] = useState<Record<string, string>>({})
  const [savingInline, setSavingInline] = useState(false)
  const [inlineError, setInlineError] = useState('')

  const loadPartner = useCallback(async () => {
    setLoading(true)
    try {
      const p = await getPartner(partnerId)
      setPartner(p)
      setInlineForm(p as any)
    } catch {
      if (onNotFound) { onNotFound(); return }
      setError(t('partners.notFound'))
    } finally {
      setLoading(false)
    }
  }, [partnerId, onNotFound, t])

  useEffect(() => { loadPartner() }, [loadPartner])

  function startEditSection(section: EditSection) { if (partner) setInlineForm({ ...partner as any }); setInlineError(''); setEditingSection(section) }
  function cancelEditSection() { if (partner) setInlineForm({ ...partner as any }); setEditingSection(null); setInlineError('') }

  async function saveInlineSection() {
    if (!partner) return
    setSavingInline(true); setInlineError('')
    try {
      const updated = await updatePartner(partnerId, inlineForm as unknown as PartnerFormData)
      setPartner(updated); setInlineForm({ ...updated as any }); setEditingSection(null)
      window.dispatchEvent(new CustomEvent('partner-updated', { detail: updated }))
    } catch (e) {
      setInlineError((e as Error).message || t('general.saveFailed'))
    } finally { setSavingInline(false) }
  }

  const iF = (key: string, value: string) => setInlineForm(prev => ({ ...prev, [key]: value }))

  return (
    <div className="module-content">
      {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><Building2 className="w-3.5 h-3.5 inline mr-1" />{t('partners.cardGeneral')}</span>
            {isEditor && partner && editingSection !== 'allgemein' && <button onClick={() => startEditSection('allgemein')} className="text-gray-400 hover:text-blue-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            : editingSection === 'allgemein' ? (
              <div className="space-y-2">
                <NameAddressAutocomplete
                  label={t('partners.companyRequired2')}
                  variant="inline"
                  value={inlineForm.companyName ?? ''}
                  onChange={v => iF('companyName', v)}
                  onAddressSelect={a => setInlineForm(prev => ({
                    ...prev,
                    ...(a.name ? { companyName: a.name } : {}),
                    ...(a.street ? { street: a.street } : {}),
                    ...(a.postalCode ? { postalCode: a.postalCode } : {}),
                    ...(a.city ? { city: a.city } : {}),
                    ...(a.state ? { state: a.state } : {}),
                    ...(a.country ? { country: a.country } : {}),
                  }))}
                />
                <ISelect label={t('partners.type')} value={inlineForm.type ?? ''} onChange={v => iF('type', v)} options={PARTNER_TYPES} placeholder={t('partners.selectTypeOption')} />
                <IField label={t('partners.contactPerson')} value={inlineForm.contactPerson ?? ''} onChange={v => iF('contactPerson', v)} />
                <InlineSaveBar onSave={saveInlineSection} onCancel={cancelEditSection} saving={savingInline} error={inlineError} />
              </div>
            ) : partner ? (
              <>
                {partner.companyName && <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1.5 border-b border-gray-50"><span className="text-gray-400 font-medium text-xs uppercase tracking-wide leading-5">{t('partners.company')}</span><span className="text-gray-800 font-semibold">{partner.companyName}</span></div>}
                <KV label={t('partners.type')} value={partner.type || undefined} />
                <KV label={t('partners.contactPerson')} value={partner.contactPerson || undefined} />
                {!partner.companyName && !partner.type && !partner.contactPerson && <p className="text-sm text-gray-400 py-2">{t('partners.noData')}</p>}
              </>
            ) : null}
          </div>
        </div>

        <div className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title"><MapPin className="w-3.5 h-3.5 inline mr-1" />{t('partners.cardAddress')}</span>
            {isEditor && partner && editingSection !== 'adresse' && <button onClick={() => startEditSection('adresse')} className="text-gray-400 hover:text-blue-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            : editingSection === 'adresse' ? (
              <div className="space-y-2">
                <NameAddressAutocomplete
                  label={t('address.street')}
                  variant="inline"
                  placeholder="Straße oder Ort suchen…"
                  value={inlineForm.street ?? ''}
                  onChange={v => iF('street', v)}
                  onAddressSelect={a => setInlineForm(prev => ({
                    ...prev,
                    ...(a.street ? { street: a.street } : {}),
                    ...(a.postalCode ? { postalCode: a.postalCode } : {}),
                    ...(a.city ? { city: a.city } : {}),
                    ...(a.state ? { state: a.state } : {}),
                    ...(a.country ? { country: a.country } : {}),
                  }))}
                />
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <IField label={t('address.postalCode')} value={inlineForm.postalCode ?? ''} onChange={v => iF('postalCode', v)} />
                  <IField label={t('address.city')} value={inlineForm.city ?? ''} onChange={v => iF('city', v)} />
                </div>
                <IField label={t('address.state')} value={inlineForm.state ?? ''} onChange={v => iF('state', v)} />
                <IField label={t('address.country')} value={inlineForm.country ?? ''} onChange={v => iF('country', v)} />
                <InlineSaveBar onSave={saveInlineSection} onCancel={cancelEditSection} saving={savingInline} error={inlineError} />
              </div>
            ) : partner ? (
              <>
                <KV label={t('address.street')} value={partner.street || undefined} />
                <KV label={t('address.postalCodeCity')} value={[partner.postalCode, partner.city].filter(Boolean).join(' ') || undefined} />
                <KV label={t('address.state')} value={partner.state || undefined} />
                <KV label={t('address.country')} value={partner.country || undefined} />
                {!partner.street && !partner.postalCode && !partner.city && !partner.country && <p className="text-sm text-gray-400 py-2">{t('partners.noAddress')}</p>}
              </>
            ) : null}
          </div>
        </div>

        <div className="pt-card md:col-span-2">
          <div className="pt-card-header">
            <span className="pt-card-title"><Phone className="w-3.5 h-3.5 inline mr-1" />{t('partners.cardContact')}</span>
            {isEditor && partner && editingSection !== 'kontakt' && <button onClick={() => startEditSection('kontakt')} className="text-gray-400 hover:text-blue-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="pt-card-body">
            {loading ? <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />)}</div>
            : editingSection === 'kontakt' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <IField label={t('general.email')} value={inlineForm.email ?? ''} onChange={v => iF('email', v)} />
                  <IField label={t('general.phone')} value={inlineForm.phone ?? ''} onChange={v => iF('phone', v)} />
                </div>
                <IField label={t('partners.taxIdFull')} value={inlineForm.taxId ?? ''} onChange={v => iF('taxId', v)} />
                <ITextarea label={t('partners.billingAddress')} value={inlineForm.billingAddress ?? ''} onChange={v => iF('billingAddress', v)} />
                <ITextarea label={t('venues.notesTitle')} value={inlineForm.notes ?? ''} onChange={v => iF('notes', v)} />
                <InlineSaveBar onSave={saveInlineSection} onCancel={cancelEditSection} saving={savingInline} error={inlineError} />
              </div>
            ) : partner ? (
              <>
                <KV label={t('general.email')} value={partner.email || undefined} />
                <KV label={t('general.phone')} value={partner.phone || undefined} />
                <KV label={t('partners.taxId')} value={partner.taxId || undefined} />
                <KV label={t('partners.billingAddress')} value={partner.billingAddress || undefined} />
                <KV label={t('venues.notesTitle')} value={partner.notes || undefined} />
                {!partner.email && !partner.phone && !partner.taxId && !partner.billingAddress && !partner.notes && <p className="text-sm text-gray-400 py-2">{t('partners.noContact')}</p>}
              </>
            ) : null}
          </div>
        </div>

      </div>

    </div>
  )
}
