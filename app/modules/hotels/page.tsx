'use client'

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { getHotels, isEditorRole, getEffectiveRole, type Hotel } from '@/lib/api-client'
import HotelFormModal from './HotelFormModal'
import { useSortable } from '@/app/hooks/useSortable'
import { useIsMobile } from '@/app/hooks/useIsMobile'
import { HotelDetailContent } from '@/app/modules/hotels/HotelDetail'

const HOTEL_COLS: [string, keyof Hotel][] = [
  ['Name', 'name'],
  ['Straße', 'street'],
  ['PLZ', 'postalCode'],
  ['Ort', 'city'],
  ['Bundesland', 'state'],
  ['Land', 'country'],
  ['Website', 'website'],
]

function HotelTable({ hotels, onEdit }: { hotels: Hotel[]; onEdit: (h: Hotel) => void }) {
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
  const isMobile = useIsMobile()
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

  // Desktop SPA: show detail inline (modal must still render for sidebar + button)
  if (!isMobile && selectedHotelId) {
    return (
      <>
        <HotelDetailContent hotelId={selectedHotelId} />
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
              setSelectedHotelId(saved.id)
              localStorage.setItem('pt_hotels_last_id', saved.id)
              history.pushState(null, '', `/hotels/${saved.id}`)
              window.dispatchEvent(new CustomEvent('hotel-list-refresh'))
              setTimeout(() => window.dispatchEvent(new CustomEvent('select-hotel', { detail: { id: saved.id } })), 50)
            }}
            onDeleted={id => {
              setHotels(prev => prev.filter(h => h.id !== id))
              setSelectedHotelId(null)
              window.dispatchEvent(new CustomEvent('hotel-list-refresh'))
            }}
          />
        )}
      </>
    )
  }

  return (
    <div className="module-content">
      {isMobile && isEditor && (
        <div className="flex items-center gap-2">
          <button onClick={openNewHotelModal} className="btn btn-primary"><Plus className="w-4 h-4" /> Neu</button>
        </div>
      )}

      <input
        type="text"
        placeholder="Hotels durchsuchen..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">{hotels.length === 0 ? 'Keine Hotels vorhanden' : 'Keine Treffer'}</p>
          {hotels.length === 0 && <p className="text-sm">Klicken Sie auf „Neues Hotel" um zu beginnen.</p>}
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
          history.pushState(null, '', `/hotels/${h.id}`)
          window.dispatchEvent(new CustomEvent('select-hotel', { detail: { id: h.id } }))
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
