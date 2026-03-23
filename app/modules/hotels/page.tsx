'use client'

import { useState, useEffect } from 'react'
import { Plus, Download, Upload, Edit, Trash2, Save, X } from 'lucide-react'

interface Hotel {
  id: string
  name: string
  street: string
  postalCode: string
  city: string
  state: string
  country: string
  email: string
  phone: string
  website: string
  reception: string
  checkIn: string
  checkOut: string
  earlyCheckIn: string
  lateCheckOut: string
  breakfast: string
  breakfastWeekend: string
  additionalInfo: string
}

interface HotelFormData {
  name: string
  street: string
  postalCode: string
  city: string
  state: string
  country: string
  email: string
  phone: string
  website: string
  reception: string
  checkIn: string
  checkOut: string
  earlyCheckIn: string
  lateCheckOut: string
  breakfast: string
  breakfastWeekend: string
  additionalInfo: string
}

export default function HotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [formData, setFormData] = useState<HotelFormData>({
    name: '',
    street: '',
    postalCode: '',
    city: '',
    state: '',
    country: '',
    email: '',
    phone: '',
    website: '',
    reception: '',
    checkIn: '',
    checkOut: '',
    earlyCheckIn: '',
    lateCheckOut: '',
    breakfast: '',
    breakfastWeekend: '',
    additionalInfo: ''
  })

  // Load hotels from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('protouring_hotels')
    if (saved) {
      const parsed = JSON.parse(saved)
      setHotels(parsed)
    }
  }, [])

  // Save hotels to localStorage
  const saveHotels = (updatedHotels: Hotel[]) => {
    localStorage.setItem('protouring_hotels', JSON.stringify(updatedHotels))
    setHotels(updatedHotels)
  }

  // Open modal for new hotel
  const openNewHotelModal = () => {
    setEditingHotel(null)
    setFormData({
      name: '',
      street: '',
      postalCode: '',
      city: '',
      state: '',
      country: '',
      email: '',
      phone: '',
      website: '',
      reception: '',
      checkIn: '',
      checkOut: '',
      earlyCheckIn: '',
      lateCheckOut: '',
      breakfast: '',
      breakfastWeekend: '',
      additionalInfo: ''
    })
    setIsModalOpen(true)
  }

  // Open modal for editing hotel
  const openEditHotelModal = (hotel: Hotel) => {
    setEditingHotel(hotel)
    setFormData({
      name: hotel.name,
      street: hotel.street,
      postalCode: hotel.postalCode,
      city: hotel.city,
      state: hotel.state,
      country: hotel.country,
      email: hotel.email,
      phone: hotel.phone,
      website: hotel.website,
      reception: hotel.reception,
      checkIn: hotel.checkIn,
      checkOut: hotel.checkOut,
      earlyCheckIn: hotel.earlyCheckIn,
      lateCheckOut: hotel.lateCheckOut,
      breakfast: hotel.breakfast,
      breakfastWeekend: hotel.breakfastWeekend,
      additionalInfo: hotel.additionalInfo
    })
    setIsModalOpen(true)
  }

  // Save hotel
  const saveHotel = () => {
    if (!formData.name.trim()) {
      alert('Bitte geben Sie einen Hotelnamen ein.')
      return
    }

    const hotelData: Hotel = {
      id: editingHotel ? editingHotel.id : `${Date.now()}_${Math.random()}`,
      ...formData
    }

    let updatedHotels: Hotel[]
    if (editingHotel) {
      updatedHotels = hotels.map(h => h.id === editingHotel.id ? hotelData : h)
    } else {
      updatedHotels = [...hotels, hotelData]
    }

    saveHotels(updatedHotels)
    setIsModalOpen(false)
    setEditingHotel(null)
  }

  // Delete hotel
  const deleteHotel = (hotelId: string) => {
    if (confirm('Möchten Sie dieses Hotel wirklich löschen?')) {
      const updatedHotels = hotels.filter(h => h.id !== hotelId)
      saveHotels(updatedHotels)
      setIsModalOpen(false)
      setEditingHotel(null)
    }
  }

  // CSV Export
  const exportToCSV = () => {
    if (hotels.length === 0) {
      alert('Keine Hotels zum Exportieren vorhanden.')
      return
    }

    const headers = [
      'Name', 'Straße', 'PLZ', 'Ort', 'Bundesland', 'Land',
      'Website'
    ]

    const csvContent = [
      headers.join(';'),
      ...hotels.map(hotel => [
        `"${hotel.name}"`,
        `"${hotel.street}"`,
        `"${hotel.postalCode}"`,
        `"${hotel.city}"`,
        `"${hotel.state}"`,
        `"${hotel.country}"`,
        `"${hotel.website}"`
      ].join(';'))
    ].join('\n')

    // Add BOM for proper UTF-8 encoding in Excel
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `hotels_${new Date().toISOString().split('T')[0]}.csv`)
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
        
        const importedHotels: Hotel[] = dataLines.map((line, index) => {
          const values = line.split(';').map(v => v.replace(/^"|"$/g, ''))
          
          return {
            id: `${Date.now()}_${index}_${Math.random()}`,
            name: values[0] || '',
            street: values[1] || '',
            postalCode: values[2] || '',
            city: values[3] || '',
            state: values[4] || '',
            country: values[5] || '',
            email: '',
            phone: '',
            website: values[6] || '',
            reception: '',
            checkIn: '',
            checkOut: '',
            earlyCheckIn: '',
            lateCheckOut: '',
            breakfast: '',
            breakfastWeekend: '',
            additionalInfo: ''
          }
        })

        const updatedHotels = [...hotels, ...importedHotels]
        saveHotels(updatedHotels)
        alert(`${importedHotels.length} Hotels erfolgreich importiert.`)
      } catch (error) {
        alert('Fehler beim Importieren der CSV-Datei. Bitte überprüfen Sie das Format.')
      }
    }
    
    reader.readAsText(file)
    // Reset file input
    event.target.value = ''
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={openNewHotelModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="h-4 w-4" />
          Neues Hotel
        </button>
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            <Download className="h-4 w-4" />
            CSV-Export
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm cursor-pointer">
            <Upload className="h-4 w-4" />
            CSV-Import
            <input
              type="file"
              accept=".csv"
              onChange={importFromCSV}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Hotels List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {hotels.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">Keine Hotels vorhanden</p>
            <p className="text-sm">Klicken Sie auf "Neues Hotel" um zu beginnen.</p>
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
                    Straße
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PLZ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ort
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bundesland
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Land
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Website
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {hotels.map((hotel) => (
                  <tr
                    key={hotel.id}
                    className={`cursor-pointer transition-colors ${
                      hoveredRow === hotel.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onMouseEnter={() => setHoveredRow(hotel.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => openEditHotelModal(hotel)}
                  >
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{hotel.name}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{hotel.street}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{hotel.postalCode}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{hotel.city}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{hotel.state}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{hotel.country}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
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
                        ) : (
                          '-'
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

      {/* Hotel Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                {editingHotel ? 'Hotel bearbeiten' : 'Neues Hotel'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-300 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Linke Spalte */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Name des Hotels
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="Hotelname"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Straße
                    </label>
                    <input
                      type="text"
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="Straße und Hausnummer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      PLZ
                    </label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="Postleitzahl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Ort
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
                      Bundesland
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="Bundesland/Region"
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

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      E-Mail
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="hotel@beispiel.de"
                    />
                  </div>

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
                      Website
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="https://www.hotel.de"
                    />
                  </div>
                </div>

                {/* Rechte Spalte */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Rezeption
                    </label>
                    <input
                      type="text"
                      value={formData.reception}
                      onChange={(e) => setFormData({ ...formData, reception: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="Rezeption/Ankunft"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Check-in
                    </label>
                    <input
                      type="text"
                      value={formData.checkIn}
                      onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="15:00 Uhr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Check-out
                    </label>
                    <input
                      type="text"
                      value={formData.checkOut}
                      onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="11:00 Uhr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Early Check-in
                    </label>
                    <input
                      type="text"
                      value={formData.earlyCheckIn}
                      onChange={(e) => setFormData({ ...formData, earlyCheckIn: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="14:00 Uhr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Late Check-out
                    </label>
                    <input
                      type="text"
                      value={formData.lateCheckOut}
                      onChange={(e) => setFormData({ ...formData, lateCheckOut: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="12:00 Uhr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Frühstück
                    </label>
                    <input
                      type="text"
                      value={formData.breakfast}
                      onChange={(e) => setFormData({ ...formData, breakfast: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="7:00 - 10:00 Uhr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Frühstück WE
                    </label>
                    <input
                      type="text"
                      value={formData.breakfastWeekend}
                      onChange={(e) => setFormData({ ...formData, breakfastWeekend: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="8:00 - 11:00 Uhr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Weitere Informationen
                    </label>
                    <textarea
                      value={formData.additionalInfo}
                      onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
                      rows={4}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 resize-none"
                      placeholder="Zusätzliche Informationen, Hinweise, Besonderheiten..."
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <div className="flex items-center gap-3">
                  {editingHotel && (
                    <button
                      onClick={() => deleteHotel(editingHotel.id)}
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
                    onClick={saveHotel}
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
