'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Save, X, ArrowLeft, Download, Upload } from 'lucide-react'
import { getPartners, createPartner, updatePartner, deletePartner, isEditorRole, getEffectiveRole, type Partner, type PartnerFormData } from '@/lib/api-client'
import { useSortable } from '@/app/hooks/useSortable'
import ColumnToggle from '@/app/components/shared/ColumnToggle'
import { useColumnVisibility } from '@/app/components/shared/useColumnVisibility'
import { useIsMobile } from '@/app/hooks/useIsMobile'
import { PartnerDetailContent } from '@/app/modules/partners/PartnerDetail'
import { useT } from '@/app/lib/i18n/LanguageContext'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'
import { QuickCreatePartnerModal } from '@/app/components/shared/modals/QuickCreatePartnerModal'

export default function PartnersPage() {
  const t = useT()
  const isMobile = useIsMobile()
  const { layout } = useLayout()
  const isL2 = layout === 'L2'
  const isEditor = isEditorRole(getEffectiveRole())
  const isAdmin = getEffectiveRole() === 'admin'
  const [partners, setPartners] = useState<Partner[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const m = window.location.pathname.match(/\/partners\/([^/]+)/)
    if (m?.[1]) return m[1]
    return null
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
    const updateHandler = (e: Event) => {
      const updated = (e as CustomEvent<Partner>).detail
      if (updated) setPartners(prev => prev.map(p => p.id === updated.id ? updated : p))
    }
    const showListHandler = () => setSelectedPartnerId(null)
    window.addEventListener('select-partner', selectHandler)
    window.addEventListener('partner-deleted', deleteHandler)
    window.addEventListener('partner-updated', updateHandler)
    window.addEventListener('partner-show-list', showListHandler)
    return () => {
      window.removeEventListener('select-partner', selectHandler)
      window.removeEventListener('partner-deleted', deleteHandler)
      window.removeEventListener('partner-updated', updateHandler)
      window.removeEventListener('partner-show-list', showListHandler)
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
    } catch { alert(t('general.saveFailed')) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('partners.deleteConfirmFull').replace('{name}', formData.companyName))) return
    try {
      await deletePartner(id)
      setPartners(prev => prev.filter(p => p.id !== id))
      setIsModalOpen(false); setEditingPartner(null)
    } catch { alert(t('general.deleteFailed')) }
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


  if (!isMobile && !isL2) {
    if (!selectedPartnerId) return null
    return <PartnerDetailContent partnerId={selectedPartnerId} onNotFound={() => {
      localStorage.removeItem('pt_partners_last_id')
      setSelectedPartnerId(null)
    }} />
  }

  if (!isMobile && isL2 && selectedPartnerId) {
    return <PartnerDetailContent partnerId={selectedPartnerId}
      onNotFound={() => { localStorage.removeItem('pt_partners_last_id'); setSelectedPartnerId(null) }}
      onBack={() => { setSelectedPartnerId(null); localStorage.removeItem('pt_partners_last_id'); getPartners().then(setPartners).catch(() => {}) }}
      headerRight={isAdmin ? (
        <button
          onClick={async () => {
            const p = partners.find(x => x.id === selectedPartnerId)
            if (!confirm(`„${p?.companyName ?? selectedPartnerId}" löschen?`)) return
            await deletePartner(selectedPartnerId!)
            setPartners(prev => prev.filter(x => x.id !== selectedPartnerId))
            setSelectedPartnerId(null)
          }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
          title="Partner löschen"
        >
          <Trash2 size={14} />
        </button>
      ) : undefined}
    />
  }

  return (
    <div className="module-content">
      {isL2 ? (
        <>
          <h1 className="text-xl font-semibold mb-1" style={{color:'#e0e0e0'}}>Partner</h1>
          <div className="flex items-center gap-2 mb-2">
            {isEditor && <button onClick={() => setShowQuickCreate(true)} className="btn btn-primary flex-shrink-0" style={{borderRadius:'4px'}}><Plus className="w-4 h-4" /> Neu</button>}
            <input type="text" placeholder={t('partners.searchPlaceholder')} value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} className="search-input l2-search" style={{marginBottom:0, borderRadius:'4px'}} />
            {isAdmin && <>
              <button className="btn btn-ghost flex-shrink-0" style={{borderRadius:'4px'}} title="CSV Export"><Download className="w-4 h-4" /></button>
              <label className="btn btn-ghost flex-shrink-0 cursor-pointer" style={{borderRadius:'4px'}} title="CSV Import"><Upload className="w-4 h-4" /><input type="file" accept=".csv" className="hidden" /></label>
            </>}
          </div>
        </>
      ) : (
        <>
          {isMobile && isEditor && (
            <div className="flex items-center gap-2">
              <button onClick={openNewPartnerModal} className="btn btn-primary"><Plus className="w-4 h-4" /> Neu</button>
            </div>
          )}
          <input type="text" placeholder={t('partners.searchPlaceholder')} value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        </>
      )}

      {/* Partners Table / Mobile Cards */}
      {(() => {
        const filtered = partners.filter(p =>
          `${p.companyName} ${p.type} ${p.contactPerson} ${p.city} ${p.country}`.toLowerCase().includes(searchTerm.toLowerCase())
        )
        if (filtered.length === 0) return (
          <div className="text-center py-12 text-gray-500">
            <div className="text-lg mb-2">{partners.length === 0 ? 'Keine Partner vorhanden' : t('general.noResults')}</div>
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
            <PartnerTable partners={filtered} isAdmin={isAdmin} onEdit={p => {
              if (isL2) { localStorage.setItem('pt_partners_last_id', p.id); setSelectedPartnerId(p.id) }
              else { history.pushState(null, '', `/partners/${p.id}`); window.dispatchEvent(new CustomEvent('select-partner', { detail: { id: p.id } })) }
            }} onDelete={async (id) => {
              const p = partners.find(x => x.id === id)
              if (!confirm(`„${p?.companyName ?? id}" löschen?`)) return
              await deletePartner(id)
              setPartners(prev => prev.filter(x => x.id !== id))
            }} />
          </div>
        )
      })()}

      {showQuickCreate && (
        <QuickCreatePartnerModal
          onClose={() => setShowQuickCreate(false)}
          onCreated={p => {
            setPartners(prev => [...prev, p])
            localStorage.setItem('pt_partners_last_id', p.id)
            setSelectedPartnerId(p.id)
            setShowQuickCreate(false)
          }}
        />
      )}

      {/* Modal for Add/Edit Partner */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-container max-w-4xl">
            {/* Header */}
            <div className="modal-header">
              <h2 className="modal-title">
                {editingPartner ? t('partners.editPartner') : t('partners.newPartner')}
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
                      <label className="form-label">{t('partners.type')}</label>
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
                      <label className="form-label">{t('partners.companyName')}</label>
                      <input
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => handleInputChange('companyName', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label className="form-label">{t('address.street')}</label>
                      <input
                        type="text"
                        value={formData.street}
                        onChange={(e) => handleInputChange('street', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="grid grid-cols-[auto_1fr] gap-1">
                      <div>
                        <label className="form-label">{t('address.postalCode')}</label>
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
                        <label className="form-label">{t('address.city')}</label>
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
                      <label className="form-label">{t('address.state')}</label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => handleInputChange('state', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label className="form-label">{t('address.country')}</label>
                      <input
                        type="text"
                        value={formData.country}
                        onChange={(e) => handleInputChange('country', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label className="form-label">{t('partners.contactPerson')}</label>
                      <input
                        type="text"
                        value={formData.contactPerson}
                        onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label className="form-label">{t('general.email')}</label>
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
                      <label className="form-label">{t('general.phone')}</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label className="form-label">{t('partners.taxId')}</label>
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
                      <label className="form-label">{t('partners.billingAddressFull')}</label>
                      <textarea
                        value={formData.billingAddress}
                        onChange={(e) => handleInputChange('billingAddress', e.target.value)}
                        rows={3}
                        className="form-input"
                        placeholder={t('partners.billingAddressPlaceholder')}
                      />
                    </div>

                    <div>
                      <label className="form-label">{t('partners.notes')}</label>
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
                    if (confirm(t('partners.deleteConfirmFull').replace('{name}', formData.companyName))) {
                      handleDelete(editingPartner.id)
                      setIsModalOpen(false)
                    }
                  }}
                  className="btn btn-danger"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('general.delete')}
                </button>
              )}
              <div className={`flex space-x-4 ${editingPartner ? '' : 'ml-auto'}`}>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-ghost"
                >
                  {t('general.cancel')}
                </button>
                <button
                  onClick={savePartner}
                  className="btn btn-primary"
                >
                  <Save className="h-4 w-4" />
                  {t('general.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const PARTNER_COLUMNS = [
  { id: 'name',    label: 'Firma',    defaultVisible: true, alwaysVisible: true },
  { id: 'type',    label: 'Typ',      defaultVisible: true },
  { id: 'contact', label: 'Kontakt',  defaultVisible: true },
  { id: 'street',  label: 'Straße',   defaultVisible: false },
  { id: 'zip',     label: 'PLZ',      defaultVisible: false },
  { id: 'city',    label: 'Stadt',    defaultVisible: true },
  { id: 'state',   label: 'Bundesl.', defaultVisible: false },
  { id: 'country', label: 'Land',     defaultVisible: false },
]

function PartnerTable({ partners, onEdit, onDelete, isAdmin }: { partners: Partner[]; onEdit: (p: Partner) => void; onDelete: (id: string) => void; isAdmin: boolean }) {
  const { isVisible, toggle, columns } = useColumnVisibility('partner-list', PARTNER_COLUMNS)
  const { sortKey, sortDir, sorted, toggleSort } = useSortable(
    partners as unknown as Record<string, unknown>[],
    'companyName'
  )
  return (
    <table className="data-table">
      <thead>
        <tr>
          {isVisible('name')    && <th className="sortable" onClick={() => toggleSort('companyName')}>Firma<span className={`sort-indicator${sortKey === 'companyName' ? ' active' : ''}`}>{sortKey === 'companyName' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('type')    && <th className="sortable" onClick={() => toggleSort('type')}>Typ<span className={`sort-indicator${sortKey === 'type' ? ' active' : ''}`}>{sortKey === 'type' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('contact') && <th className="sortable" onClick={() => toggleSort('contactPerson')}>Kontakt<span className={`sort-indicator${sortKey === 'contactPerson' ? ' active' : ''}`}>{sortKey === 'contactPerson' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('street')  && <th className="sortable" onClick={() => toggleSort('street')}>Straße<span className={`sort-indicator${sortKey === 'street' ? ' active' : ''}`}>{sortKey === 'street' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('zip')     && <th className="sortable" onClick={() => toggleSort('postalCode')}>PLZ<span className={`sort-indicator${sortKey === 'postalCode' ? ' active' : ''}`}>{sortKey === 'postalCode' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('city')    && <th className="sortable" onClick={() => toggleSort('city')}>Stadt<span className={`sort-indicator${sortKey === 'city' ? ' active' : ''}`}>{sortKey === 'city' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('state')   && <th className="sortable" onClick={() => toggleSort('state')}>Bundesland<span className={`sort-indicator${sortKey === 'state' ? ' active' : ''}`}>{sortKey === 'state' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('country') && <th className="sortable" onClick={() => toggleSort('country')}>Land<span className={`sort-indicator${sortKey === 'country' ? ' active' : ''}`}>{sortKey === 'country' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          <th style={{ width: 32, textAlign: 'right' }}>
            <ColumnToggle columns={columns} isVisible={isVisible} toggle={toggle} />
          </th>
        </tr>
      </thead>
      <tbody>
        {(sorted as unknown as Partner[]).map((partner) => (
          <tr key={partner.id} className="clickable" onClick={() => onEdit(partner)}>
            {isVisible('name')    && <td className="font-medium">{partner.companyName}</td>}
            {isVisible('type')    && <td>{partner.type}</td>}
            {isVisible('contact') && <td>{partner.contactPerson}</td>}
            {isVisible('street')  && <td>{partner.street}</td>}
            {isVisible('zip')     && <td>{partner.postalCode}</td>}
            {isVisible('city')    && <td>{partner.city}</td>}
            {isVisible('state')   && <td>{partner.state}</td>}
            {isVisible('country') && <td>{partner.country}</td>}
            <td style={{ textAlign: 'right', padding: '0 8px' }} onClick={e => e.stopPropagation()}>
              {isAdmin && (
                <button
                  onClick={() => onDelete(partner.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                  title="Löschen"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
