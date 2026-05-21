'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import {
  getTerminPartners, addTerminPartner, removeTerminPartner,
  getPartners,
  type TerminPartner, type Partner,
} from '@/lib/api-client'
import { PartnerDetailContent } from '../partners/PartnerDetail'

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
  const [partners, setPartners] = useState<Partner[]>([])
  const [search, setSearch]     = useState('')

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Partner verknüpfen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-4 py-3 space-y-2">
          <input
            type="text" autoFocus
            placeholder="Suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-400 text-center">Keine Partner gefunden</div>
            ) : filtered.map(p => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors"
              >
                <div className="font-medium text-gray-800">{p.companyName}</div>
                {(p.type || p.contactPerson || p.city) && (
                  <div className="text-xs text-gray-400">
                    {[p.type, p.contactPerson, p.city].filter(Boolean).join(' · ')}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
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
  const [links, setLinks]           = useState<TerminPartner[]>([])
  const [loading, setLoading]       = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [adding, setAdding]         = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)

  useEffect(() => {
    getTerminPartners(terminId)
      .then(setLinks)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [terminId])

  const handleSelect = async (partner: Partner) => {
    setShowPicker(false)
    setAdding(true)
    try {
      const tp = await addTerminPartner(terminId, Number(partner.id), '')
      setLinks(prev => [...prev, tp])
    } catch { /* ignore */ } finally {
      setAdding(false)
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
          {/* Entfernen-Button oben rechts */}
          {isAdmin && (
            <button
              onClick={() => handleRemove(link)}
              disabled={removingId === link.id}
              title="Verknüpfung aufheben"
              style={{
                position: 'absolute', top: '12px', right: '12px', zIndex: 10,
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                color: '#9ca3af',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
            >
              {removingId === link.id
                ? <Loader2 size={14} className="animate-spin" />
                : <X size={14} />
              }
            </button>
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
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
