'use client'

import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { getPartners, type Partner } from '@/lib/api-client'
import { QuickCreatePartnerModal } from '@/app/components/shared/modals/QuickCreatePartnerModal'

// Geteilter Partner-Picker: Suchliste aus den Stammdaten + „neu anlegen".
// Einheitlich verwendet in Event→Partner und Booking→Parteien.
export function PartnerPickerModal({
  existingPartnerIds = [],
  onSelect,
  onClose,
}: {
  existingPartnerIds?: number[]
  onSelect: (partner: Partner) => void
  onClose: () => void
}) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

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
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Partner wählen</h3>
          <button data-modal-close onClick={onClose} style={{ color: 'var(--text-muted)' }} className="hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <div className="px-4 py-3 space-y-2">
          <input type="text" autoFocus placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} className="form-input w-full text-sm" style={{ fontSize: 13 }} />
          <div className="max-h-64 overflow-y-auto" style={{ border: '1px solid var(--border)' }}>
            <button
              onClick={() => setShowCreate(true)}
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-1 transition-colors"
              style={{ color: 'var(--primary-2)', borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
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
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="font-medium" style={{ color: 'var(--text)' }}>{p.companyName}</div>
                {(p.type || p.contactPerson || p.city) && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{[p.type, p.contactPerson, p.city].filter(Boolean).join(' · ')}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showCreate && (
        <QuickCreatePartnerModal
          onClose={() => setShowCreate(false)}
          onCreated={newPartner => { setPartners(prev => [...prev, newPartner]); setShowCreate(false); onSelect(newPartner) }}
        />
      )}
    </div>
  )
}

export default PartnerPickerModal
