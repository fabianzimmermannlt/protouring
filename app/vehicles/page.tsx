'use client'

import { useState, useEffect } from 'react'
import { Plus, Download, Upload, Edit, Trash2, Save, X } from 'lucide-react'

interface Vehicle {
  id: string
  designation: string
  vehicleType: string
  driver: string
  licensePlate: string
  dimensions: string
  powerConnection: string
  hasTrailer: boolean
  trailerDimensions: string
  trailerLicensePlate: string
  seats: string
  sleepingPlaces: string
  notes: string
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    designation: '',
    vehicleType: '',
    driver: '',
    licensePlate: '',
    dimensions: '',
    powerConnection: '',
    hasTrailer: false,
    trailerDimensions: '',
    trailerLicensePlate: '',
    seats: '',
    sleepingPlaces: '',
    notes: ''
  })

  // Mock users for dropdown
  const mockUsers = [
    'Max Mustermann',
    'Erika Mustermann',
    'Thomas Schmidt',
    'Lisa Müller',
    'Michael Weber',
    'Sarah Fischer'
  ]

  // Vehicle types for dropdown
  const vehicleTypes = [
    'Nightliner',
    'Van',
    'Transporter',
    'LKW',
    'PKW',
    'Limousine',
    'Sonstiges',
    'Coach'
  ]

  // Load vehicles from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('protouring_vehicles')
    if (saved) {
      const parsed = JSON.parse(saved)
      setVehicles(parsed)
    }
  }, [])

  // Save vehicles to localStorage
  const saveVehicles = (updatedVehicles: Vehicle[]) => {
    localStorage.setItem('protouring_vehicles', JSON.stringify(updatedVehicles))
    setVehicles(updatedVehicles)
  }

  // Open modal for new vehicle
  const openNewVehicleModal = () => {
    setEditingVehicle(null)
    setFormData({
      designation: '',
      vehicleType: '',
      driver: '',
      licensePlate: '',
      dimensions: '',
      powerConnection: '',
      hasTrailer: false,
      trailerDimensions: '',
      trailerLicensePlate: '',
      seats: '',
      sleepingPlaces: '',
      notes: ''
    })
    setIsModalOpen(true)
  }

  // Open modal for editing vehicle
  const openEditVehicleModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle)
    setFormData({
      designation: vehicle.designation,
      vehicleType: vehicle.vehicleType,
      driver: vehicle.driver,
      licensePlate: vehicle.licensePlate,
      dimensions: vehicle.dimensions,
      powerConnection: vehicle.powerConnection,
      hasTrailer: vehicle.hasTrailer,
      trailerDimensions: vehicle.trailerDimensions,
      trailerLicensePlate: vehicle.trailerLicensePlate,
      seats: vehicle.seats,
      sleepingPlaces: vehicle.sleepingPlaces,
      notes: vehicle.notes
    })
    setIsModalOpen(true)
  }

  // Save vehicle
  const saveVehicle = () => {
    if (!formData.designation.trim()) {
      alert('Bitte geben Sie eine Bezeichnung ein.')
      return
    }

    const vehicleData: Vehicle = {
      id: editingVehicle ? editingVehicle.id : `${Date.now()}_${Math.random()}`,
      ...formData
    }

    let updatedVehicles: Vehicle[]
    if (editingVehicle) {
      updatedVehicles = vehicles.map(v => v.id === editingVehicle.id ? vehicleData : v)
    } else {
      updatedVehicles = [...vehicles, vehicleData]
    }

    saveVehicles(updatedVehicles)
    setIsModalOpen(false)
    setEditingVehicle(null)
  }

  // Delete vehicle
  const deleteVehicle = (vehicleId: string) => {
    if (confirm('Möchten Sie dieses Fahrzeug wirklich löschen?')) {
      const updatedVehicles = vehicles.filter(v => v.id !== vehicleId)
      saveVehicles(updatedVehicles)
      setIsModalOpen(false)
      setEditingVehicle(null)
    }
  }

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
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n')
        
        // Skip header line
        const dataLines = lines.slice(1).filter(line => line.trim())
        
        const importedVehicles: Vehicle[] = dataLines.map((line, index) => {
          const values = line.split(';').map(v => v.replace(/^"|"$/g, ''))
          
          return {
            id: `${Date.now()}_${index}_${Math.random()}`,
            designation: values[0] || '',
            vehicleType: values[1] || '',
            driver: values[2] || '',
            licensePlate: values[3] || '',
            dimensions: values[4] || '',
            powerConnection: values[5] || '',
            hasTrailer: values[6] === 'Ja',
            trailerDimensions: values[7] || '',
            trailerLicensePlate: values[8] || '',
            seats: values[9] || '',
            sleepingPlaces: values[10] || '',
            notes: values[11] || ''
          }
        })

        const updatedVehicles = [...vehicles, ...importedVehicles]
        saveVehicles(updatedVehicles)
        alert(`${importedVehicles.length} Fahrzeuge erfolgreich importiert.`)
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
          onClick={openNewVehicleModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="h-4 w-4" />
          Neues Fahrzeug
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

      {/* Vehicles List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {vehicles.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">Keine Fahrzeuge vorhanden</p>
            <p className="text-sm">Klicken Sie auf "Neues Fahrzeug" um zu beginnen.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bezeichnung
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fahrzeugart
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kennzeichen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Maße
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stromanschluss
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sitzplätze
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schlafplätze
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {vehicles.map((vehicle) => (
                  <tr
                    key={vehicle.id}
                    className={`cursor-pointer transition-colors ${
                      hoveredRow === vehicle.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onMouseEnter={() => setHoveredRow(vehicle.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => openEditVehicleModal(vehicle)}
                  >
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{vehicle.designation}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{vehicle.vehicleType}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{vehicle.driver}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{vehicle.licensePlate}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{vehicle.dimensions}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{vehicle.powerConnection}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{vehicle.seats}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{vehicle.sleepingPlaces}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vehicle Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                {editingVehicle ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug'}
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
                      Bezeichnung
                    </label>
                    <input
                      type="text"
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="z.B. Tourbus 1"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Fahrzeugart
                    </label>
                    <select
                      value={formData.vehicleType}
                      onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Bitte wählen</option>
                      {vehicleTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Driver
                    </label>
                    <select
                      value={formData.driver}
                      onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Bitte wählen</option>
                      {mockUsers.map(user => (
                        <option key={user} value={user}>{user}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Kennzeichen
                    </label>
                    <input
                      type="text"
                      value={formData.licensePlate}
                      onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="AB-CD 123"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Maße
                    </label>
                    <input
                      type="text"
                      value={formData.dimensions}
                      onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="z.B. 12m x 2.5m x 3.5m"
                    />
                  </div>
                </div>

                {/* Rechte Spalte */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Stromanschluss
                    </label>
                    <input
                      type="text"
                      value={formData.powerConnection}
                      onChange={(e) => setFormData({ ...formData, powerConnection: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="z.B. 32A, 230V"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Anhänger
                    </label>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.hasTrailer}
                        onChange={(e) => setFormData({ ...formData, hasTrailer: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Anhänger vorhanden</span>
                    </div>
                  </div>

                  {formData.hasTrailer && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Anhängermaße
                        </label>
                        <input
                          type="text"
                          value={formData.trailerDimensions}
                          onChange={(e) => setFormData({ ...formData, trailerDimensions: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="z.B. 8m x 2.2m x 2.8m"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Anhänger-Kennzeichen
                        </label>
                        <input
                          type="text"
                          value={formData.trailerLicensePlate}
                          onChange={(e) => setFormData({ ...formData, trailerLicensePlate: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="XY-ZW 789"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Sitzplätze
                    </label>
                    <input
                      type="text"
                      value={formData.seats}
                      onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="z.B. 8"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Schlafplätze
                    </label>
                    <input
                      type="text"
                      value={formData.sleepingPlaces}
                      onChange={(e) => setFormData({ ...formData, sleepingPlaces: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder="z.B. 4"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Bemerkung
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  rows={3}
                  placeholder="Zusätzliche Informationen oder Bemerkungen"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <div className="flex items-center gap-3">
                  {editingVehicle && (
                    <button
                      onClick={() => deleteVehicle(editingVehicle.id)}
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
                    onClick={saveVehicle}
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
