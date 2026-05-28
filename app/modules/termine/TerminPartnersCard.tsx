'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Loader2, ArrowLeftRight } from 'lucide-react'
import {
  getTerminPartners, addTerminPartner, removeTerminPartner,
  getPartners,
  type TerminPartner, type Partner,
} from '@/lib/api-client'
import { PartnerDetailContent } from '../partners/PartnerDetail'
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
      <div style={{ background: '#2d2d2d', border: '1px solid #3c3c3c' }} className="shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div style={{ borderBottom: '1px solid #3c3c3c' }} className="flex items-center justify-between px-5 py-4">
          <h3 className="text-sm font-semibold" style={{ color: '#e0e0e0' }}>Partner verknüpfen</h3>
          <button onClick={onClose} style={{ color: '#9ca3af' }} className="hover:text-white transition-colors">
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
          <div className="max-h-64 overflow-y-auto" style={{ border: '1px solid #3c3c3c' }}>
            <button
              onClick={() => setShowCreate(true)}
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-1 transition-colors"
              style={{ color: '#60a5fa', borderBottom: '1px solid #3c3c3c' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1e1e1e')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Plus size={11} /> Neuen Partner anlegen
            </button>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-center" style={{ color: '#6b7280' }}>Keine Partner gefunden</div>
            ) : filtered.map(p => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="w-full text-left px-3 py-2.5 text-sm transition-colors"
                style={{ borderBottom: '1px solid #3c3c3c' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1e1e1e')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="font-medium" style={{ color: '#e0e0e0' }}>{p.companyName}</div>
                {(p.type || p.contactPerson || p.city) && (
                  <div className="text-xs" style={{ color: '#9ca3af' }}>
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
  const [links, setLinks]             = useState<TerminPartner[]>([])
  const [loading, setLoading]         = useState(true)
  const [showPicker, setShowPicker]   = useState(false)
  const [swappingLink, setSwappingLink] = useState<TerminPartner | null>(null)
  const [adding, setAdding]           = useState(false)
  const [swappingId, setSwappingId]   = useState<number | null>(null)
  const [removingId, setRemovingId]   = useState<number | null>(null)

  useEffect(() => {
    getTerminPartners(terminId)
      .then(setLinks)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [terminId])

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

      {/* Ein vollständiger Partner-Block pro Eintrag */}
      {links.map(link => (
        <div key={link.id} style={{ position: 'relative' }}>
          {/* Aktions-Buttons oben rechts */}
          {isAdmin && (
            <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, display: 'flex', gap: 4 }}>
              {/* Wechseln */}
              <button
                onClick={() => { setSwappingLink(link); setShowPicker(true) }}
                disabled={swappingId === link.id || removingId === link.id}
                title="Partner wechseln"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#60a5fa')}
                onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
              >
                {swappingId === link.id
                  ? <Loader2 size={14} className="animate-spin" />
                  : <ArrowLeftRight size={14} />
                }
              </button>
              {/* Entfernen */}
              <button
                onClick={() => handleRemove(link)}
                disabled={removingId === link.id || swappingId === link.id}
                title="Verknüpfung aufheben"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
              >
                {removingId === link.id
                  ? <Loader2 size={14} className="animate-spin" />
                  : <X size={14} />
                }
              </button>
            </div>
          )}
          <PartnerDetailContent partnerId={String(link.partner_id)} />
        </div>
      ))}

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
