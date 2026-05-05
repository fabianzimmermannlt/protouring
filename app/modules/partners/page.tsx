'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Save, X } from 'lucide-react'
import { getPartners, createPartner, updatePartner, deletePartner, isEditorRole, getEffectiveRole, type Partner, type PartnerFormData } from '@/lib/api-client'
import { useSortable } from '@/app/hooks/useSortable'
import { useIsMobile } from '@/app/hooks/useIsMobile'
import { PartnerDetailContent } from '@/app/modules/partners/PartnerDetail'

const PARTNER_COLS: [string, keyof Partner][] = [
  ['Firmenname', 'companyName'],
  ['Straße', 'street'],
  ['PLZ', 'postalCode'],
  ['Ort', 'city'],
  ['Bundesland', 'state'],
  ['Land', 'country'],
  ['Art', 'type'],
]

export default function PartnersPage() {
  const isMobile = useIsMobile()
  const isEditor = isEditorRole(getEffectiveRole())
  const [partners, setPartners] = useState<Partner[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const m = window.location.pathname.match(/\/partners\/([^/]+)/)
    if (m?.[1]) return m[1]
    return localStorage.getItem('pt_partners_last_id') ?? null
  })
  const [formData, setFormData] = useState<PartnerFormData>({
    type: '',
    companyName: '',
    street: '',
    postalCode: '',
    city: '',
    state: '',
    country: '',
    contactPerson: '',
    email: '',
    phone: '',
    taxId: '',
    billingAddress: '',
    notes: ''
  })

  // Partner types for dropdown
  const partnerTypes = [
    'Veranstaltende',
    'Autovermietung',
    'Trucking-Firma',
    'Reisebüro',
    'Technik-Lieferant',
    'Backline-Firma',
    'Medien-/Videoproduktion',
    'Catering-Firma',
    'Sicherheits-Firma',
    'Merchandise-Dienstleister',
    'Ticketing-Dienstleister',
    'Support-Band',
    'Booking Agentur',
    'Zulieferer Sonstiges',
    'Endorser',
    'Brand',
    'Management',
    'Studio',
    'Label',
    'Marketing'
  ]

  useEffect(() => {
    getPartners().then(setPartners).catch(() => {})
  }, [])

  // SPA: select-partner event
  useEffect(() => {
    const selectHandler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      if (id) setSelectedPartnerId(id)
    }
    const deleteHandler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      if (id) {
        setPartners(prev => prev.filter(p => p.id !== id))
        setSelectedPartnerId(null)
      }
    }
    window.addEventListener('select-partner', selectHandler)
    window.addEventListener('partner-deleted', deleteHandler)
    return () => {
      window.removeEventListener('select-partner', selectHandler)
      window.removeEventListener('partner-deleted', deleteHandler)
    }
  }, [])

  // Sidebar events
  useEffect(() => {
    const onCreate = () => { setEditingPartner(null); setFormData({ type: '', companyName: '', street: '', postalCode: '', city: '', state: '', country: '', contactPerson: '', email: '', phone: '', taxId: '', billingAddress: '', notes: '' }); setIsModalOpen(true) }
    const onSelect = (e: Event) => {
      const p = (e as CustomEvent<Partner>).detail
      if (p) openEditPartnerModal(p)
    }
    window.addEventListener('partner-sidebar-create', onCreate)
    window.addEventListener('partner-sidebar-select', onSelect)
    return () => {
      window.removeEventListener('partner-sidebar-create', onCreate)
      window.removeEventListener('partner-sidebar-select', onSelect)
    }
  }, [])

  const savePartner = async () => {
    if (!formData.companyName.trim()) return
    try {
      if (editingPartner) {
        const updated = await updatePartner(editingPartner.id, formData as PartnerFormData)
        setPartners(prev => prev.map(p => p.id === updated.id ? updated : p))
      } else {
        const created = await createPartner(formData as PartnerFormData)
        setPartners(prev => [...prev, created])
      }
      setIsModalOpen(false); setEditingPartner(null)
    } catch { alert('Speichern fehlgeschlagen.') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diesen Partner wirklich löschen?')) return
    try {
      await deletePartner(id)
      setPartners(prev => prev.filter(p => p.id !== id))
      setIsModalOpen(false); setEditingPartner(null)
    } catch { alert('Löschen fehlgeschlagen.') }
  }

  const openNewPartnerModal = () => {
    setEditingPartner(null)
    setFormData({
      type: '',
      companyName: '',
      street: '',
      postalCode: '',
      city: '',
      state: '',
      country: '',
      contactPerson: '',
      email: '',
      phone: '',
      taxId: '',
      billingAddress: '',
      notes: ''
    })
    setIsModalOpen(true)
  }

  const openEditPartnerModal = (partner: Partner) => {
    setEditingPartner(partner)
    setFormData({
      type: partner.type,
      companyName: partner.companyName,
      street: partner.street,
      postalCode: partner.postalCode,
      city: partner.city,
      state: partner.state,
      country: partner.country,
      contactPerson: partner.contactPerson,
      email: partner.email,
      phone: partner.phone,
      taxId: partner.taxId,
      billingAddress: partner.billingAddress,
      notes: partner.notes
    })
    setIsModalOpen(true)
  }

  const handleInputChange = (field: keyof PartnerFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }


  // Desktop SPA: show detail inline
  if (!isMobile && selectedPartnerId) {
    return <PartnerDetailContent partnerId={selectedPartnerId} />
  }

  return (
    <div className="module-content">
      {/* Mobile: Neu-Button */}
      {isMobile && isEditor && (
        <div className="flex items-center gap-2">
          <button onClick={openNewPartnerModal} className="btn btn-primary"><Plus className="w-4 h-4" /> Neu</button>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder="Partner durchsuchen..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />

      {/* Partners Table / Mobile Cards */}
      {(() => {
        const filtered = partners.filter(p =>
          `${p.companyName} ${p.type} ${p.contactPerson} ${p.city} ${p.country}`.toLowerCase().includes(searchTerm.toLowerCase())
        )
        if (filtered.length === 0) return (
          <div className="text-center py-12 text-gray-500">
            <div className="text-lg mb-2">{partners.length === 0 ? 'Keine Partner vorhanden' : 'Keine Treffer'}</div>
            {partners.length === 0 && <div className="text-sm">Klicken Sie auf &quot;Neuer Partner&quot; um den ersten Partner anzulegen</div>}
          </div>
        )
        return isMobile ? (
          <div className="flex flex-col gap-2">
            {[...filtered].sort((a, b) => a.companyName.localeCompare(b.companyName, 'de')).map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 cursor-pointer"
                onClick={() => window.location.href = `/partners/${item.id}`}>
                <p className="text-sm font-semibold text-gray-900">{item.companyName}</p>
                {item.type && <p className="text-xs text-gray-500 mt-0.5">{item.type}</p>}
                {item.city && <p className="text-xs text-gray-400 mt-0.5">{item.city}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="data-table-wrapper">
            <PartnerTable partners={filtered} onEdit={p => {
              history.pushState(null, '', `/partners/${p.id}`)
              window.dispatchEvent(new CustomEvent('select-partner', { detail: { id: p.id } }))
            }} />
          </div>
        )
      })()}

      {/* Modal for Add/Edit Partner */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-container max-w-4xl">
            {/* Header */}
            <div className="modal-header">
              <h2 className="modal-title">
                {editingPartner ? 'Partner bearbeiten' : 'Neuen Partner anlegen'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Content */}
            <div className="modal-body">
              <div className="space-y-6">
                {/* First Row: Basic Information */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="form-label">Art</label>
                      <select
                        value={formData.type}
                        onChange={(e) => handleInputChange('type', e.target.value)}
                        className="form-input"
                      >
                        <option value="">Bitte wählen...</option>
                        {partnerTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Firmenname</label>
                      <input
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => handleInputChange('companyName', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label className="form-label">Straße</label>
                      <input
                        type="text"
                        value={formData.street}
                        onChange={(e) => handleInputChange('street', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="grid grid-cols-[auto_1fr] gap-1">
                      <div>
                        <label className="form-label">PLZ</label>
                        <input
                          type="text"
                          value={formData.postalCode}
                          onChange={(e) => handleInputChange('postalCode', e.target.value)}
                          maxLength={5}
                          className="form-input !w-20"
                          placeholder="12345"
                        />
                      </div>
                      <div>
                        <label className="form-label">Ort</label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => handleInputChange('city', e.target.value)}
                          className="form-input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="form-label">Bundesland</label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => handleInputChange('state', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label className="form-label">Land</label>
                      <input
                        type="text"
                        value={formData.country}
                        onChange={(e) => handleInputChange('country', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label className="form-label">Ansprechpartner</label>
                      <input
                        type="text"
                        value={formData.contactPerson}
                        onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label className="form-label">E-Mail</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Second Row: Additional Information */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="form-label">Telefon</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label className="form-label">Steuer-ID</label>
                      <input
                        type="text"
                        value={formData.taxId}
                        onChange={(e) => handleInputChange('taxId', e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  {/* Right Column - Text Areas */}
                  <div className="space-y-4">
                    <div>
                      <label className="form-label">Abweichende Rechnungsanschrift</label>
                      <textarea
                        value={formData.billingAddress}
                        onChange={(e) => handleInputChange('billingAddress', e.target.value)}
                        rows={3}
                        className="form-input"
                        placeholder="Falls abweichend von der Hauptadresse..."
                      />
                    </div>

                    <div>
                      <label className="form-label">Bemerkung</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                        rows={3}
                        className="form-input"
                        placeholder="Zusätzliche Informationen oder Notizen..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="modal-footer">
              {editingPartner && (
                <button
                  onClick={() => {
                    if (confirm(`Möchten Sie den Partner "${formData.companyName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
                      handleDelete(editingPartner.id)
                      setIsModalOpen(false)
                    }
                  }}
                  className="btn btn-danger"
                >
                  <Trash2 className="h-4 w-4" />
                  Löschen
                </button>
              )}
              <div className={`flex space-x-4 ${editingPartner ? '' : 'ml-auto'}`}>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-ghost"
                >
                  Abbrechen
                </button>
                <button
                  onClick={savePartner}
                  className="btn btn-primary"
                >
                  <Save className="h-4 w-4" />
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PartnerTable({ partners, onEdit }: { partners: Partner[]; onEdit: (p: Partner) => void }) {
  const { sortKey, sortDir, sorted, toggleSort } = useSortable(
    partners as unknown as Record<string, unknown>[],
    'companyName'
  )
  return (
    <table className="data-table">
      <thead>
        <tr>
          {PARTNER_COLS.map(([label, key]) => (
            <th key={key as string} className="sortable" onClick={() => toggleSort(key as string)}>
              {label}
              <span className={`sort-indicator${sortKey === key ? ' active' : ''}`}>
                {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(sorted as unknown as Partner[]).map((partner) => (
          <tr key={partner.id} className="clickable" onClick={() => onEdit(partner)}>
            <td className="font-medium">{partner.companyName}</td>
            <td>{partner.street}</td>
            <td>{partner.postalCode}</td>
            <td>{partner.city}</td>
            <td>{partner.state}</td>
            <td>{partner.country}</td>
            <td>{partner.type}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
