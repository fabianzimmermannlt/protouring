'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Download, Upload, Save, X, Loader2, AlertCircle } from 'lucide-react'
import {
  getVenues,
  createVenue,
  updateVenue,
  deleteVenue,
  isAuthenticated,
  isEditorRole,
  getEffectiveRole,
  type Venue,
  type VenueFormData,
} from '@/lib/api-client'
import { useSortable } from '@/app/hooks/useSortable'
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

const EMPTY_FORM: VenueFormData = {
  name: '',
  street: '',
  postalCode: '',
  city: '',
  state: '',
  country: '',
  website: '',
  arrival: '',
  arrivalStreet: '',
  arrivalPostalCode: '',
  arrivalCity: '',
  capacity: '',
  capacitySeated: '',
  stageDimensions: '',
  clearanceHeight: '',
  merchandiseFee: '',
  merchandiseStand: '',
  wardrobe: '',
  showers: '',
  wifi: '',
  parking: '',
  nightlinerParking: '',
  loadingPath: '',
  notes: '',
}

export default function VenuesPage() {
  const isEditor = isEditorRole(getEffectiveRole())
  const [venues, setVenues] = useState<Venue[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null)
  const [formData, setFormData] = useState<VenueFormData>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Load venues from API
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
      const message = err instanceof Error ? err.message : 'Fehler beim Laden der Venues'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadVenues()
  }, [loadVenues])

  const openNewModal = () => {
    setEditingVenue(null)
    setFormData(EMPTY_FORM)
    setIsModalOpen(true)
  }

  const openEditModal = (venue: Venue) => {
    setEditingVenue(venue)
    setFormData({
      name: venue.name,
      street: venue.street,
      postalCode: venue.postalCode,
      city: venue.city,
      state: venue.state,
      country: venue.country,
      website: venue.website,
      arrival: venue.arrival,
      arrivalStreet: venue.arrivalStreet,
      arrivalPostalCode: venue.arrivalPostalCode,
      arrivalCity: venue.arrivalCity,
      capacity: venue.capacity,
      capacitySeated: venue.capacitySeated,
      stageDimensions: venue.stageDimensions,
      clearanceHeight: venue.clearanceHeight,
      merchandiseFee: venue.merchandiseFee,
      merchandiseStand: venue.merchandiseStand,
      wardrobe: venue.wardrobe,
      showers: venue.showers,
      wifi: venue.wifi,
      parking: venue.parking,
      nightlinerParking: venue.nightlinerParking,
      loadingPath: venue.loadingPath,
      notes: venue.notes,
    })
    setIsModalOpen(true)
  }

  const handleInputChange = (field: keyof VenueFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!formData.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (editingVenue) {
        const updated = await updateVenue(editingVenue.id, formData)
        setVenues(prev => prev.map(v => v.id === updated.id ? updated : v))
      } else {
        const created = await createVenue(formData)
        setVenues(prev => [...prev, created])
      }
      setIsModalOpen(false)
      setEditingVenue(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Speichern fehlgeschlagen'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Venue "${name}" wirklich löschen?`)) return
    try {
      await deleteVenue(id)
      setVenues(prev => prev.filter(v => v.id !== id))
      if (isModalOpen) setIsModalOpen(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Löschen fehlgeschlagen'
      setError(message)
    }
  }

  // CSV Export
  const exportToCSV = () => {
    const headers = ['Name', 'Straße', 'PLZ', 'Ort', 'Bundesland', 'Land', 'Kapazität']
    const csvContent = [
      headers.join(';'),
      ...venues.map(v => [v.name, v.street, v.postalCode, v.city, v.state, v.country, v.capacity]
        .map(val => `"${(val || '').replace(/"/g, '""')}"`)
        .join(';'))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `venues_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // CSV Import (creates venues via API)
  const importFromCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      const rows = parseCSV(text).slice(1) // Header überspringen
      let successCount = 0

      for (const row of rows) {
        if (!col(row, 0)) continue
        try {
          const newVenue = await createVenue({
            ...EMPTY_FORM,
            name: col(row, 0),
            street: col(row, 1),
            postalCode: col(row, 2),
            city: col(row, 3),
            state: col(row, 4),
            country: col(row, 5),
            capacity: col(row, 6),
          })
          setVenues(prev => [...prev, newVenue])
          successCount++
        } catch {
          // Skip invalid rows silently
        }
      }

      if (successCount > 0) {
        alert(`${successCount} Venue(s) importiert.`)
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  // ============================================
  // RENDER
  // ============================================

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
      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action Buttons — nur 1-3 */}
      {isEditor && (
        <div className="flex justify-between items-center">
          <button onClick={openNewModal} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            Neue Venue
          </button>
          <div className="flex gap-3">
            <button onClick={exportToCSV} className="btn btn-success">
              <Download className="w-4 h-4" />
              CSV-Export
            </button>
            <label className="btn btn-primary cursor-pointer">
              <Upload className="w-4 h-4" />
              CSV-Import
              <input type="file" accept=".csv" onChange={importFromCSV} className="hidden" />
            </label>
          </div>
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

      {/* Venues Table */}
      <div className="data-table-wrapper">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" />
            <span className="text-gray-500">Venues werden geladen...</span>
          </div>
        ) : (() => {
          const filtered = venues.filter(v =>
            `${v.name} ${v.city} ${v.state} ${v.country} ${v.capacity}`.toLowerCase().includes(searchTerm.toLowerCase())
          )
          if (filtered.length === 0) return (
            <div className="text-center py-12 text-gray-500">
              <div className="text-lg mb-2">{venues.length === 0 ? 'Keine Venues vorhanden' : 'Keine Treffer'}</div>
              {venues.length === 0 && <div className="text-sm">Klicke auf &quot;Neue Venue&quot; um die erste Venue anzulegen</div>}
            </div>
          )
          return <VenueTable venues={filtered} canEdit={isEditor} onEdit={openEditModal} />
        })()}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-container max-w-4xl">
            {/* Header */}
            <div className="modal-header">
              <h2 className="modal-title">
                {editingVenue ? 'Spielstätte bearbeiten' : 'Neue Spielstätte anlegen'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <div className="modal-body">
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left */}
                  <div className="space-y-4">
                    <Field label="Name *" value={formData.name} onChange={v => handleInputChange('name', v)} />
                    <Field label="Straße" value={formData.street} onChange={v => handleInputChange('street', v)} />
                    <div className="grid grid-cols-[auto_1fr] gap-2">
                      <Field label="PLZ" value={formData.postalCode} onChange={v => handleInputChange('postalCode', v)} maxLength={10} className="!w-24" />
                      <Field label="Ort" value={formData.city} onChange={v => handleInputChange('city', v)} />
                    </div>
                    <Field label="Bundesland" value={formData.state} onChange={v => handleInputChange('state', v)} />
                    <Field label="Land" value={formData.country} onChange={v => handleInputChange('country', v)} />
                    <Field label="Website" value={formData.website} onChange={v => handleInputChange('website', v)} type="url" placeholder="https://..." />
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Kapazität" value={formData.capacity} onChange={v => handleInputChange('capacity', v)} placeholder="z.B. 5000" />
                      <Field label="Kapazität (bestuhlt)" value={formData.capacitySeated} onChange={v => handleInputChange('capacitySeated', v)} placeholder="z.B. 3000" />
                    </div>
                    <TextareaField label="W-LAN" value={formData.wifi} onChange={v => handleInputChange('wifi', v)} placeholder="SSID / Passwort..." />
                    <TextareaField label="Garderoben" value={formData.wardrobe} onChange={v => handleInputChange('wardrobe', v)} />
                    <Field label="Duschen" value={formData.showers} onChange={v => handleInputChange('showers', v)} placeholder="z.B. 4 im Backstage" />
                  </div>

                  {/* Right */}
                  <div className="space-y-4">
                    <Field label="Anfahrt" value={formData.arrival} onChange={v => handleInputChange('arrival', v)} placeholder="z.B. Auto / Bahn..." />
                    <Field label="Anfahrt – Straße" value={formData.arrivalStreet} onChange={v => handleInputChange('arrivalStreet', v)} />
                    <div className="grid grid-cols-[auto_1fr] gap-2">
                      <Field label="Anfahrt – PLZ" value={formData.arrivalPostalCode} onChange={v => handleInputChange('arrivalPostalCode', v)} maxLength={10} className="!w-24" />
                      <Field label="Anfahrt – Ort" value={formData.arrivalCity} onChange={v => handleInputChange('arrivalCity', v)} />
                    </div>
                    <div className="grid grid-cols-[2fr_1fr] gap-2">
                      <Field label="Bühnenmaße" value={formData.stageDimensions} onChange={v => handleInputChange('stageDimensions', v)} placeholder="z.B. 12x8m" />
                      <Field label="Lichte Höhe" value={formData.clearanceHeight} onChange={v => handleInputChange('clearanceHeight', v)} placeholder="z.B. 6m" />
                    </div>
                    <Field label="Merchandise-Fee" value={formData.merchandiseFee} onChange={v => handleInputChange('merchandiseFee', v)} placeholder="z.B. 15% oder 500€" />
                    <TextareaField label="Merchandise-Stand" value={formData.merchandiseStand} onChange={v => handleInputChange('merchandiseStand', v)} />
                    <TextareaField label="Parkplatz" value={formData.parking} onChange={v => handleInputChange('parking', v)} />
                    <TextareaField label="Nightliner-Stellplatz" value={formData.nightlinerParking} onChange={v => handleInputChange('nightlinerParking', v)} />
                    <TextareaField label="Ladeweg" value={formData.loadingPath} onChange={v => handleInputChange('loadingPath', v)} />
                    <TextareaField label="Bemerkung" value={formData.notes} onChange={v => handleInputChange('notes', v)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer">
              {editingVenue && (
                <button
                  onClick={() => handleDelete(editingVenue.id, editingVenue.name)}
                  className="btn btn-danger"
                >
                  Löschen
                </button>
              )}
              <div className={`flex space-x-3 ${editingVenue ? '' : 'ml-auto'}`}>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-ghost"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.name.trim()}
                  className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Sub-Components
// ============================================

function Field({
  label, value, onChange, type = 'text', placeholder = '', maxLength, className = ''
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  maxLength?: number
  className?: string
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`form-input ${className}`}
      />
    </div>
  )
}

function TextareaField({
  label, value, onChange, placeholder = '', rows = 3
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="form-textarea"
      />
    </div>
  )
}

function VenueTable({ venues, canEdit = false, onEdit }: { venues: Venue[]; canEdit?: boolean; onEdit: (v: Venue) => void }) {
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
          <tr key={venue.id} className={canEdit ? 'clickable' : ''} onClick={canEdit ? () => onEdit(venue) : undefined}>
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
