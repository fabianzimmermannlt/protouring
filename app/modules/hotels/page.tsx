'use client'

import { useState, useEffect } from 'react'
import { Plus, Download, Upload } from 'lucide-react'
import { getHotels, createHotel, isEditorRole, getEffectiveRole, type Hotel } from '@/lib/api-client'
import HotelFormModal from './HotelFormModal'
import { useSortable } from '@/app/hooks/useSortable'
import { useIsMobile } from '@/app/hooks/useIsMobile'
import { parseCSV, col } from '@/lib/csvParser'

const HOTEL_COLS: [string, keyof Hotel][] = [
  ['Name', 'name'],
  ['Straße', 'street'],
  ['PLZ', 'postalCode'],
  ['Ort', 'city'],
  ['Bundesland', 'state'],
  ['Land', 'country'],
  ['Website', 'website'],
]

function HotelTable({ hotels, canEdit = false, onEdit }: { hotels: Hotel[]; canEdit?: boolean; onEdit: (h: Hotel) => void }) {
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
          <tr key={hotel.id} className={canEdit ? 'clickable' : ''} onClick={canEdit ? () => onEdit(hotel) : undefined}>
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

  useEffect(() => {
    getHotels().then(setHotels).catch(() => {})
  }, [])

  const openNewHotelModal = () => { setEditingHotel(null); setIsModalOpen(true) }
  const openEditHotelModal = (hotel: Hotel) => { setEditingHotel(hotel); setIsModalOpen(true) }

  const exportToCSV = () => {
    if (hotels.length === 0) { alert('Keine Hotels zum Exportieren vorhanden.'); return }
    const headers = ['Name', 'Straße', 'PLZ', 'Ort', 'Bundesland', 'Land', 'Website']
    const csvContent = [
      headers.join(';'),
      ...hotels.map(hotel => [
        `"${hotel.name}"`, `"${hotel.street}"`, `"${hotel.postalCode}"`,
        `"${hotel.city}"`, `"${hotel.state}"`, `"${hotel.country}"`, `"${hotel.website}"`
      ].join(';'))
    ].join('\n')
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.setAttribute('href', URL.createObjectURL(blob))
    link.setAttribute('download', `hotels_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const importFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string
        const rows = parseCSV(text).slice(1) // Header überspringen
        let count = 0
        for (const row of rows) {
          if (!col(row, 0)) continue
          try {
            const created = await createHotel({
              name: col(row, 0), street: col(row, 1), postalCode: col(row, 2),
              city: col(row, 3), state: col(row, 4), country: col(row, 5),
              email: '', phone: '', website: col(row, 6), reception: '',
              checkIn: '', checkOut: '', earlyCheckIn: '', lateCheckOut: '',
              breakfast: '', breakfastWeekend: '', additionalInfo: ''
            })
            setHotels(prev => [...prev, created]); count++
          } catch {}
        }
        alert(`${count} Hotels erfolgreich importiert.`)
      } catch {
        alert('Fehler beim Importieren der CSV-Datei.')
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const filtered = hotels.filter(h =>
    `${h.name} ${h.city} ${h.state} ${h.country} ${h.website}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="module-content">
      {isMobile ? (
        isEditor && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <button onClick={openNewHotelModal} className="btn btn-primary"><Plus className="w-4 h-4" /> Neu</button>
            </div>
            <div className="flex gap-1">
              <button onClick={exportToCSV} title="CSV Export" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><Download className="w-5 h-5" /></button>
              <label className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer" title="CSV Import"><Upload className="w-5 h-5" /><input type="file" accept=".csv" onChange={importFromCSV} className="hidden" /></label>
            </div>
          </div>
        )
      ) : (
        isEditor && (
          <div className="flex justify-between items-center">
            <button onClick={openNewHotelModal} className="btn btn-primary">
              <Plus className="h-4 w-4" /> Neues Hotel
            </button>
            <div className="flex gap-3">
              <button onClick={exportToCSV} className="btn btn-ghost">
                <Download className="h-4 w-4" /> CSV
              </button>
              <label className="btn btn-ghost cursor-pointer">
                <Upload className="h-4 w-4" /> CSV
                <input type="file" accept=".csv" onChange={importFromCSV} className="hidden" />
              </label>
            </div>
          </div>
        )
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
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3"
              onClick={isEditor ? () => openEditHotelModal(item) : undefined}>
              <p className="text-sm font-semibold text-gray-900">{item.name}</p>
              {item.city && <p className="text-xs text-gray-500 mt-0.5">{item.city}</p>}
              {item.website && <p className="text-xs text-gray-400 mt-0.5">{item.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="data-table-wrapper">
          <HotelTable hotels={filtered} canEdit={isEditor} onEdit={openEditHotelModal} />
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
