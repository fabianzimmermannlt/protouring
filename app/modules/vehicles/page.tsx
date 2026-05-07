'use client'

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { getVehicles, isEditorRole, getEffectiveRole, type Vehicle } from '@/lib/api-client'
import VehicleFormModal from './VehicleFormModal'
import { useSortable } from '@/app/hooks/useSortable'
import { useIsMobile } from '@/app/hooks/useIsMobile'
import { VehicleDetailContent } from '@/app/modules/vehicles/VehicleDetail'
import { useT } from '@/app/lib/i18n/LanguageContext'

export default function VehiclesPage() {
  const t = useT()
  const isMobile = useIsMobile()
  const isEditor = isEditorRole(getEffectiveRole())
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const m = window.location.pathname.match(/\/vehicles\/([^/]+)/)
    if (m?.[1]) return m[1]
    return localStorage.getItem('pt_vehicles_last_id') ?? null
  })

  useEffect(() => {
    getVehicles().then(setVehicles).catch(() => {})
  }, [])

  // SPA: select-vehicle event
  useEffect(() => {
    const selectHandler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      if (id) setSelectedVehicleId(id)
    }
    const deleteHandler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      if (id) {
        setVehicles(prev => prev.filter(v => v.id !== id))
        setSelectedVehicleId(null)
      }
    }
    window.addEventListener('select-vehicle', selectHandler)
    window.addEventListener('vehicle-deleted', deleteHandler)
    return () => {
      window.removeEventListener('select-vehicle', selectHandler)
      window.removeEventListener('vehicle-deleted', deleteHandler)
    }
  }, [])

  const openNewVehicleModal = () => { setEditingVehicle(null); setIsModalOpen(true) }
  const openEditVehicleModal = (vehicle: Vehicle) => { setEditingVehicle(vehicle); setIsModalOpen(true) }

  // Sidebar events
  useEffect(() => {
    const onCreate = () => openNewVehicleModal()
    const onSelect = (e: Event) => { const v = (e as CustomEvent<Vehicle>).detail; if (v) openEditVehicleModal(v) }
    window.addEventListener('vehicle-sidebar-create', onCreate)
    window.addEventListener('vehicle-sidebar-select', onSelect)
    return () => {
      window.removeEventListener('vehicle-sidebar-create', onCreate)
      window.removeEventListener('vehicle-sidebar-select', onSelect)
    }
  }, [])


  const filteredVehicles = vehicles.filter(v =>
    `${v.designation} ${v.vehicleType} ${v.driver} ${v.licensePlate}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Desktop SPA: show detail inline, never show list (wait for auto-select)
  if (!isMobile) {
    if (!selectedVehicleId) return null
    return <VehicleDetailContent vehicleId={selectedVehicleId} onNotFound={() => {
      localStorage.removeItem('pt_vehicles_last_id')
      setSelectedVehicleId(null)
    }} />
  }

  return (
    <div className="module-content">
      {/* Mobile: Neu-Button */}
      {isMobile && isEditor && (
        <div className="flex items-center gap-2">
          <button onClick={openNewVehicleModal} className="btn btn-primary"><Plus className="w-4 h-4" /> {t('general.new')}</button>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder={t('vehicles.searchPlaceholder')}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />

      {/* Vehicles List / Mobile Cards */}
      {filteredVehicles.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">{vehicles.length === 0 ? t('vehicles.noVehicles') : t('general.noResults')}</p>
          {vehicles.length === 0 && <p className="text-sm">{t('vehicles.addHint')}</p>}
        </div>
      ) : isMobile ? (
        <div className="flex flex-col gap-2">
          {[...filteredVehicles].sort((a, b) => a.designation.localeCompare(b.designation, 'de')).map(item => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 cursor-pointer"
              onClick={() => window.location.href = `/vehicles/${item.id}`}>
              <p className="text-sm font-semibold text-gray-900">{item.designation}</p>
              {item.vehicleType && <p className="text-xs text-gray-500 mt-0.5">{item.vehicleType}</p>}
              {item.licensePlate && <p className="text-xs text-gray-400 mt-0.5">{item.licensePlate}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="data-table-wrapper">
          <VehicleTable vehicles={filteredVehicles} onEdit={v => {
            history.pushState(null, '', `/vehicles/${v.id}`)
            window.dispatchEvent(new CustomEvent('select-vehicle', { detail: { id: v.id } }))
          }} />
        </div>
      )}

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

function VehicleTable({ vehicles, onEdit }: { vehicles: Vehicle[]; onEdit: (v: Vehicle) => void }) {
  const t = useT()
  const VEHICLE_COLS: [string, keyof Vehicle][] = [
    [t('table.designation'), 'designation'],
    [t('table.vehicleType'), 'vehicleType'],
    [t('table.driver'), 'driver'],
    [t('table.licensePlate'), 'licensePlate'],
    [t('table.dimensions'), 'dimensions'],
    [t('table.powerConnection'), 'powerConnection'],
    [t('table.seats'), 'seats'],
    [t('table.sleepingPlaces'), 'sleepingPlaces'],
  ]
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
          <tr key={vehicle.id} className="clickable" onClick={() => onEdit(vehicle)}>
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
