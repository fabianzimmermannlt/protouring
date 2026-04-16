'use client'

import { useState, useEffect } from 'react'
import { Plus, Download, Upload } from 'lucide-react'
import { getHotels, createHotel, isEditorRole, getEffectiveRole, type Hotel } from '@/lib/api-client'
import HotelFormModal from './HotelFormModal'
import { useSortable } from '@/app/hooks/useSortable'

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
        const dataLines = text.split('\n').slice(1).filter(line => line.trim())
        let count = 0
        for (const line of dataLines) {
          const values = line.split(';').map(v => v.replace(/^"|"$/g, ''))
          if (!values[0]) continue
          try {
            const created = await createHotel({
              name: values[0] || '', street: values[1] || '', postalCode: values[2] || '',
              city: values[3] || '', state: values[4] || '', country: values[5] || '',
              email: '', phone: '', website: values[6] || '', reception: '',
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
      {isEditor && (
        <div className="flex justify-between items-center">
          <button onClick={openNewHotelModal} className="btn btn-primary">
            <Plus className="h-4 w-4" /> Neues Hotel
          </button>
          <div className="flex gap-3">
            <button onClick={exportToCSV} className="btn btn-success">
              <Download className="h-4 w-4" /> CSV-Export
            </button>
            <label className="btn btn-primary cursor-pointer">
              <Upload className="h-4 w-4" /> CSV-Import
              <input type="file" accept=".csv" onChange={importFromCSV} className="hidden" />
            </label>
          </div>
        </div>
      )}

      <input
        type="text"
        placeholder="Hotels durchsuchen..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />

      <div className="data-table-wrapper">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">{hotels.length === 0 ? 'Keine Hotels vorhanden' : 'Keine Treffer'}</p>
            {hotels.length === 0 && <p className="text-sm">Klicken Sie auf „Neues Hotel" um zu beginnen.</p>}
          </div>
        ) : (
          <HotelTable hotels={filtered} canEdit={isEditor} onEdit={openEditHotelModal} />
        )}
      </div>

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
