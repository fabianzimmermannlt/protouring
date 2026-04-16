'use client'

import { useState, useEffect } from 'react'
import { Plus, Download, Upload } from 'lucide-react'
import { getVehicles, createVehicle, isEditorRole, getEffectiveRole, type Vehicle } from '@/lib/api-client'
import VehicleFormModal from './VehicleFormModal'
import { useSortable } from '@/app/hooks/useSortable'

const VEHICLE_COLS: [string, keyof Vehicle][] = [
  ['Bezeichnung', 'designation'],
  ['Fahrzeugart', 'vehicleType'],
  ['Driver', 'driver'],
  ['Kennzeichen', 'licensePlate'],
  ['Maße', 'dimensions'],
  ['Stromanschluss', 'powerConnection'],
  ['Sitzplätze', 'seats'],
  ['Schlafplätze', 'sleepingPlaces'],
]

export default function VehiclesPage() {
  const isEditor = isEditorRole(getEffectiveRole())
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    getVehicles().then(setVehicles).catch(() => {})
  }, [])

  const openNewVehicleModal = () => { setEditingVehicle(null); setIsModalOpen(true) }
  const openEditVehicleModal = (vehicle: Vehicle) => { setEditingVehicle(vehicle); setIsModalOpen(true) }

  // CSV Export
  const exportToCSV = () => {
    if (vehicles.length === 0) {
      alert('Keine Fahrzeuge zum Exportieren vorhanden.')
      return
    }

    const headers = [
      'Bezeichnung', 'Fahrzeugart', 'Driver', 'Kennzeichen', 'Maße', 'Stromanschluss',
      'Anhänger', 'Anhängermaße', 'Anhänger-Kennzeichen', 'Sitzplätze', 'Schlafplätze', 'Bemerkung'
    ]

    const csvContent = [
      headers.join(';'),
      ...vehicles.map(vehicle => [
        `"${vehicle.designation}"`,
        `"${vehicle.vehicleType}"`,
        `"${vehicle.driver}"`,
        `"${vehicle.licensePlate}"`,
        `"${vehicle.dimensions}"`,
        `"${vehicle.powerConnection}"`,
        `"${vehicle.hasTrailer ? 'Ja' : 'Nein'}"`,
        `"${vehicle.trailerDimensions}"`,
        `"${vehicle.trailerLicensePlate}"`,
        `"${vehicle.seats}"`,
        `"${vehicle.sleepingPlaces}"`,
        `"${vehicle.notes}"`
      ].join(';'))
    ].join('\n')

    // Add BOM for proper UTF-8 encoding in Excel
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `vehicles_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // CSV Import
  const importFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n')
        const dataLines = lines.slice(1).filter(line => line.trim())
        let count = 0
        for (const line of dataLines) {
          const values = line.split(';').map(v => v.replace(/^"|"$/g, ''))
          if (!values[0]) continue
          try {
            const created = await createVehicle({
              designation: values[0] || '', vehicleType: values[1] || '',
              driver: values[2] || '', licensePlate: values[3] || '',
              dimensions: values[4] || '', powerConnection: values[5] || '',
              hasTrailer: values[6] === 'Ja', trailerDimensions: values[7] || '',
              trailerLicensePlate: values[8] || '', seats: values[9] || '',
              sleepingPlaces: values[10] || '', notes: values[11] || ''
            })
            setVehicles(prev => [...prev, created]); count++
          } catch {}
        }
        alert(`${count} Fahrzeuge erfolgreich importiert.`)
      } catch (error) {
        alert('Fehler beim Importieren der CSV-Datei.')
      }
    }
    
    reader.readAsText(file)
    // Reset file input
    event.target.value = ''
  }

  const filteredVehicles = vehicles.filter(v =>
    `${v.designation} ${v.vehicleType} ${v.driver} ${v.licensePlate}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="module-content">
      {/* Header — nur 1-3 */}
      {isEditor && (
        <div className="flex justify-between items-center">
          <button onClick={openNewVehicleModal} className="btn btn-primary">
            <Plus className="h-4 w-4" />
            Neues Fahrzeug
          </button>
          <div className="flex gap-3">
            <button onClick={exportToCSV} className="btn btn-success">
              <Download className="h-4 w-4" />
              CSV-Export
            </button>
            <label className="btn btn-primary cursor-pointer">
              <Upload className="h-4 w-4" />
              CSV-Import
              <input type="file" accept=".csv" onChange={importFromCSV} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder="Fahrzeuge durchsuchen..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />

      {/* Vehicles List */}
      <div className="data-table-wrapper">
        {filteredVehicles.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">{vehicles.length === 0 ? 'Keine Fahrzeuge vorhanden' : 'Keine Treffer'}</p>
            {vehicles.length === 0 && <p className="text-sm">Klicken Sie auf &quot;Neues Fahrzeug&quot; um zu beginnen.</p>}
          </div>
        ) : (
          <VehicleTable vehicles={filteredVehicles} canEdit={isEditor} onEdit={openEditVehicleModal} />
        )}
      </div>

      {isModalOpen && (
        <VehicleFormModal
          vehicle={editingVehicle}
          onClose={() => setIsModalOpen(false)}
          onSaved={saved => {
            setVehicles(prev => {
              const idx = prev.findIndex(v => v.id === saved.id)
              if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
              return [...prev, saved]
            })
            setIsModalOpen(false)
          }}
          onDeleted={id => {
            setVehicles(prev => prev.filter(v => v.id !== id))
          }}
        />
      )}
    </div>
  )
}

function VehicleTable({ vehicles, canEdit = false, onEdit }: { vehicles: Vehicle[]; canEdit?: boolean; onEdit: (v: Vehicle) => void }) {
  const { sortKey, sortDir, sorted, toggleSort } = useSortable(
    vehicles as unknown as Record<string, unknown>[],
    'designation'
  )
  return (
    <table className="data-table">
      <thead>
        <tr>
          {VEHICLE_COLS.map(([label, key]) => (
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
        {(sorted as unknown as Vehicle[]).map((vehicle) => (
          <tr key={vehicle.id} className={canEdit ? 'clickable' : ''} onClick={canEdit ? () => onEdit(vehicle) : undefined}>
            <td className="font-medium">{vehicle.designation}</td>
            <td>{vehicle.vehicleType}</td>
            <td>{vehicle.driver}</td>
            <td>{vehicle.licensePlate}</td>
            <td>{vehicle.dimensions}</td>
            <td>{vehicle.powerConnection}</td>
            <td>{vehicle.seats}</td>
            <td>{vehicle.sleepingPlaces}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
