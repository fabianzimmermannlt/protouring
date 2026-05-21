'use client'

import { useState, useEffect } from 'react'
import { Plus, ArrowLeft, Download, Upload, Trash2 } from 'lucide-react'
import { getHotels, deleteHotel, isEditorRole, getEffectiveRole, type Hotel } from '@/lib/api-client'
import { useT } from '@/app/lib/i18n/LanguageContext'
import HotelFormModal from './HotelFormModal'
import { QuickCreateHotelModal } from '@/app/components/shared/modals/QuickCreateHotelModal'
import { useSortable } from '@/app/hooks/useSortable'
import ColumnToggle from '@/app/components/shared/ColumnToggle'
import { useColumnVisibility } from '@/app/components/shared/useColumnVisibility'
import { useIsMobile } from '@/app/hooks/useIsMobile'
import { HotelDetailContent } from '@/app/modules/hotels/HotelDetail'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'

const HOTEL_COLUMNS = [
  { id: 'name',    label: 'Name',    defaultVisible: true, alwaysVisible: true },
  { id: 'street',  label: 'Straße',  defaultVisible: false },
  { id: 'zip',     label: 'PLZ',     defaultVisible: false },
  { id: 'city',    label: 'Stadt',   defaultVisible: true },
  { id: 'state',   label: 'Bundesl.',defaultVisible: false },
  { id: 'country', label: 'Land',    defaultVisible: false },
  { id: 'website', label: 'Website', defaultVisible: true },
]

function HotelTable({ hotels, onEdit, onDelete, isAdmin }: { hotels: Hotel[]; onEdit: (h: Hotel) => void; onDelete: (id: string) => void; isAdmin: boolean }) {
  const { isVisible, toggle, columns } = useColumnVisibility('hotel-list', HOTEL_COLUMNS)
  const { sortKey, sortDir, sorted, toggleSort } = useSortable(
    hotels as unknown as Record<string, unknown>[],
    'name'
  )
  return (
    <table className="data-table">
      <thead>
        <tr>
          {isVisible('name')    && <th className="sortable" onClick={() => toggleSort('name')}>Name<span className={`sort-indicator${sortKey === 'name' ? ' active' : ''}`}>{sortKey === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('street')  && <th className="sortable" onClick={() => toggleSort('street')}>Straße<span className={`sort-indicator${sortKey === 'street' ? ' active' : ''}`}>{sortKey === 'street' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('zip')     && <th className="sortable" onClick={() => toggleSort('postalCode')}>PLZ<span className={`sort-indicator${sortKey === 'postalCode' ? ' active' : ''}`}>{sortKey === 'postalCode' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('city')    && <th className="sortable" onClick={() => toggleSort('city')}>Stadt<span className={`sort-indicator${sortKey === 'city' ? ' active' : ''}`}>{sortKey === 'city' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('state')   && <th className="sortable" onClick={() => toggleSort('state')}>Bundesland<span className={`sort-indicator${sortKey === 'state' ? ' active' : ''}`}>{sortKey === 'state' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('country') && <th className="sortable" onClick={() => toggleSort('country')}>Land<span className={`sort-indicator${sortKey === 'country' ? ' active' : ''}`}>{sortKey === 'country' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('website') && <th className="sortable" onClick={() => toggleSort('website')}>Website<span className={`sort-indicator${sortKey === 'website' ? ' active' : ''}`}>{sortKey === 'website' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          <th style={{ width: 32, textAlign: 'right' }}>
            <ColumnToggle columns={columns} isVisible={isVisible} toggle={toggle} />
          </th>
        </tr>
      </thead>
      <tbody>
        {(sorted as unknown as Hotel[]).map((hotel) => (
          <tr key={hotel.id} className="clickable" onClick={() => onEdit(hotel)}>
            {isVisible('name')    && <td className="font-medium">{hotel.name}</td>}
            {isVisible('street')  && <td>{hotel.street}</td>}
            {isVisible('zip')     && <td>{hotel.postalCode}</td>}
            {isVisible('city')    && <td>{hotel.city}</td>}
            {isVisible('state')   && <td>{hotel.state}</td>}
            {isVisible('country') && <td>{hotel.country}</td>}
            {isVisible('website') && <td>
              {hotel.website ? (
                <a
                  href={hotel.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  {hotel.website.replace('https://www.', '').replace('https://', '').split('/')[0]}
                </a>
              ) : '-'}
            </td>}
            <td style={{ textAlign: 'right', padding: '0 8px' }} onClick={e => e.stopPropagation()}>
              {isAdmin && (
                <button
                  onClick={() => onDelete(hotel.id)}
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

export default function HotelsPage() {
  const t = useT()
  const isMobile = useIsMobile()
  const { layout } = useLayout()
  const isL2 = layout === 'L2'
  const isEditor = isEditorRole(getEffectiveRole())
  const isAdmin = getEffectiveRole() === 'admin'
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const m = window.location.pathname.match(/\/hotels\/([^/]+)/)
    if (m?.[1]) return m[1]
    return null
  })

  useEffect(() => {
    getHotels().then(setHotels).catch(() => {})
  }, [])

  // SPA: select-hotel event
  useEffect(() => {
    const selectHandler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      if (id) setSelectedHotelId(id)
    }
    const deleteHandler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      if (id) {
        setHotels(prev => prev.filter(h => h.id !== id))
        setSelectedHotelId(null)
      }
    }
    const updateHandler = (e: Event) => {
      const updated = (e as CustomEvent<Hotel>).detail
      if (updated) setHotels(prev => prev.map(h => h.id === updated.id ? updated : h))
    }
    const showListHandler = () => setSelectedHotelId(null)
    window.addEventListener('select-hotel', selectHandler)
    window.addEventListener('hotel-deleted', deleteHandler)
    window.addEventListener('hotel-updated', updateHandler)
    window.addEventListener('hotel-show-list', showListHandler)
    return () => {
      window.removeEventListener('select-hotel', selectHandler)
      window.removeEventListener('hotel-deleted', deleteHandler)
      window.removeEventListener('hotel-updated', updateHandler)
      window.removeEventListener('hotel-show-list', showListHandler)
    }
  }, [])

  const openNewHotelModal = () => { setEditingHotel(null); setIsModalOpen(true) }
  const openEditHotelModal = (hotel: Hotel) => { setEditingHotel(hotel); setIsModalOpen(true) }

  // Sidebar events
  useEffect(() => {
    const onCreate = () => openNewHotelModal()
    const onSelect = (e: Event) => { const h = (e as CustomEvent<Hotel>).detail; if (h) openEditHotelModal(h) }
    window.addEventListener('hotel-sidebar-create', onCreate)
    window.addEventListener('hotel-sidebar-select', onSelect)
    return () => {
      window.removeEventListener('hotel-sidebar-create', onCreate)
      window.removeEventListener('hotel-sidebar-select', onSelect)
    }
  }, [])


  const filtered = hotels.filter(h =>
    `${h.name} ${h.city} ${h.state} ${h.country} ${h.website}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Desktop: L3 → Side-Panel zeigt Liste, Content zeigt Detail
  if (!isMobile && !isL2) {
    if (!selectedHotelId) return null
    return <HotelDetailContent hotelId={selectedHotelId} onNotFound={() => {
      localStorage.removeItem('pt_hotels_last_id')
      setSelectedHotelId(null)
    }} />
  }

  // Desktop L2: Detail-Ansicht wenn Hotel selektiert
  if (!isMobile && isL2 && selectedHotelId) {
    return <HotelDetailContent hotelId={selectedHotelId}
      onNotFound={() => { localStorage.removeItem('pt_hotels_last_id'); setSelectedHotelId(null) }}
      onBack={() => { setSelectedHotelId(null); localStorage.removeItem('pt_hotels_last_id'); getHotels().then(setHotels).catch(() => {}) }}
      headerRight={isAdmin ? (
        <button
          onClick={async () => {
            const hotel = hotels.find(h => h.id === selectedHotelId)
            const label = hotel?.name ?? selectedHotelId
            if (!confirm(`„${label}" wirklich löschen?`)) return
            await deleteHotel(selectedHotelId!)
            setHotels(prev => prev.filter(h => h.id !== selectedHotelId))
            setSelectedHotelId(null)
          }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
          title="Hotel löschen"
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
          <h1 className="text-xl font-semibold mb-1" style={{color:'#e0e0e0'}}>Hotels</h1>
          <div className="flex items-center gap-2 mb-1">
            {isEditor && <button onClick={() => setShowQuickCreate(true)} className="btn btn-primary flex-shrink-0" style={{borderRadius:'4px'}}><Plus className="w-4 h-4" /> {t('general.new')}</button>}
            <input type="text" placeholder={t('hotels.searchPlaceholder')} value={searchTerm}
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
            <div className="flex items-center gap-2 mb-3">
              <button onClick={openNewHotelModal} className="btn btn-primary"><Plus className="w-4 h-4" /> {t('general.new')}</button>
            </div>
          )}
          <input
            type="text"
            placeholder={t('hotels.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">{hotels.length === 0 ? t('hotels.noHotels') : t('general.noResults')}</p>
          {hotels.length === 0 && <p className="text-sm">{t('hotels.addHint')}</p>}
        </div>
      ) : isMobile ? (
        <div className="flex flex-col gap-2">
          {[...filtered].sort((a, b) => a.name.localeCompare(b.name, 'de')).map(item => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 cursor-pointer"
              onClick={() => window.location.href = `/hotels/${item.id}`}>
              <p className="text-sm font-semibold text-gray-900">{item.name}</p>
              {item.city && <p className="text-xs text-gray-500 mt-0.5">{item.city}</p>}
              {item.website && <p className="text-xs text-gray-400 mt-0.5">{item.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="data-table-wrapper">
          <HotelTable hotels={filtered} isAdmin={isAdmin} onEdit={h => {
            if (isL2) {
              localStorage.setItem('pt_hotels_last_id', h.id)
              setSelectedHotelId(h.id)
            } else {
              history.pushState(null, '', `/hotels/${h.id}`)
              window.dispatchEvent(new CustomEvent('select-hotel', { detail: { id: h.id } }))
            }
          }} onDelete={async (id) => {
            const h = hotels.find(x => x.id === id)
            if (!confirm(`„${h?.name ?? id}" löschen?`)) return
            await deleteHotel(id)
            setHotels(prev => prev.filter(x => x.id !== id))
          }} />
        </div>
      )}

      {showQuickCreate && (
        <QuickCreateHotelModal
          onClose={() => setShowQuickCreate(false)}
          onCreated={h => {
            setHotels(prev => [...prev, h])
            localStorage.setItem('pt_hotels_last_id', h.id)
            setSelectedHotelId(h.id)
            setShowQuickCreate(false)
          }}
        />
      )}

      {isModalOpen && (
        <HotelFormModal
          hotel={editingHotel}
          onClose={() => setIsModalOpen(false)}
          onSaved={saved => {
            setHotels(prev => {
              const idx = prev.findIndex(h => h.id === saved.id)
              if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
              return [...prev, saved]
            })
            setIsModalOpen(false)
          }}
          onDeleted={id => {
            setHotels(prev => prev.filter(h => h.id !== id))
          }}
        />
      )}
    </div>
  )
}
