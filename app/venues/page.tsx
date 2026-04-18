'use client'

import { useState, useEffect } from 'react'
import { Plus, Download, Upload, Edit, Trash2, Save, X, MapPin, Phone, Mail, Globe, Users } from 'lucide-react'

interface Venue {
  id: string
  name: string
  type: string
  address: string
  postalCode: string
  city: string
  country: string
  phone: string
  email: string
  website: string
  capacity: string
  seatingCapacity: string
  standingCapacity: string
  technicalEquipment: string
  parking: string
  accessibility: string
  contactPerson: string
  rentalFee: string
  notes: string
}

interface VenueFormData {
  name: string
  type: string
  address: string
  postalCode: string
  city: string
  country: string
  phone: string
  email: string
  website: string
  capacity: string
  seatingCapacity: string
  standingCapacity: string
  technicalEquipment: string
  parking: string
  accessibility: string
  contactPerson: string
  rentalFee: string
  notes: string
}

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [formData, setFormData] = useState<VenueFormData>({
    name: '',
    type: '',
    address: '',
    postalCode: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    website: '',
    capacity: '',
    seatingCapacity: '',
    standingCapacity: '',
    technicalEquipment: '',
    parking: '',
    accessibility: '',
    contactPerson: '',
    rentalFee: '',
    notes: ''
  })

  // Load venues from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('protouring_venues')
    if (saved) {
      const parsed = JSON.parse(saved)
      setVenues(parsed)
    }
  }, [])

  // Save venues to localStorage
  const saveVenues = (updatedVenues: Venue[]) => {
    localStorage.setItem('protouring_venues', JSON.stringify(updatedVenues))
    setVenues(updatedVenues)
  }

  // Open modal for new venue
  const openNewVenueModal = () => {
    setEditingVenue(null)
    setFormData({
      name: '',
      type: '',
      address: '',
      postalCode: '',
      city: '',
      country: '',
      phone: '',
      email: '',
      website: '',
      capacity: '',
      seatingCapacity: '',
      standingCapacity: '',
      technicalEquipment: '',
      parking: '',
      accessibility: '',
      contactPerson: '',
      rentalFee: '',
      notes: ''
    })
    setIsModalOpen(true)
  }

  // Open modal for editing venue
  const openEditVenueModal = (venue: Venue) => {
    setEditingVenue(venue)
    setFormData({
      name: venue.name,
      type: venue.type,
      address: venue.address,
      postalCode: venue.postalCode,
      city: venue.city,
      country: venue.country,
      phone: venue.phone,
      email: venue.email,
      website: venue.website,
      capacity: venue.capacity,
      seatingCapacity: venue.seatingCapacity,
      standingCapacity: venue.standingCapacity,
      technicalEquipment: venue.technicalEquipment,
      parking: venue.parking,
      accessibility: venue.accessibility,
      contactPerson: venue.contactPerson,
      rentalFee: venue.rentalFee,
      notes: venue.notes
    })
    setIsModalOpen(true)
  }

  // Save venue
  const saveVenue = () => {
    if (!formData.name.trim()) {
      alert('Bitte geben Sie einen Namen ein.')
      return
    }

    const venueData: Venue = {
      id: editingVenue ? editingVenue.id : `${Date.now()}_${Math.random()}`,
      ...formData
    }

    let updatedVenues: Venue[]
    if (editingVenue) {
      updatedVenues = venues.map(v => v.id === editingVenue.id ? venueData : v)
    } else {
      updatedVenues = [...venues, venueData]
    }

    saveVenues(updatedVenues)
    setIsModalOpen(false)
    setEditingVenue(null)
  }

  // Delete venue
  const deleteVenue = (venueId: string) => {
    if (confirm('Möchten Sie diese Venue wirklich löschen?')) {
      const updatedVenues = venues.filter(v => v.id !== venueId)
      saveVenues(updatedVenues)
    }
  }

  // CSV Export
  const exportToCSV = () => {
    if (venues.length === 0) {
      alert('Keine VENUES zum Exportieren vorhanden.')
      return
    }

    const headers = [
      'Name', 'Typ', 'Adresse', 'PLZ', 'Stadt', 'Land', 'Telefon', 'E-Mail', 'Website',
      'Kapazität', 'Sitzplätze', 'Stehplätze', 'Technische Ausstattung', 'Parkplätze', 'Barrierefreiheit',
      'Ansprechpartner', 'Miete', 'Notizen'
    ]

    const csvContent = [
      headers.join(','),
      ...venues.map(venue => [
        `"${venue.name}"`,
        `"${venue.type}"`,
        `"${venue.address}"`,
        `"${venue.postalCode}"`,
        `"${venue.city}"`,
        `"${venue.country}"`,
        `"${venue.phone}"`,
        `"${venue.email}"`,
        `"${venue.website}"`,
        `"${venue.capacity}"`,
        `"${venue.seatingCapacity}"`,
        `"${venue.standingCapacity}"`,
        `"${venue.technicalEquipment}"`,
        `"${venue.parking}"`,
        `"${venue.accessibility}"`,
        `"${venue.contactPerson}"`,
        `"${venue.rentalFee}"`,
        `"${venue.notes}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `venues_${new Date().toISOString().split('T')[0]}.csv`)
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
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n')
        
        // Skip header line
        const dataLines = lines.slice(1).filter(line => line.trim())
        
        const importedVenues: Venue[] = dataLines.map((line, index) => {
          const values = line.split(',').map(v => v.replace(/^"|"$/g, ''))
          
          return {
            id: `${Date.now()}_${index}_${Math.random()}`,
            name: values[0] || '',
            type: values[1] || '',
            address: values[2] || '',
            postalCode: values[3] || '',
            city: values[4] || '',
            country: values[5] || '',
            phone: values[6] || '',
            email: values[7] || '',
            website: values[8] || '',
            capacity: values[9] || '',
            seatingCapacity: values[10] || '',
            standingCapacity: values[11] || '',
            technicalEquipment: values[12] || '',
            parking: values[13] || '',
            accessibility: values[14] || '',
            contactPerson: values[15] || '',
            rentalFee: values[16] || '',
            notes: values[17] || ''
          }
        })

        const updatedVenues = [...venues, ...importedVenues]
        saveVenues(updatedVenues)
        alert(`${importedVenues.length} VENUES erfolgreich importiert.`)
      } catch (error) {
        alert('Fehler beim Importieren der CSV-Datei. Bitte überprüfen Sie das Format.')
      }
    }
    
    reader.readAsText(file)
    // Reset file input
    event.target.value = ''
  }

  // Sort venues by name
  const sortedVenues = [...venues].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">VENUES</h1>
        <div className="flex gap-3">
          <button onClick={exportToCSV} className="btn btn-ghost">
            <Download className="h-4 w-4" />
            CSV
          </button>
          <label className="btn btn-ghost cursor-pointer">
            <Upload className="h-4 w-4" />
            CSV
            <input type="file" accept=".csv" onChange={importFromCSV} className="hidden" />
          </label>
          <button
            onClick={openNewVenueModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="h-4 w-4" />
            Neue Venue
          </button>
        </div>
      </div>

      {/* Venues List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {venues.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg mb-2">Keine VENUES vorhanden</p>
            <p className="text-sm">Klicken Sie auf "Neue Venue" um zu beginnen.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Typ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adresse
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kontakt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kapazität
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ausstattung
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedVenues.map((venue) => (
                  <tr
                    key={venue.id}
                    className={`cursor-pointer transition-colors ${
                      hoveredRow === venue.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onMouseEnter={() => setHoveredRow(venue.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => openEditVenueModal(venue)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{venue.name}</div>
                      {venue.contactPerson && (
                        <div className="text-sm text-gray-500">Ansprechpartner: {venue.contactPerson}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{venue.type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          {venue.address}
                        </div>
                        <div>
                          {venue.postalCode} {venue.city}
                        </div>
                        {venue.country && <div>{venue.country}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {venue.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-gray-400" />
                            {venue.phone}
                          </div>
                        )}
                        {venue.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-gray-400" />
                            {venue.email}
                          </div>
                        )}
                        {venue.website && (
                          <div className="flex items-center gap-1">
                            <Globe className="h-3 w-3 text-gray-400" />
                            <a href={venue.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                              Website
                            </a>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-gray-400" />
                          {venue.capacity || '-'}
                        </div>
                        {(venue.seatingCapacity || venue.standingCapacity) && (
                          <div className="text-xs text-gray-500">
                            {venue.seatingCapacity && `Sitz: ${venue.seatingCapacity}`}
                            {venue.seatingCapacity && venue.standingCapacity && ', '}
                            {venue.standingCapacity && `Steh: ${venue.standingCapacity}`}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {venue.technicalEquipment && (
                          <div className="truncate max-w-xs">{venue.technicalEquipment}</div>
                        )}
                        {(venue.parking || venue.accessibility) && (
                          <div className="text-xs text-gray-500">
                            {venue.parking && `Parken: ${venue.parking}`}
                            {venue.parking && venue.accessibility && ', '}
                            {venue.accessibility && `Barrierefrei: ${venue.accessibility}`}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Venue Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingVenue ? 'Venue bearbeiten' : 'Neue Venue'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-300 hover:text-white p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Editor Content */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-6">
                {/* Grunddaten */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Grunddaten</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Name der Venue
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="Name der Venue"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Typ
                        </label>
                        <select
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Typ auswählen</option>
                          <option value="Konzerthalle">Konzerthalle</option>
                          <option value="Theater">Theater</option>
                          <option value="Club">Club</option>
                          <option value="Festhalle">Festhalle</option>
                          <option value="Stadion">Stadion</option>
                          <option value="Open Air">Open Air</option>
                          <option value="Studio">Studio</option>
                          <option value="Sonstiges">Sonstiges</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Ansprechpartner
                        </label>
                        <input
                          type="text"
                          value={formData.contactPerson}
                          onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="Name des Ansprechpartners"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Telefon
                        </label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="+49 123 456789"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          E-Mail
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="venue@beispiel.de"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Website
                        </label>
                        <input
                          type="url"
                          value={formData.website}
                          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="https://www.venue.de"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Adresse */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Adresse</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Straße
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="Straße und Hausnummer"
                      />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          PLZ
                        </label>
                        <input
                          type="text"
                          value={formData.postalCode}
                          onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="12345"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Stadt
                        </label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="Stadt"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Land
                        </label>
                        <input
                          type="text"
                          value={formData.country}
                          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="Land"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kapazität */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Kapazität</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Gesamtkapazität
                      </label>
                      <input
                        type="text"
                        value={formData.capacity}
                        onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="z.B. 500 Personen"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Sitzplätze
                      </label>
                      <input
                        type="text"
                        value={formData.seatingCapacity}
                        onChange={(e) => setFormData({ ...formData, seatingCapacity: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="z.B. 400 Sitzplätze"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Stehplätze
                      </label>
                      <input
                        type="text"
                        value={formData.standingCapacity}
                        onChange={(e) => setFormData({ ...formData, standingCapacity: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="z.B. 100 Stehplätze"
                      />
                    </div>
                  </div>
                </div>

                {/* Ausstattung */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Ausstattung & Service</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Technische Ausstattung
                        </label>
                        <textarea
                          value={formData.technicalEquipment}
                          onChange={(e) => setFormData({ ...formData, technicalEquipment: e.target.value })}
                          rows={3}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 resize-none"
                          placeholder="PA, Licht, Bühne, Backline etc."
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Parkmöglichkeiten
                        </label>
                        <input
                          type="text"
                          value={formData.parking}
                          onChange={(e) => setFormData({ ...formData, parking: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="z.B. 50 Parkplätze, Parkhaus nearby"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Barrierefreiheit
                        </label>
                        <input
                          type="text"
                          value={formData.accessibility}
                          onChange={(e) => setFormData({ ...formData, accessibility: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="z.B. Rollstuhlgerecht, Behinderten-WC"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Miete / Kosten
                        </label>
                        <input
                          type="text"
                          value={formData.rentalFee}
                          onChange={(e) => setFormData({ ...formData, rentalFee: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="z.B. 1500 €/Tag, Pauschale"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Zusätzliche Informationen */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Zusätzliche Informationen</h3>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Notizen
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 resize-none"
                      placeholder="Zusätzliche Notizen, besondere Bedingungen, etc."
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t">
                <div className="flex items-center gap-3">
                  {editingVenue && (
                    <button
                      onClick={() => deleteVenue(editingVenue.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                      Löschen
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={saveVenue}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Save className="h-4 w-4" />
                    Speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
