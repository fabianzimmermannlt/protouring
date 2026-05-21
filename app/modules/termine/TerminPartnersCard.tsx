'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Loader2, ExternalLink } from 'lucide-react'
import {
  getTerminPartners, addTerminPartner, updateTerminPartnerRole, removeTerminPartner,
  getPartners, getPartnerTypes,
  type TerminPartner, type Partner, type PartnerType,
} from '@/lib/api-client'

// ── PartnerPicker Modal ──────────────────────────────────────────────────────

function PartnerPickerModal({
  terminId,
  existingPartnerIds,
  partnerTypes,
  onAdded,
  onClose,
}: {
  terminId: number
  existingPartnerIds: number[]
  partnerTypes: PartnerType[]
  onAdded: (tp: TerminPartner) => void
  onClose: () => void
}) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [search, setSearch]     = useState('')
  const [role, setRole]         = useState(partnerTypes.find(t => t.visible) ? partnerTypes.find(t => t.visible)!.name : '')
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
      const tp = await addTerminPartner(terminId, Number(partner.id), role)
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Rolle */}
          <div>
            <label className="form-label">Rolle</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="form-select"
            >
              {partnerTypes.filter(t => t.visible).map(t => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Suche */}
          <input
            type="text"
            autoFocus
            placeholder="Suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
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
                {(p.contactPerson || p.city) && (
                  <div className="text-xs text-gray-400">{[p.contactPerson, p.city].filter(Boolean).join(' · ')}</div>
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
  const [links, setLinks]           = useState<TerminPartner[]>([])
  const [partnerTypes, setPartnerTypes] = useState<PartnerType[]>([])
  const [loading, setLoading]       = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      getTerminPartners(terminId),
      getPartnerTypes(),
    ]).then(([lks, types]) => {
      setLinks(lks)
      setPartnerTypes(types.filter(t => t.visible))
    }).catch(() => {}).finally(() => setLoading(false))
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

  const handleRoleChange = async (link: TerminPartner, newRole: string) => {
    setEditingRoleId(link.id)
    try {
      const updated = await updateTerminPartnerRole(terminId, link.id, newRole)
      setLinks(prev => prev.map(l => l.id === updated.id ? updated : l))
    } catch { /* ignore */ } finally {
      setEditingRoleId(null)
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
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {link.company_name}
                    </span>
                    {(link.contact_person || link.city) && (
                      <span className="text-xs text-gray-400 truncate">
                        {[link.contact_person, link.city].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                  {(link.email || link.phone) && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {[link.email, link.phone].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>

                {/* Rolle */}
                {isAdmin ? (
                  <select
                    value={link.role}
                    onChange={e => handleRoleChange(link, e.target.value)}
                    disabled={editingRoleId === link.id}
                    className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 bg-transparent focus:outline-none focus:border-blue-400"
                    style={{ minWidth: '110px' }}
                  >
                    <option value="">– Rolle –</option>
                    {partnerTypes.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                ) : link.role ? (
                  <span className="text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">{link.role}</span>
                ) : null}

                {/* Entfernen */}
                {isAdmin && (
                  <button
                    onClick={() => handleRemove(link.id)}
                    disabled={removingId === link.id}
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Partner entfernen"
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
          partnerTypes={partnerTypes}
          onAdded={tp => setLinks(prev => [...prev, tp])}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
