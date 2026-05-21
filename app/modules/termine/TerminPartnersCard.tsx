'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import {
  getTerminPartners, addTerminPartner, removeTerminPartner,
  getPartners,
  type TerminPartner, type Partner,
} from '@/lib/api-client'

// ── Picker Modal ─────────────────────────────────────────────────────────────

function PartnerPickerModal({
  terminId,
  existingPartnerIds,
  onAdded,
  onClose,
}: {
  terminId: number
  existingPartnerIds: number[]
  onAdded: (tp: TerminPartner) => void
  onClose: () => void
}) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [search, setSearch]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => { getPartners().then(setPartners).catch(() => {}) }, [])

  const filtered = partners.filter(p =>
    !existingPartnerIds.includes(Number(p.id)) && (
      !search ||
      p.companyName.toLowerCase().includes(search.toLowerCase()) ||
      p.city.toLowerCase().includes(search.toLowerCase()) ||
      p.contactPerson.toLowerCase().includes(search.toLowerCase())
    )
  )

  const handleSelect = async (partner: Partner) => {
    setSaving(true)
    setError('')
    try {
      const tp = await addTerminPartner(terminId, Number(partner.id), '')
      onAdded(tp)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Partner hinzufügen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-2">
          <input
            type="text"
            autoFocus
            placeholder="Suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-400 text-center">Keine Partner gefunden</div>
            ) : filtered.map(p => (
              <button
                key={p.id}
                onClick={() => handleSelect(p)}
                disabled={saving}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors disabled:opacity-50"
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

          {saving && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Loader2 size={11} className="animate-spin" /> Wird gespeichert…
            </div>
          )}
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
  const [links, setLinks]       = useState<TerminPartner[]>([])
  const [loading, setLoading]   = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)

  useEffect(() => {
    getTerminPartners(terminId)
      .then(setLinks)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [terminId])

  const handleRemove = async (linkId: number) => {
    setRemovingId(linkId)
    try {
      await removeTerminPartner(terminId, linkId)
      setLinks(prev => prev.filter(l => l.id !== linkId))
    } catch { /* ignore */ } finally {
      setRemovingId(null)
    }
  }

  return (
    <>
      <div className="pt-card" style={{ maxWidth: '640px' }}>
        <div className="pt-card-header">
          <span className="pt-card-title">Partner / Veranstalter</span>
          {isAdmin && (
            <button
              onClick={() => setShowPicker(true)}
              className="text-gray-400 hover:text-blue-600 transition-colors"
              title="Partner hinzufügen"
            >
              <Plus size={14} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="pt-card-body flex items-center justify-center py-6">
            <Loader2 size={14} className="animate-spin text-gray-400" />
          </div>
        ) : links.length === 0 ? (
          <div className="pt-card-body text-sm text-gray-400">
            Noch kein Partner verknüpft.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {links.map(link => (
              <div key={link.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{link.company_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {[link.partner_type, link.contact_person, link.city].filter(Boolean).join(' · ')}
                  </div>
                  {(link.email || link.phone) && (
                    <div className="text-xs text-gray-400">
                      {[link.email, link.phone].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <button
                    onClick={() => handleRemove(link.id)}
                    disabled={removingId === link.id}
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Verknüpfung aufheben"
                  >
                    {removingId === link.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <X size={13} />
                    }
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showPicker && (
        <PartnerPickerModal
          terminId={terminId}
          existingPartnerIds={links.map(l => l.partner_id)}
          onAdded={tp => setLinks(prev => [...prev, tp])}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
