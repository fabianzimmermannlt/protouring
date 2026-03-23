'use client'

import { useState, useEffect } from 'react'
import { Plus, Download, Upload, Edit, Trash2, Save, X, Calendar, Clock, MapPin, Users } from 'lucide-react'

interface Appointment {
  id: string
  title: string
  date: string
  time: string
  endTime: string
  location: string
  description: string
  type: string
  status: string
  attendees: string
  priority: string
  reminder: string
  notes: string
}

interface AppointmentFormData {
  title: string
  date: string
  time: string
  endTime: string
  location: string
  description: string
  type: string
  status: string
  attendees: string
  priority: string
  reminder: string
  notes: string
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [formData, setFormData] = useState<AppointmentFormData>({
    title: '',
    date: '',
    time: '',
    endTime: '',
    location: '',
    description: '',
    type: '',
    status: '',
    attendees: '',
    priority: '',
    reminder: '',
    notes: ''
  })

  // Load appointments from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('protouring_appointments')
    if (saved) {
      const parsed = JSON.parse(saved)
      setAppointments(parsed)
    }
  }, [])

  // Save appointments to localStorage
  const saveAppointments = (updatedAppointments: Appointment[]) => {
    localStorage.setItem('protouring_appointments', JSON.stringify(updatedAppointments))
    setAppointments(updatedAppointments)
  }

  // Open modal for new appointment
  const openNewAppointmentModal = () => {
    setEditingAppointment(null)
    setFormData({
      title: '',
      date: '',
      time: '',
      endTime: '',
      location: '',
      description: '',
      type: '',
      status: '',
      attendees: '',
      priority: '',
      reminder: '',
      notes: ''
    })
    setIsModalOpen(true)
  }

  // Open modal for editing appointment
  const openEditAppointmentModal = (appointment: Appointment) => {
    setEditingAppointment(appointment)
    setFormData({
      title: appointment.title,
      date: appointment.date,
      time: appointment.time,
      endTime: appointment.endTime,
      location: appointment.location,
      description: appointment.description,
      type: appointment.type,
      status: appointment.status,
      attendees: appointment.attendees,
      priority: appointment.priority,
      reminder: appointment.reminder,
      notes: appointment.notes
    })
    setIsModalOpen(true)
  }

  // Save appointment
  const saveAppointment = () => {
    if (!formData.title.trim()) {
      alert('Bitte geben Sie einen Titel ein.')
      return
    }

    const appointmentData: Appointment = {
      id: editingAppointment ? editingAppointment.id : `${Date.now()}_${Math.random()}`,
      ...formData
    }

    let updatedAppointments: Appointment[]
    if (editingAppointment) {
      updatedAppointments = appointments.map(a => a.id === editingAppointment.id ? appointmentData : a)
    } else {
      updatedAppointments = [...appointments, appointmentData]
    }

    saveAppointments(updatedAppointments)
    setIsModalOpen(false)
    setEditingAppointment(null)
  }

  // Delete appointment
  const deleteAppointment = (appointmentId: string) => {
    if (confirm('Möchten Sie diesen Termin wirklich löschen?')) {
      const updatedAppointments = appointments.filter(a => a.id !== appointmentId)
      saveAppointments(updatedAppointments)
    }
  }

  // CSV Export
  const exportToCSV = () => {
    if (appointments.length === 0) {
      alert('Keine Termine zum Exportieren vorhanden.')
      return
    }

    const headers = [
      'Titel', 'Datum', 'Uhrzeit', 'Ende', 'Ort', 'Beschreibung', 'Typ', 'Status', 'Teilnehmer', 'Priorität', 'Erinnerung', 'Notizen'
    ]

    const csvContent = [
      headers.join(','),
      ...appointments.map(appointment => [
        `"${appointment.title}"`,
        `"${appointment.date}"`,
        `"${appointment.time}"`,
        `"${appointment.endTime}"`,
        `"${appointment.location}"`,
        `"${appointment.description}"`,
        `"${appointment.type}"`,
        `"${appointment.status}"`,
        `"${appointment.attendees}"`,
        `"${appointment.priority}"`,
        `"${appointment.reminder}"`,
        `"${appointment.notes}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `appointments_${new Date().toISOString().split('T')[0]}.csv`)
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
        
        const importedAppointments: Appointment[] = dataLines.map((line, index) => {
          const values = line.split(',').map(v => v.replace(/^"|"$/g, ''))
          
          return {
            id: `${Date.now()}_${index}_${Math.random()}`,
            title: values[0] || '',
            date: values[1] || '',
            time: values[2] || '',
            endTime: values[3] || '',
            location: values[4] || '',
            description: values[5] || '',
            type: values[6] || '',
            status: values[7] || '',
            attendees: values[8] || '',
            priority: values[9] || '',
            reminder: values[10] || '',
            notes: values[11] || ''
          }
        })

        const updatedAppointments = [...appointments, ...importedAppointments]
        saveAppointments(updatedAppointments)
        alert(`${importedAppointments.length} Termine erfolgreich importiert.`)
      } catch (error) {
        alert('Fehler beim Importieren der CSV-Datei. Bitte überprüfen Sie das Format.')
      }
    }
    
    reader.readAsText(file)
    // Reset file input
    event.target.value = ''
  }

  // Sort appointments by date and time
  const sortedAppointments = [...appointments].sort((a, b) => {
    const dateA = new Date(`${a.date} ${a.time}`)
    const dateB = new Date(`${b.date} ${b.time}`)
    return dateA.getTime() - dateB.getTime()
  })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">TERMINE</h1>
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
          <button
            onClick={openNewAppointmentModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="h-4 w-4" />
            Neuer Termin
          </button>
        </div>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {appointments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg mb-2">Keine Termine vorhanden</p>
            <p className="text-sm">Klicken Sie auf "Neuer Termin" um zu beginnen.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Titel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Datum & Uhrzeit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ort
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Typ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priorität
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedAppointments.map((appointment) => (
                  <tr
                    key={appointment.id}
                    className={`cursor-pointer transition-colors ${
                      hoveredRow === appointment.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onMouseEnter={() => setHoveredRow(appointment.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => openEditAppointmentModal(appointment)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{appointment.title}</div>
                      {appointment.description && (
                        <div className="text-sm text-gray-500 truncate">{appointment.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          {appointment.date}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          {appointment.time} - {appointment.endTime}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm text-gray-900">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        {appointment.location}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{appointment.type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        appointment.status === 'bestätigt' 
                          ? 'bg-green-100 text-green-800'
                          : appointment.status === 'geplant'
                          ? 'bg-yellow-100 text-yellow-800'
                          : appointment.status === 'abgesagt'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {appointment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        appointment.priority === 'hoch' 
                          ? 'bg-red-100 text-red-800'
                          : appointment.priority === 'mittel'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {appointment.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingAppointment ? 'Termin bearbeiten' : 'Neuer Termin'}
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
                          Titel
                        </label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="Titel des Termins"
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
                          <option value="Meeting">Meeting</option>
                          <option value="Event">Event</option>
                          <option value="Reise">Reise</option>
                          <option value="Probe">Probe</option>
                          <option value="Sonstiges">Sonstiges</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Priorität
                        </label>
                        <select
                          value={formData.priority}
                          onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Priorität auswählen</option>
                          <option value="hoch">Hoch</option>
                          <option value="mittel">Mittel</option>
                          <option value="niedrig">Niedrig</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Datum
                        </label>
                        <input
                          type="date"
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Beginn
                          </label>
                          <input
                            type="time"
                            value={formData.time}
                            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Ende
                          </label>
                          <input
                            type="time"
                            value={formData.endTime}
                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
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
                          <option value="geplant">Geplant</option>
                          <option value="bestätigt">Bestätigt</option>
                          <option value="abgesagt">Abgesagt</option>
                          <option value="abgeschlossen">Abgeschlossen</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Details</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Ort
                      </label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="Ort des Termins"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Teilnehmer
                      </label>
                      <input
                        type="text"
                        value={formData.attendees}
                        onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="Namen der Teilnehmer (durch Komma getrennt)"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Beschreibung
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 resize-none"
                        placeholder="Beschreibung des Termins"
                      />
                    </div>
                  </div>
                </div>

                {/* Erinnerung und Notizen */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Erinnerung & Notizen</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Erinnerung
                      </label>
                      <select
                        value={formData.reminder}
                        onChange={(e) => setFormData({ ...formData, reminder: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Keine Erinnerung</option>
                        <option value="5min">5 Minuten vorher</option>
                        <option value="15min">15 Minuten vorher</option>
                        <option value="30min">30 Minuten vorher</option>
                        <option value="1hour">1 Stunde vorher</option>
                        <option value="1day">1 Tag vorher</option>
                      </select>
                    </div>
                  </div>

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
                  {editingAppointment && (
                    <button
                      onClick={() => deleteAppointment(editingAppointment.id)}
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
                    onClick={saveAppointment}
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
