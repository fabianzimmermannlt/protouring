'use client'

import { useState, useEffect } from 'react'
import { Plus, Download, Upload, Edit, Trash2, Save, X, Users, Phone, Mail, Globe, Briefcase, Building } from 'lucide-react'

interface Partner {
  id: string
  name: string
  type: string
  contactPerson: string
  email: string
  phone: string
  website: string
  address: string
  postalCode: string
  city: string
  country: string
  services: string
  industry: string
  since: string
  status: string
  rating: string
  notes: string
}

interface PartnerFormData {
  name: string
  type: string
  contactPerson: string
  email: string
  phone: string
  website: string
  address: string
  postalCode: string
  city: string
  country: string
  services: string
  industry: string
  since: string
  status: string
  rating: string
  notes: string
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [formData, setFormData] = useState<PartnerFormData>({
    name: '',
    type: '',
    contactPerson: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    postalCode: '',
    city: '',
    country: '',
    services: '',
    industry: '',
    since: '',
    status: '',
    rating: '',
    notes: ''
  })

  // Load partners from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('protouring_partners')
    if (saved) {
      const parsed = JSON.parse(saved)
      setPartners(parsed)
    }
  }, [])

  // Save partners to localStorage
  const savePartners = (updatedPartners: Partner[]) => {
    localStorage.setItem('protouring_partners', JSON.stringify(updatedPartners))
    setPartners(updatedPartners)
  }

  // Open modal for new partner
  const openNewPartnerModal = () => {
    setEditingPartner(null)
    setFormData({
      name: '',
      type: '',
      contactPerson: '',
      email: '',
      phone: '',
      website: '',
      address: '',
      postalCode: '',
      city: '',
      country: '',
      services: '',
      industry: '',
      since: '',
      status: '',
      rating: '',
      notes: ''
    })
    setIsModalOpen(true)
  }

  // Open modal for editing partner
  const openEditPartnerModal = (partner: Partner) => {
    setEditingPartner(partner)
    setFormData({
      name: partner.name,
      type: partner.type,
      contactPerson: partner.contactPerson,
      email: partner.email,
      phone: partner.phone,
      website: partner.website,
      address: partner.address,
      postalCode: partner.postalCode,
      city: partner.city,
      country: partner.country,
      services: partner.services,
      industry: partner.industry,
      since: partner.since,
      status: partner.status,
      rating: partner.rating,
      notes: partner.notes
    })
    setIsModalOpen(true)
  }

  // Save partner
  const savePartner = () => {
    if (!formData.name.trim()) {
      alert('Bitte geben Sie einen Namen ein.')
      return
    }

    const partnerData: Partner = {
      id: editingPartner ? editingPartner.id : `${Date.now()}_${Math.random()}`,
      ...formData
    }

    let updatedPartners: Partner[]
    if (editingPartner) {
      updatedPartners = partners.map(p => p.id === editingPartner.id ? partnerData : p)
    } else {
      updatedPartners = [...partners, partnerData]
    }

    savePartners(updatedPartners)
    setIsModalOpen(false)
    setEditingPartner(null)
  }

  // Delete partner
  const deletePartner = (partnerId: string) => {
    if (confirm('Möchten Sie diesen Partner wirklich löschen?')) {
      const updatedPartners = partners.filter(p => p.id !== partnerId)
      savePartners(updatedPartners)
    }
  }

  // CSV Export
  const exportToCSV = () => {
    if (partners.length === 0) {
      alert('Keine Partner zum Exportieren vorhanden.')
      return
    }

    const headers = [
      'Name', 'Typ', 'Ansprechpartner', 'E-Mail', 'Telefon', 'Website', 'Adresse', 'PLZ', 'Stadt', 'Land',
      'Dienstleistungen', 'Branche', 'Seit', 'Status', 'Bewertung', 'Notizen'
    ]

    const csvContent = [
      headers.join(';'),
      ...partners.map(partner => [
        `"${partner.name}"`,
        `"${partner.type}"`,
        `"${partner.contactPerson}"`,
        `"${partner.email}"`,
        `"${partner.phone}"`,
        `"${partner.website}"`,
        `"${partner.address}"`,
        `"${partner.postalCode}"`,
        `"${partner.city}"`,
        `"${partner.country}"`,
        `"${partner.services}"`,
        `"${partner.industry}"`,
        `"${partner.since}"`,
        `"${partner.status}"`,
        `"${partner.rating}"`,
        `"${partner.notes}"`
      ].join(';'))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `partners_${new Date().toISOString().split('T')[0]}.csv`)
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
        
        const importedPartners: Partner[] = dataLines.map((line, index) => {
          const values = line.split(',').map(v => v.replace(/^"|"$/g, ''))
          
          return {
            id: `${Date.now()}_${index}_${Math.random()}`,
            name: values[0] || '',
            type: values[1] || '',
            contactPerson: values[2] || '',
            email: values[3] || '',
            phone: values[4] || '',
            website: values[5] || '',
            address: values[6] || '',
            postalCode: values[7] || '',
            city: values[8] || '',
            country: values[9] || '',
            services: values[10] || '',
            industry: values[11] || '',
            since: values[12] || '',
            status: values[13] || '',
            rating: values[14] || '',
            notes: values[15] || ''
          }
        })

        const updatedPartners = [...partners, ...importedPartners]
        savePartners(updatedPartners)
        alert(`${importedPartners.length} Partner erfolgreich importiert.`)
      } catch (error) {
        alert('Fehler beim Importieren der CSV-Datei. Bitte überprüfen Sie das Format.')
      }
    }
    
    reader.readAsText(file)
    // Reset file input
    event.target.value = ''
  }

  // Sort partners by name
  const sortedPartners = [...partners].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">PARTNER</h1>
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
            onClick={openNewPartnerModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="h-4 w-4" />
            Neuer Partner
          </button>
        </div>
      </div>

      {/* Partners List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {partners.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg mb-2">Keine Partner vorhanden</p>
            <p className="text-sm">Klicken Sie auf "Neuer Partner" um zu beginnen.</p>
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
                    Ansprechpartner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kontakt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dienstleistungen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedPartners.map((partner) => (
                  <tr
                    key={partner.id}
                    className={`cursor-pointer transition-colors ${
                      hoveredRow === partner.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onMouseEnter={() => setHoveredRow(partner.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => openEditPartnerModal(partner)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{partner.name}</div>
                      {partner.industry && (
                        <div className="text-sm text-gray-500">{partner.industry}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{partner.type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{partner.contactPerson}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {partner.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-gray-400" />
                            {partner.email}
                          </div>
                        )}
                        {partner.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-gray-400" />
                            {partner.phone}
                          </div>
                        )}
                        {partner.website && (
                          <div className="flex items-center gap-1">
                            <Globe className="h-3 w-3 text-gray-400" />
                            <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                              Website
                            </a>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 truncate max-w-xs">
                        {partner.services}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          partner.status === 'aktiv' 
                            ? 'bg-green-100 text-green-800'
                            : partner.status === 'inaktiv'
                            ? 'bg-red-100 text-red-800'
                            : partner.status === 'potential'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {partner.status}
                        </span>
                        {partner.rating && (
                          <span className="text-xs text-gray-500">
                            {'★'.repeat(parseInt(partner.rating))}{'☆'.repeat(5 - parseInt(partner.rating))}
                          </span>
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

      {/* Partner Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingPartner ? 'Partner bearbeiten' : 'Neuer Partner'}
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
                          Name des Partners
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="Name des Partners"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Partnertyp
                        </label>
                        <select
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Typ auswählen</option>
                          <option value="Lieferant">Lieferant</option>
                          <option value="Dienstleister">Dienstleister</option>
                          <option value="Sponsor">Sponsor</option>
                          <option value="Veranstalter">Veranstalter</option>
                          <option value="Kooperationspartner">Kooperationspartner</option>
                          <option value="Sonstiges">Sonstiges</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Branche
                        </label>
                        <input
                          type="text"
                          value={formData.industry}
                          onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="z.B. Eventtechnik, Gastronomie"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
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

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Zusammenarbeit seit
                        </label>
                        <input
                          type="text"
                          value={formData.since}
                          onChange={(e) => setFormData({ ...formData, since: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="z.B. 2020, 2021"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Status
                        </label>
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Status auswählen</option>
                          <option value="aktiv">Aktiv</option>
                          <option value="inaktiv">Inaktiv</option>
                          <option value="potential">Potenziell</option>
                          <option value="ehemalig">Ehemalig</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Bewertung
                        </label>
                        <select
                          value={formData.rating}
                          onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Bewertung auswählen</option>
                          <option value="5">5 Sterne - Exzellent</option>
                          <option value="4">4 Sterne - Sehr gut</option>
                          <option value="3">3 Sterne - Gut</option>
                          <option value="2">2 Sterne - Ausreichend</option>
                          <option value="1">1 Stern - Mangelhaft</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kontakt */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Kontaktdaten</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          E-Mail
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="partner@beispiel.de"
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
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Website
                        </label>
                        <input
                          type="url"
                          value={formData.website}
                          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="https://www.partner.de"
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

                {/* Dienstleistungen */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Dienstleistungen</h3>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Dienstleistungen & Produkte
                    </label>
                    <textarea
                      value={formData.services}
                      onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                      rows={3}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 resize-none"
                      placeholder="Dienstleistungen, Produkte, Spezialisierungen..."
                    />
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
                      placeholder="Zusätzliche Notizen, besondere Konditionen, etc."
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t">
                <div className="flex items-center gap-3">
                  {editingPartner && (
                    <button
                      onClick={() => deletePartner(editingPartner.id)}
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
                    onClick={savePartner}
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
