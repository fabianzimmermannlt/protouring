'use client'

import { useState, useEffect } from 'react'
import { Plus, ArrowLeft, Download, Upload, Trash2 } from 'lucide-react'
import { getVehicles, deleteVehicle, isEditorRole, getEffectiveRole, type Vehicle } from '@/lib/api-client'
import VehicleFormModal from './VehicleFormModal'
import { QuickCreateVehicleModal } from '@/app/components/shared/modals/QuickCreateVehicleModal'
import { useSortable } from '@/app/hooks/useSortable'
import ColumnToggle from '@/app/components/shared/ColumnToggle'
import { useColumnVisibility } from '@/app/components/shared/useColumnVisibility'
import { useIsMobile } from '@/app/hooks/useIsMobile'
import { VehicleDetailContent } from '@/app/modules/vehicles/VehicleDetail'
import { useT } from '@/app/lib/i18n/LanguageContext'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'

export default function VehiclesPage() {
  const t = useT()
  const isMobile = useIsMobile()
  const { layout } = useLayout()
  const isL2 = layout === 'L2'
  const isEditor = isEditorRole(getEffectiveRole())
  const isAdmin = getEffectiveRole() === 'admin'
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const m = window.location.pathname.match(/\/vehicles\/([^/]+)/)
    if (m?.[1]) return m[1]
    return null
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
    const updateHandler = (e: Event) => {
      const updated = (e as CustomEvent<Vehicle>).detail
      if (updated) setVehicles(prev => prev.map(v => v.id === updated.id ? updated : v))
    }
    const showListHandler = () => setSelectedVehicleId(null)
    window.addEventListener('select-vehicle', selectHandler)
    window.addEventListener('vehicle-deleted', deleteHandler)
    window.addEventListener('vehicle-updated', updateHandler)
    window.addEventListener('vehicle-show-list', showListHandler)
    return () => {
      window.removeEventListener('select-vehicle', selectHandler)
      window.removeEventListener('vehicle-deleted', deleteHandler)
      window.removeEventListener('vehicle-updated', updateHandler)
      window.removeEventListener('vehicle-show-list', showListHandler)
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

  if (!isMobile && !isL2) {
    if (!selectedVehicleId) return null
    return <VehicleDetailContent vehicleId={selectedVehicleId} onNotFound={() => {
      localStorage.removeItem('pt_vehicles_last_id')
      setSelectedVehicleId(null)
    }} />
  }

  if (!isMobile && isL2 && selectedVehicleId) {
    return <VehicleDetailContent vehicleId={selectedVehicleId}
      onNotFound={() => { localStorage.removeItem('pt_vehicles_last_id'); setSelectedVehicleId(null) }}
      onBack={() => { setSelectedVehicleId(null); localStorage.removeItem('pt_vehicles_last_id'); getVehicles().then(setVehicles).catch(() => {}) }}
      headerRight={isAdmin ? (
        <button
          onClick={async () => {
            const vehicle = vehicles.find(v => v.id === selectedVehicleId)
            const label = vehicle?.designation ?? selectedVehicleId
            if (!confirm(`„${label}" wirklich löschen?`)) return
            await deleteVehicle(selectedVehicleId!)
            setVehicles(prev => prev.filter(v => v.id !== selectedVehicleId))
            setSelectedVehicleId(null)
          }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
          title="Fahrzeug löschen"
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
          <h1 className="text-xl font-semibold mb-1" style={{color:'#e0e0e0'}}>Fahrzeuge</h1>
          <div className="flex items-center gap-2 mb-2">
            {isEditor && <button onClick={() => setShowQuickCreate(true)} className="btn btn-primary flex-shrink-0" style={{borderRadius:'4px'}}><Plus className="w-4 h-4" /> {t('general.new')}</button>}
            <input type="text" placeholder={t('vehicles.searchPlaceholder')} value={searchTerm}
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
              <button onClick={openNewVehicleModal} className="btn btn-primary"><Plus className="w-4 h-4" /> {t('general.new')}</button>
            </div>
          )}
          <input type="text" placeholder={t('vehicles.searchPlaceholder')} value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        </>
      )}

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
          <VehicleTable vehicles={filteredVehicles} isAdmin={isAdmin} onEdit={v => {
            if (isL2) { localStorage.setItem('pt_vehicles_last_id', v.id); setSelectedVehicleId(v.id) }
            else { history.pushState(null, '', `/vehicles/${v.id}`); window.dispatchEvent(new CustomEvent('select-vehicle', { detail: { id: v.id } })) }
          }} onDelete={async (id) => {
            const v = vehicles.find(x => x.id === id)
            if (!confirm(`„${v?.designation ?? id}" löschen?`)) return
            await deleteVehicle(id)
            setVehicles(prev => prev.filter(x => x.id !== id))
          }} />
        </div>
      )}

      {showQuickCreate && (
        <QuickCreateVehicleModal
          onClose={() => setShowQuickCreate(false)}
          onCreated={v => {
            setVehicles(prev => [...prev, v])
            localStorage.setItem('pt_vehicles_last_id', v.id)
            setSelectedVehicleId(v.id)
            setShowQuickCreate(false)
          }}
        />
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

const VEHICLE_COLUMNS = [
  { id: 'designation',    label: 'Bezeichnung',  defaultVisible: true, alwaysVisible: true },
  { id: 'vehicleType',    label: 'Typ',          defaultVisible: true },
  { id: 'driver',         label: 'Fahrer',        defaultVisible: true },
  { id: 'licensePlate',   label: 'Kennzeichen',   defaultVisible: true },
  { id: 'dimensions',     label: 'Abmessungen',   defaultVisible: false },
  { id: 'powerConnection',label: 'Strom',         defaultVisible: false },
  { id: 'seats',          label: 'Sitze',         defaultVisible: false },
  { id: 'sleepingPlaces', label: 'Schlafplätze',  defaultVisible: false },
]

function VehicleTable({ vehicles, onEdit, onDelete, isAdmin }: { vehicles: Vehicle[]; onEdit: (v: Vehicle) => void; onDelete: (id: string) => void; isAdmin: boolean }) {
  const { isVisible, toggle, columns } = useColumnVisibility('vehicle-list', VEHICLE_COLUMNS)
  const { sortKey, sortDir, sorted, toggleSort } = useSortable(
    vehicles as unknown as Record<string, unknown>[],
    'designation'
  )
  return (
    <table className="data-table">
      <thead>
        <tr>
          {isVisible('designation')     && <th className="sortable" onClick={() => toggleSort('designation')}>Bezeichnung<span className={`sort-indicator${sortKey === 'designation' ? ' active' : ''}`}>{sortKey === 'designation' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('vehicleType')     && <th className="sortable" onClick={() => toggleSort('vehicleType')}>Typ<span className={`sort-indicator${sortKey === 'vehicleType' ? ' active' : ''}`}>{sortKey === 'vehicleType' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('driver')          && <th className="sortable" onClick={() => toggleSort('driver')}>Fahrer<span className={`sort-indicator${sortKey === 'driver' ? ' active' : ''}`}>{sortKey === 'driver' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('licensePlate')    && <th className="sortable" onClick={() => toggleSort('licensePlate')}>Kennzeichen<span className={`sort-indicator${sortKey === 'licensePlate' ? ' active' : ''}`}>{sortKey === 'licensePlate' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('dimensions')      && <th className="sortable" onClick={() => toggleSort('dimensions')}>Abmessungen<span className={`sort-indicator${sortKey === 'dimensions' ? ' active' : ''}`}>{sortKey === 'dimensions' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('powerConnection') && <th className="sortable" onClick={() => toggleSort('powerConnection')}>Strom<span className={`sort-indicator${sortKey === 'powerConnection' ? ' active' : ''}`}>{sortKey === 'powerConnection' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('seats')           && <th className="sortable" onClick={() => toggleSort('seats')}>Sitze<span className={`sort-indicator${sortKey === 'seats' ? ' active' : ''}`}>{sortKey === 'seats' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          {isVisible('sleepingPlaces')  && <th className="sortable" onClick={() => toggleSort('sleepingPlaces')}>Schlafplätze<span className={`sort-indicator${sortKey === 'sleepingPlaces' ? ' active' : ''}`}>{sortKey === 'sleepingPlaces' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>}
          <th style={{ width: 32, textAlign: 'right' }}>
            <ColumnToggle columns={columns} isVisible={isVisible} toggle={toggle} />
          </th>
        </tr>
      </thead>
      <tbody>
        {(sorted as unknown as Vehicle[]).map((vehicle) => (
          <tr key={vehicle.id} className="clickable" onClick={() => onEdit(vehicle)}>
            {isVisible('designation')     && <td className="font-medium">{vehicle.designation}</td>}
            {isVisible('vehicleType')     && <td>{vehicle.vehicleType}</td>}
            {isVisible('driver')          && <td>{vehicle.driver}</td>}
            {isVisible('licensePlate')    && <td>{vehicle.licensePlate}</td>}
            {isVisible('dimensions')      && <td>{vehicle.dimensions}</td>}
            {isVisible('powerConnection') && <td>{vehicle.powerConnection}</td>}
            {isVisible('seats')           && <td>{vehicle.seats}</td>}
            {isVisible('sleepingPlaces')  && <td>{vehicle.sleepingPlaces}</td>}
            <td style={{ textAlign: 'right', padding: '0 8px' }} onClick={e => e.stopPropagation()}>
              {isAdmin && (
                <button
                  onClick={() => onDelete(vehicle.id)}
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
