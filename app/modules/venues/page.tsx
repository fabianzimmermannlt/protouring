'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, Upload, Loader2, AlertCircle, X } from 'lucide-react'
import {
  getVenues,
  createVenue,
  isAuthenticated,
  isEditorRole,
  getEffectiveRole,
  type Venue,
} from '@/lib/api-client'
import { useSortable } from '@/app/hooks/useSortable'
import { useIsMobile } from '@/app/hooks/useIsMobile'
import { parseCSV, col } from '@/lib/csvParser'

const VENUE_COLS: [string, keyof Venue][] = [
  ['Name', 'name'],
  ['Straße', 'street'],
  ['PLZ', 'postalCode'],
  ['Ort', 'city'],
  ['Bundesland', 'state'],
  ['Land', 'country'],
  ['Kapazität', 'capacity'],
]

const EMPTY_FORM = {
  name: '', street: '', postalCode: '', city: '', state: '', country: '',
  website: '', arrival: '', arrivalStreet: '', arrivalPostalCode: '', arrivalCity: '',
  capacity: '', capacitySeated: '', stageDimensions: '', clearanceHeight: '',
  merchandiseFee: '', merchandiseStand: '', wardrobe: '', showers: '', wifi: '',
  parking: '', nightlinerParking: '', loadingPath: '', notes: '', latitude: '', longitude: '',
}

export default function VenuesPage() {
  const isMobile = useIsMobile()
  const isEditor = isEditorRole(getEffectiveRole())
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

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
    const headers = ['Name', 'Straße', 'PLZ', 'Ort', 'Bundesland', 'Land', 'Kapazität']
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
      if (successCount > 0) alert(`${successCount} Venue(s) importiert.`)
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  if (authError) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nicht eingeloggt</h3>
          <p className="text-gray-500 text-sm mb-4">Bitte erst einloggen um Venues zu verwalten.</p>
          <a href="/login" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            Zum Login
          </a>
        </div>
      </div>
    )
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

      {/* CSV Buttons */}
      {isEditor && (
        <div className="flex justify-end gap-3 mb-2">
          <button onClick={exportToCSV} className="btn btn-ghost">
            <Download className="w-4 h-4" />
            CSV
          </button>
          <label className="btn btn-ghost cursor-pointer">
            <Upload className="w-4 h-4" />
            CSV
            <input type="file" accept=".csv" onChange={importFromCSV} className="hidden" />
          </label>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder="Venues durchsuchen..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" />
          <span className="text-gray-500">Venues werden geladen...</span>
        </div>
      ) : (() => {
        const filtered = venues.filter(v =>
          `${v.name} ${v.city} ${v.state} ${v.country} ${v.capacity}`
            .toLowerCase().includes(searchTerm.toLowerCase())
        )
        if (filtered.length === 0) return (
          <div className="text-center py-12 text-gray-500">
            <div className="text-lg mb-2">
              {venues.length === 0 ? 'Keine Venues vorhanden' : 'Keine Treffer'}
            </div>
            {venues.length === 0 && (
              <div className="text-sm">Neue Venue über das + in der Seitenleiste anlegen</div>
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
                  <p className="text-xs text-gray-400 mt-0.5">Kapazität: {item.capacity}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="data-table-wrapper">
            <VenueTable venues={filtered} onDetail={id => window.location.href = `/venues/${id}`} />
          </div>
        )
      })()}
    </div>
  )
}

function VenueTable({ venues, onDetail }: {
  venues: Venue[]
  onDetail: (id: string) => void
}) {
  const { sortKey, sortDir, sorted, toggleSort } = useSortable(
    venues as unknown as Record<string, unknown>[],
    'name'
  )
  return (
    <table className="data-table">
      <thead>
        <tr>
          {VENUE_COLS.map(([label, key]) => (
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
        {(sorted as unknown as Venue[]).map((venue) => (
          <tr key={venue.id} className="clickable" onClick={() => onDetail(venue.id)}>
            <td className="font-medium">{venue.name}</td>
            <td>{venue.street}</td>
            <td>{venue.postalCode}</td>
            <td>{venue.city}</td>
            <td>{venue.state}</td>
            <td>{venue.country}</td>
            <td>{venue.capacity}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
