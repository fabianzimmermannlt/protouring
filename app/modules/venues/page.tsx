'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, Upload, Loader2, AlertCircle, X, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useT } from '@/app/lib/i18n/LanguageContext'
import {
  getVenues,
  createVenue,
  deleteVenue,
  isAuthenticated,
  isEditorRole,
  getEffectiveRole,
  type Venue,
} from '@/lib/api-client'
import { useSortable } from '@/app/hooks/useSortable'
import ColumnToggle from '@/app/components/shared/ColumnToggle'
import { useColumnVisibility } from '@/app/components/shared/useColumnVisibility'
import { useIsMobile } from '@/app/hooks/useIsMobile'
import { parseCSV, col } from '@/lib/csvParser'
import { VenueDetailContent } from '@/app/modules/venues/VenueDetail'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'
import { QuickCreateVenueModal } from '@/app/components/shared/modals/QuickCreateVenueModal'
import { useColumnOrder } from '@/app/lib/hooks/useColumnOrder'

const EMPTY_FORM = {
  name: '', street: '', postalCode: '', city: '', state: '', country: '',
  website: '', arrival: '', arrivalStreet: '', arrivalPostalCode: '', arrivalCity: '',
  capacity: '', capacitySeated: '', stageDimensions: '', clearanceHeight: '',
  merchandiseFee: '', merchandiseStand: '', wardrobe: '', showers: '', wifi: '',
  parking: '', nightlinerParking: '', loadingPath: '', notes: '', latitude: '', longitude: '',
}

export default function VenuesPage() {
  const t = useT()
  const isMobile = useIsMobile()
  const { layout } = useLayout()
  const isL2 = layout === 'L2'
  const isEditor = isEditorRole(getEffectiveRole())
  const isAdmin = getEffectiveRole() === 'admin'
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // SPA: selected venue via event (L3 sidebar) or URL
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const m = window.location.pathname.match(/\/venues\/([^/]+)/)
    return m?.[1] ?? null
  })

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      if (id) setSelectedVenueId(id)
    }
    const updateHandler = (e: Event) => {
      const updated = (e as CustomEvent<Venue>).detail
      if (updated) setVenues(prev => prev.map(v => v.id === updated.id ? updated : v))
    }
    const showListHandler = () => setSelectedVenueId(null)
    window.addEventListener('select-venue', handler)
    window.addEventListener('venue-updated', updateHandler)
    window.addEventListener('venue-show-list', showListHandler)
    return () => {
      window.removeEventListener('select-venue', handler)
      window.removeEventListener('venue-updated', updateHandler)
      window.removeEventListener('venue-show-list', showListHandler)
    }
  }, [])

  const loadVenues = useCallback(async () => {
    if (!isAuthenticated()) {
      setAuthError(true)
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const data = await getVenues()
      setVenues(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Venues')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadVenues() }, [loadVenues])

  // CSV Export
  const exportToCSV = () => {
    const headers = [
      t('general.name'),
      t('table.street'),
      t('table.postalCode'),
      t('table.city'),
      t('table.state'),
      t('table.country'),
      t('table.capacity'),
    ]
    const csvContent = [
      headers.join(';'),
      ...venues.map(v => [v.name, v.street, v.postalCode, v.city, v.state, v.country, v.capacity]
        .map(val => `"${(val || '').replace(/"/g, '""')}"`)
        .join(';'))
    ].join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `venues_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // CSV Import
  const importFromCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      const rows = parseCSV(text).slice(1)
      let successCount = 0
      for (const row of rows) {
        if (!col(row, 0)) continue
        try {
          const newVenue = await createVenue({
            ...EMPTY_FORM,
            name: col(row, 0), street: col(row, 1), postalCode: col(row, 2),
            city: col(row, 3), state: col(row, 4), country: col(row, 5), capacity: col(row, 6),
          })
          setVenues(prev => [...prev, newVenue])
          successCount++
        } catch { /* skip invalid rows */ }
      }
      if (successCount > 0) alert(t('venues.importSuccess').replace('{count}', String(successCount)))
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  if (authError) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('general.notLoggedIn')}</h3>
          <p className="text-gray-500 text-sm mb-4">{t('venues.loginRequired')}</p>
          <a href="/login" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            {t('general.toLogin')}
          </a>
        </div>
      </div>
    )
  }

  if (!isMobile && !isL2) {
    if (!selectedVenueId) return null
    return <VenueDetailContent venueId={selectedVenueId} />
  }

  if (!isMobile && isL2 && selectedVenueId) {
    return <VenueDetailContent venueId={selectedVenueId}
      onBack={() => { setSelectedVenueId(null); loadVenues() }}
      headerRight={isAdmin ? (
        <button
          onClick={async () => {
            const venue = venues.find(v => v.id === selectedVenueId)
            const label = venue?.name ?? selectedVenueId
            if (!confirm(`„${label}" wirklich löschen?`)) return
            await deleteVenue(selectedVenueId!)
            setVenues(prev => prev.filter(v => v.id !== selectedVenueId))
            setSelectedVenueId(null)
          }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
          title="Venue löschen"
        >
          <Trash2 size={14} />
        </button>
      ) : undefined}
    />
  }

  return (
    <div className="module-content">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isL2 ? (
        <>
          <h1 className="text-xl font-semibold mb-1" style={{color:'#e0e0e0'}}>Venues</h1>
          <div className="flex items-center gap-2 mb-2">
            {isEditor && <button onClick={() => setShowQuickCreate(true)} className="btn btn-primary flex-shrink-0" style={{borderRadius:'0'}}><Plus className="w-4 h-4" /> Neu</button>}
            <input type="text" placeholder={t('venues.searchPlaceholder')} value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} className="search-input l2-search" style={{marginBottom:0, borderRadius:'0'}} />
            {isAdmin && <>
              <button onClick={exportToCSV} className="btn btn-ghost flex-shrink-0" style={{borderRadius:'0'}} title="CSV Export"><Download className="w-4 h-4" /></button>
              <label className="btn btn-ghost flex-shrink-0 cursor-pointer" style={{borderRadius:'0'}} title="CSV Import"><Upload className="w-4 h-4" /><input type="file" accept=".csv" onChange={importFromCSV} className="hidden" /></label>
            </>}
          </div>
        </>
      ) : (
        <>
          {isEditor && (
            <div className="flex justify-end gap-3 mb-2">
              <button onClick={exportToCSV} className="btn btn-ghost"><Download className="w-4 h-4" />CSV</button>
              <label className="btn btn-ghost cursor-pointer"><Upload className="w-4 h-4" />CSV<input type="file" accept=".csv" onChange={importFromCSV} className="hidden" /></label>
            </div>
          )}
          <input type="text" placeholder={t('venues.searchPlaceholder')} value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        </>
      )}
      {showQuickCreate && <QuickCreateVenueModal onClose={() => setShowQuickCreate(false)} onCreated={v => { setVenues(prev => [...prev, v]); setShowQuickCreate(false) }} />}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" />
          <span className="text-gray-500">{t('venues.loading')}</span>
        </div>
      ) : (() => {
        const filtered = venues.filter(v =>
          `${v.name} ${v.city} ${v.state} ${v.country} ${v.capacity}`
            .toLowerCase().includes(searchTerm.toLowerCase())
        )
        if (filtered.length === 0) return (
          <div className="text-center py-12 text-gray-500">
            <div className="text-lg mb-2">
              {venues.length === 0 ? t('venues.noVenues') : t('general.noResults')}
            </div>
            {venues.length === 0 && (
              <div className="text-sm">{t('venues.addHint')}</div>
            )}
          </div>
        )
        return isMobile ? (
          <div className="flex flex-col gap-2">
            {[...filtered].sort((a, b) => a.name.localeCompare(b.name, 'de')).map(item => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-gray-200 px-4 py-3 cursor-pointer"
                onClick={() => window.location.href = `/venues/${item.id}`}
              >
                <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.city}</p>
                {item.capacity && parseInt(item.capacity) > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">{t('venues.capacity')}: {item.capacity}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="data-table-wrapper">
            <VenueTable venues={filtered} isAdmin={isAdmin} onDetail={id => {
              if (isL2) setSelectedVenueId(id)
              else window.location.href = `/venues/${id}`
            }} onDelete={async (id) => {
              const v = venues.find(x => x.id === id)
              if (!confirm(`„${v?.name ?? id}" löschen?`)) return
              await deleteVenue(id)
              setVenues(prev => prev.filter(x => x.id !== id))
            }} />
          </div>
        )
      })()}
    </div>
  )
}

const VENUE_COLUMNS = [
  { id: 'name',     label: 'Name',     defaultVisible: true, alwaysVisible: true },
  { id: 'street',   label: 'Straße',   defaultVisible: true },
  { id: 'zip',      label: 'PLZ',      defaultVisible: false },
  { id: 'city',     label: 'Stadt',    defaultVisible: true },
  { id: 'state',    label: 'Bundesl.', defaultVisible: false },
  { id: 'country',  label: 'Land',     defaultVisible: false },
  { id: 'capacity', label: 'Kapazität',defaultVisible: true },
]

function VenueTable({ venues, onDetail, onDelete, isAdmin }: {
  venues: Venue[]
  onDetail: (id: string) => void
  onDelete: (id: string) => void
  isAdmin: boolean
}) {
  const { isVisible, toggle, columns } = useColumnVisibility('venue-list', VENUE_COLUMNS)
  const REORDERABLE_COLS = ['name', 'street', 'zip', 'city', 'state', 'country', 'capacity']
  const { order: colOrder, onDragStart: colDragStart, onDrop: colDrop } = useColumnOrder('venue-list', REORDERABLE_COLS)
  const [dragOverCol, setDragOverCol] = useState<number | null>(null)
  const { sortKey, sortDir, sorted, toggleSort } = useSortable(
    venues as unknown as Record<string, unknown>[],
    'name'
  )
  return (
    <table className="data-table">
      <thead>
        <tr>
          {(() => {
            const COL_META: Record<string, { label: string; sortKey: string }> = {
              name:     { label: 'Name',       sortKey: 'name'       },
              street:   { label: 'Straße',     sortKey: 'street'     },
              zip:      { label: 'PLZ',        sortKey: 'postalCode' },
              city:     { label: 'Stadt',      sortKey: 'city'       },
              state:    { label: 'Bundesland', sortKey: 'state'      },
              country:  { label: 'Land',       sortKey: 'country'    },
              capacity: { label: 'Kapazität',  sortKey: 'capacity'   },
            }
            return colOrder.filter(id => isVisible(id)).map((colId, i) => {
              const m = COL_META[colId]
              if (!m) return null
              const isOver = dragOverCol === i
              return (
                <th
                  key={colId}
                  draggable
                  onDragStart={() => colDragStart(i)}
                  onDragOver={e => { e.preventDefault(); setDragOverCol(i) }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={() => { colDrop(i); setDragOverCol(null) }}
                  onDragEnd={() => setDragOverCol(null)}
                  className="sortable"
                  style={{ cursor: 'grab', borderLeft: isOver ? '2px solid #60a5fa' : undefined, userSelect: 'none' }}
                  onClick={() => toggleSort(m.sortKey)}
                >
                  {m.label}
                  <span className={`sort-indicator${sortKey === m.sortKey ? ' active' : ''}`}>
                    {sortKey === m.sortKey ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                  </span>
                </th>
              )
            })
          })()}
          <th style={{ width: 32, textAlign: 'right' }}>
            <ColumnToggle columns={columns} isVisible={isVisible} toggle={toggle} />
          </th>
        </tr>
      </thead>
      <tbody>
        {(sorted as unknown as Venue[]).map((venue) => (
          <tr key={venue.id} className="clickable" onClick={() => onDetail(venue.id)}>
            {colOrder.filter(id => isVisible(id)).map(colId => {
              switch (colId) {
                case 'name':     return <td key="name" className="font-medium">{venue.name}</td>
                case 'street':   return <td key="street">{venue.street}</td>
                case 'zip':      return <td key="zip">{venue.postalCode}</td>
                case 'city':     return <td key="city">{venue.city}</td>
                case 'state':    return <td key="state">{venue.state}</td>
                case 'country':  return <td key="country">{venue.country}</td>
                case 'capacity': return <td key="capacity">{venue.capacity}</td>
                default: return null
              }
            })}
            <td style={{ textAlign: 'right', padding: '0 8px' }} onClick={e => e.stopPropagation()}>
              {isAdmin && (
                <button
                  onClick={() => onDelete(venue.id)}
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
