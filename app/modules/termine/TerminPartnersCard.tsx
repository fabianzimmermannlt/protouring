'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Loader2, ArrowLeftRight } from 'lucide-react'
import {
  getTerminPartners, addTerminPartner, removeTerminPartner,
  getPartners,
  type TerminPartner, type Partner,
} from '@/lib/api-client'
import { PartnerDetailContent } from '../partners/PartnerDetail'
import { AccordionSection } from '@/app/components/shared/AccordionSection'
import { QuickCreatePartnerModal } from '@/app/components/shared/modals/QuickCreatePartnerModal'

// ── Picker Modal ─────────────────────────────────────────────────────────────

function PartnerPickerModal({
  existingPartnerIds,
  onSelect,
  onClose,
}: {
  existingPartnerIds: number[]
  onSelect: (partner: Partner) => void
  onClose: () => void
}) {
  const [partners, setPartners]         = useState<Partner[]>([])
  const [search, setSearch]             = useState('')
  const [showCreate, setShowCreate]     = useState(false)

  useEffect(() => { getPartners().then(setPartners).catch(() => {}) }, [])

  const filtered = partners.filter(p =>
    !existingPartnerIds.includes(Number(p.id)) && (
      !search ||
      p.companyName.toLowerCase().includes(search.toLowerCase()) ||
      p.city.toLowerCase().includes(search.toLowerCase()) ||
      p.contactPerson.toLowerCase().includes(search.toLowerCase())
    )
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} className="shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div style={{ borderBottom: '1px solid var(--border)' }} className="flex items-center justify-between px-5 py-4">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Partner verknüpfen</h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }} className="hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-4 py-3 space-y-2">
          <input
            type="text" autoFocus
            placeholder="Suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input w-full text-sm"
            style={{ fontSize: 13 }}
          />
          <div className="max-h-64 overflow-y-auto" style={{ border: '1px solid var(--border)' }}>
            <button
              onClick={() => setShowCreate(true)}
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-1 transition-colors"
              style={{ color: 'var(--primary-2)', borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1e1e1e')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Plus size={11} /> Neuen Partner anlegen
            </button>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-subtle)' }}>Keine Partner gefunden</div>
            ) : filtered.map(p => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="w-full text-left px-3 py-2.5 text-sm transition-colors"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1e1e1e')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="font-medium" style={{ color: 'var(--text)' }}>{p.companyName}</div>
                {(p.type || p.contactPerson || p.city) && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {[p.type, p.contactPerson, p.city].filter(Boolean).join(' · ')}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showCreate && (
        <QuickCreatePartnerModal
          onClose={() => setShowCreate(false)}
          onCreated={newPartner => {
            setPartners(prev => [...prev, newPartner])
            setShowCreate(false)
            onSelect(newPartner)
          }}
        />
      )}
    </div>
  )
}

// ── TerminPartnersCard ───────────────────────────────────────────────────────

export default function TerminPartnersCard({
  terminId,
  isAdmin,
}: {
  terminId: number
  isAdmin: boolean
}) {
  const [links, setLinks]               = useState<TerminPartner[]>([])
  const [loading, setLoading]           = useState(true)
  const [showPicker, setShowPicker]     = useState(false)
  const [swappingLink, setSwappingLink] = useState<TerminPartner | null>(null)
  const [adding, setAdding]             = useState(false)
  const [swappingId, setSwappingId]     = useState<number | null>(null)
  const [removingId, setRemovingId]     = useState<number | null>(null)

  useEffect(() => {
    getTerminPartners(terminId)
      .then(setLinks)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [terminId])

  // Akkordeon-Titel live aktualisieren, wenn der Partner-Stammsatz gespeichert wird.
  useEffect(() => {
    const onUpdated = (e: Event) => {
      const p = (e as CustomEvent<{ id?: number | string; companyName?: string; contactPerson?: string; city?: string; type?: string }>).detail
      if (!p?.id) return
      setLinks(prev => prev.map(l => l.partner_id === Number(p.id)
        ? { ...l, company_name: p.companyName ?? l.company_name, contact_person: p.contactPerson ?? l.contact_person, city: p.city ?? l.city, partner_type: p.type ?? l.partner_type }
        : l))
    }
    window.addEventListener('partner-updated', onUpdated)
    return () => window.removeEventListener('partner-updated', onUpdated)
  }, [])

  const handleSelect = async (partner: Partner) => {
    setShowPicker(false)
    if (swappingLink) {
      // Wechseln: erst alten entfernen, dann neuen hinzufügen
      const oldLink = swappingLink
      setSwappingLink(null)
      setSwappingId(oldLink.id)
      try {
        await removeTerminPartner(terminId, oldLink.id)
        const tp = await addTerminPartner(terminId, Number(partner.id), '')
        setLinks(prev => prev.map(l => l.id === oldLink.id ? tp : l))
      } catch { /* ignore */ } finally {
        setSwappingId(null)
      }
    } else {
      setAdding(true)
      try {
        const tp = await addTerminPartner(terminId, Number(partner.id), '')
        setLinks(prev => [...prev, tp])
      } catch { /* ignore */ } finally {
        setAdding(false)
      }
    }
  }

  const handleRemove = async (link: TerminPartner) => {
    setRemovingId(link.id)
    try {
      await removeTerminPartner(terminId, link.id)
      setLinks(prev => prev.filter(l => l.id !== link.id))
    } catch { /* ignore */ } finally {
      setRemovingId(null)
    }
  }

  if (loading) return (
    <div className="pt-card flex items-center justify-center py-8">
      <Loader2 size={16} className="animate-spin text-gray-400" />
    </div>
  )

  return (
    <div className="flex flex-col gap-4">

      {/* Pro Partner eine Standard-AccordionSection: eingeklappt Firma/Rolle/Ort, aufgeklappt Details */}
      {links.map(link => {
        const sub = [link.role || link.partner_type, link.contact_person, link.city].filter(Boolean).join(' · ')
        return (
          <AccordionSection
            key={link.id}
            title={link.company_name || 'Partner'}
            defaultOpen={links.length === 1}
            titleContent={
              <span className="truncate">
                <span className="font-medium" style={{ color: 'var(--text)' }}>{link.company_name || 'Partner'}</span>
                {sub && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{'  —  ' + sub}</span>}
              </span>
            }
            headerActions={isAdmin ? (
              <>
                <button
                  onClick={() => { setSwappingLink(link); setShowPicker(true) }}
                  disabled={swappingId === link.id || removingId === link.id}
                  title="Partner wechseln"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', fontSize: 11, color: 'var(--text-muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary-2)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  {swappingId === link.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowLeftRight size={12} />}
                  Wechseln
                </button>
                <button
                  onClick={() => handleRemove(link)}
                  disabled={removingId === link.id || swappingId === link.id}
                  title="Verknüpfung aufheben"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', fontSize: 11, color: 'var(--text-muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  {removingId === link.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                  Entfernen
                </button>
              </>
            ) : undefined}
          >
            <PartnerDetailContent partnerId={String(link.partner_id)} hideTitle />
          </AccordionSection>
        )
      })}

      {/* Leer-State */}
      {links.length === 0 && (
        <div className="pt-card">
          <div className="pt-card-body text-sm text-gray-400">
            Noch kein Partner verknüpft.
          </div>
        </div>
      )}

      {/* Partner hinzufügen */}
      {isAdmin && (
        <button
          onClick={() => setShowPicker(true)}
          disabled={adding}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-blue-600 transition-colors self-start"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
        >
          {adding
            ? <Loader2 size={14} className="animate-spin" />
            : <Plus size={14} />
          }
          Partner hinzufügen
        </button>
      )}

      {showPicker && (
        <PartnerPickerModal
          existingPartnerIds={links.map(l => l.partner_id)}
          onSelect={handleSelect}
          onClose={() => { setShowPicker(false); setSwappingLink(null) }}
        />
      )}
    </div>
  )
}
