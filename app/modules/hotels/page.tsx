'use client'

import { useState, useEffect } from 'react'
import { Plus, ArrowLeft } from 'lucide-react'
import { getHotels, isEditorRole, getEffectiveRole, type Hotel } from '@/lib/api-client'
import { useT } from '@/app/lib/i18n/LanguageContext'
import HotelFormModal from './HotelFormModal'
import { useSortable } from '@/app/hooks/useSortable'
import { useIsMobile } from '@/app/hooks/useIsMobile'
import { HotelDetailContent } from '@/app/modules/hotels/HotelDetail'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'

function HotelTable({ hotels, onEdit }: { hotels: Hotel[]; onEdit: (h: Hotel) => void }) {
  const t = useT()
  const HOTEL_COLS: [string, keyof Hotel][] = [
    [t('general.name'), 'name'],
    [t('table.street'), 'street'],
    [t('table.postalCode'), 'postalCode'],
    [t('table.city'), 'city'],
    [t('table.state'), 'state'],
    [t('table.country'), 'country'],
    [t('table.website'), 'website'],
  ]
  const { sortKey, sortDir, sorted, toggleSort } = useSortable(
    hotels as unknown as Record<string, unknown>[],
    'name'
  )
  return (
    <table className="data-table">
      <thead>
        <tr>
          {HOTEL_COLS.map(([label, key]) => (
            <th
              key={key as string}
              className="sortable"
              onClick={() => toggleSort(key as string)}
            >
              {label}
              <span className={`sort-indicator${sortKey === key ? ' active' : ''}`}>
                {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(sorted as unknown as Hotel[]).map((hotel) => (
          <tr key={hotel.id} className="clickable" onClick={() => onEdit(hotel)}>
            <td className="font-medium">{hotel.name}</td>
            <td>{hotel.street}</td>
            <td>{hotel.postalCode}</td>
            <td>{hotel.city}</td>
            <td>{hotel.state}</td>
            <td>{hotel.country}</td>
            <td>
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
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const m = window.location.pathname.match(/\/hotels\/([^/]+)/)
    if (m?.[1]) return m[1]
    return localStorage.getItem('pt_hotels_last_id') ?? null
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
    window.addEventListener('select-hotel', selectHandler)
    window.addEventListener('hotel-deleted', deleteHandler)
    return () => {
      window.removeEventListener('select-hotel', selectHandler)
      window.removeEventListener('hotel-deleted', deleteHandler)
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
    return (
      <div>
        <button
          onClick={() => { setSelectedHotelId(null); localStorage.removeItem('pt_hotels_last_id') }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück zur Übersicht
        </button>
        <HotelDetailContent hotelId={selectedHotelId} onNotFound={() => {
          localStorage.removeItem('pt_hotels_last_id')
          setSelectedHotelId(null)
        }} />
      </div>
    )
  }

  return (
    <div className="module-content">
      {isL2 ? (
        <>
          <h1 className="text-xl font-semibold mb-4" style={{color:'#e0e0e0'}}>Hotels</h1>
          {isEditor && (
            <div className="flex items-center gap-2 mb-3">
              <button onClick={openNewHotelModal} className="btn btn-primary"><Plus className="w-4 h-4" /> {t('general.new')}</button>
            </div>
          )}
        </>
      ) : isMobile && isEditor ? (
        <div className="flex items-center gap-2 mb-3">
          <button onClick={openNewHotelModal} className="btn btn-primary"><Plus className="w-4 h-4" /> {t('general.new')}</button>
        </div>
      ) : null}

      <input
        type="text"
        placeholder={t('hotels.searchPlaceholder')}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />

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
          <HotelTable hotels={filtered} onEdit={h => {
            if (isL2) {
              localStorage.setItem('pt_hotels_last_id', h.id)
              setSelectedHotelId(h.id)
            } else {
              history.pushState(null, '', `/hotels/${h.id}`)
              window.dispatchEvent(new CustomEvent('select-hotel', { detail: { id: h.id } }))
            }
          }} />
        </div>
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
