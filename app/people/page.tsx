'use client'

import { useState, useEffect } from 'react'
import { Plus, Download, Upload, Edit, Trash2, Save, X, Users, Phone, Mail, MapPin, Briefcase } from 'lucide-react'

interface Person {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  mobile: string
  address: string
  postalCode: string
  city: string
  country: string
  company: string
  position: string
  department: string
  role: string
  skills: string
  availability: string
  hourlyRate: string
  notes: string
}

interface PersonFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  mobile: string
  address: string
  postalCode: string
  city: string
  country: string
  company: string
  position: string
  department: string
  role: string
  skills: string
  availability: string
  hourlyRate: string
  notes: string
}

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [formData, setFormData] = useState<PersonFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    mobile: '',
    address: '',
    postalCode: '',
    city: '',
    country: '',
    company: '',
    position: '',
    department: '',
    role: '',
    skills: '',
    availability: '',
    hourlyRate: '',
    notes: ''
  })

  // Load people from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('protouring_people')
    if (saved) {
      const parsed = JSON.parse(saved)
      setPeople(parsed)
    }
  }, [])

  // Save people to localStorage
  const savePeople = (updatedPeople: Person[]) => {
    localStorage.setItem('protouring_people', JSON.stringify(updatedPeople))
    setPeople(updatedPeople)
  }

  // Open modal for new person
  const openNewPersonModal = () => {
    setEditingPerson(null)
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      mobile: '',
      address: '',
      postalCode: '',
      city: '',
      country: '',
      company: '',
      position: '',
      department: '',
      role: '',
      skills: '',
      availability: '',
      hourlyRate: '',
      notes: ''
    })
    setIsModalOpen(true)
  }

  // Open modal for editing person
  const openEditPersonModal = (person: Person) => {
    setEditingPerson(person)
    setFormData({
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      phone: person.phone,
      mobile: person.mobile,
      address: person.address,
      postalCode: person.postalCode,
      city: person.city,
      country: person.country,
      company: person.company,
      position: person.position,
      department: person.department,
      role: person.role,
      skills: person.skills,
      availability: person.availability,
      hourlyRate: person.hourlyRate,
      notes: person.notes
    })
    setIsModalOpen(true)
  }

  // Save person
  const savePerson = () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      alert('Bitte geben Sie Vor- und Nachname ein.')
      return
    }

    const personData: Person = {
      id: editingPerson ? editingPerson.id : `${Date.now()}_${Math.random()}`,
      ...formData
    }

    let updatedPeople: Person[]
    if (editingPerson) {
      updatedPeople = people.map(p => p.id === editingPerson.id ? personData : p)
    } else {
      updatedPeople = [...people, personData]
    }

    savePeople(updatedPeople)
    setIsModalOpen(false)
    setEditingPerson(null)
  }

  // Delete person
  const deletePerson = (personId: string) => {
    if (confirm('Möchten Sie diese Person wirklich löschen?')) {
      const updatedPeople = people.filter(p => p.id !== personId)
      savePeople(updatedPeople)
    }
  }

  // CSV Export
  const exportToCSV = () => {
    if (people.length === 0) {
      alert('Keine Personen zum Exportieren vorhanden.')
      return
    }

    const headers = [
      'Vorname', 'Nachname', 'E-Mail', 'Telefon', 'Mobil', 'Adresse', 'PLZ', 'Stadt', 'Land',
      'Firma', 'Position', 'Abteilung', 'Rolle', 'Fähigkeiten', 'Verfügbarkeit', 'Stundensatz', 'Notizen'
    ]

    const csvContent = [
      headers.join(';'),
      ...people.map(person => [
        `"${person.firstName}"`,
        `"${person.lastName}"`,
        `"${person.email}"`,
        `"${person.phone}"`,
        `"${person.mobile}"`,
        `"${person.address}"`,
        `"${person.postalCode}"`,
        `"${person.city}"`,
        `"${person.country}"`,
        `"${person.company}"`,
        `"${person.position}"`,
        `"${person.department}"`,
        `"${person.role}"`,
        `"${person.skills}"`,
        `"${person.availability}"`,
        `"${person.hourlyRate}"`,
        `"${person.notes}"`
      ].join(';'))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `people_${new Date().toISOString().split('T')[0]}.csv`)
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
        
        const importedPeople: Person[] = dataLines.map((line, index) => {
          const values = line.split(',').map(v => v.replace(/^"|"$/g, ''))
          
          return {
            id: `${Date.now()}_${index}_${Math.random()}`,
            firstName: values[0] || '',
            lastName: values[1] || '',
            email: values[2] || '',
            phone: values[3] || '',
            mobile: values[4] || '',
            address: values[5] || '',
            postalCode: values[6] || '',
            city: values[7] || '',
            country: values[8] || '',
            company: values[9] || '',
            position: values[10] || '',
            department: values[11] || '',
            role: values[12] || '',
            skills: values[13] || '',
            availability: values[14] || '',
            hourlyRate: values[15] || '',
            notes: values[16] || ''
          }
        })

        const updatedPeople = [...people, ...importedPeople]
        savePeople(updatedPeople)
        alert(`${importedPeople.length} Personen erfolgreich importiert.`)
      } catch (error) {
        alert('Fehler beim Importieren der CSV-Datei. Bitte überprüfen Sie das Format.')
      }
    }
    
    reader.readAsText(file)
    // Reset file input
    event.target.value = ''
  }

  // Sort people by name
  const sortedPeople = [...people].sort((a, b) => {
    const nameA = `${a.firstName} ${a.lastName}`.toLowerCase()
    const nameB = `${b.firstName} ${b.lastName}`.toLowerCase()
    return nameA.localeCompare(nameB)
  })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">LEUTE</h1>
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
            onClick={openNewPersonModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="h-4 w-4" />
            Neue Person
          </button>
        </div>
      </div>

      {/* People List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {people.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg mb-2">Keine Personen vorhanden</p>
            <p className="text-sm">Klicken Sie auf "Neue Person" um zu beginnen.</p>
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
                    Kontakt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adresse
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Beruflich
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rolle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Verfügbarkeit
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedPeople.map((person) => (
                  <tr
                    key={person.id}
                    className={`cursor-pointer transition-colors ${
                      hoveredRow === person.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onMouseEnter={() => setHoveredRow(person.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => openEditPersonModal(person)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {person.firstName} {person.lastName}
                      </div>
                      {person.skills && (
                        <div className="text-sm text-gray-500 truncate">{person.skills}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {person.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-gray-400" />
                            {person.email}
                          </div>
                        )}
                        {person.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-gray-400" />
                            {person.phone}
                          </div>
                        )}
                        {person.mobile && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            Mobil: {person.mobile}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {person.address && <div>{person.address}</div>}
                        {(person.postalCode || person.city) && (
                          <div>
                            {person.postalCode} {person.city}
                          </div>
                        )}
                        {person.country && <div>{person.country}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {person.company && (
                          <div className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3 text-gray-400" />
                            {person.company}
                          </div>
                        )}
                        {person.position && <div>{person.position}</div>}
                        {person.department && <div className="text-xs text-gray-500">{person.department}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{person.role}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        person.availability === 'verfügbar' 
                          ? 'bg-green-100 text-green-800'
                          : person.availability === 'eingeschränkt'
                          ? 'bg-yellow-100 text-yellow-800'
                          : person.availability === 'nicht verfügbar'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {person.availability || 'Unbekannt'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Person Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingPerson ? 'Person bearbeiten' : 'Neue Person'}
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
                {/* Persönliche Daten */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Persönliche Daten</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Vorname
                        </label>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="Vorname"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Nachname
                        </label>
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="Nachname"
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
                          placeholder="email@beispiel.de"
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
                          Mobil
                        </label>
                        <input
                          type="tel"
                          value={formData.mobile}
                          onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="+49 123 456789"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Verfügbarkeit
                        </label>
                        <select
                          value={formData.availability}
                          onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Verfügbarkeit auswählen</option>
                          <option value="verfügbar">Verfügbar</option>
                          <option value="eingeschränkt">Eingeschränkt</option>
                          <option value="nicht verfügbar">Nicht verfügbar</option>
                        </select>
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

                {/* Berufliche Daten */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Berufliche Daten</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Firma
                        </label>
                        <input
                          type="text"
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="Firma"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Position
                        </label>
                        <input
                          type="text"
                          value={formData.position}
                          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="Position"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Abteilung
                        </label>
                        <input
                          type="text"
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="Abteilung"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Rolle
                        </label>
                        <input
                          type="text"
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="Rolle im Team"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fähigkeiten und Finanzen */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Fähigkeiten & Finanzen</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Fähigkeiten
                      </label>
                      <textarea
                        value={formData.skills}
                        onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                        rows={3}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 resize-none"
                        placeholder="Fähigkeiten, Qualifikationen, Zertifikate..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Stundensatz
                      </label>
                      <input
                        type="text"
                        value={formData.hourlyRate}
                        onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="z.B. 50 €/Stunde"
                      />
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
                      placeholder="Zusätzliche Notizen und Informationen"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t">
                <div className="flex items-center gap-3">
                  {editingPerson && (
                    <button
                      onClick={() => deletePerson(editingPerson.id)}
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
                    onClick={savePerson}
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
