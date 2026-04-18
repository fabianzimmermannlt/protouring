'use client'

import { useState, useEffect } from 'react'
import { Plus, Download, Upload, Edit, Trash2, Save, X, FileText, Eye, Copy, Folder } from 'lucide-react'

interface Template {
  id: string
  name: string
  type: string
  category: string
  description: string
  content: string
  tags: string
  language: string
  version: string
  lastUpdated: string
  author: string
  usage: string
  notes: string
}

interface TemplateFormData {
  name: string
  type: string
  category: string
  description: string
  content: string
  tags: string
  language: string
  version: string
  lastUpdated: string
  author: string
  usage: string
  notes: string
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    type: '',
    category: '',
    description: '',
    content: '',
    tags: '',
    language: '',
    version: '',
    lastUpdated: '',
    author: '',
    usage: '',
    notes: ''
  })

  // Load templates from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('protouring_templates')
    if (saved) {
      const parsed = JSON.parse(saved)
      setTemplates(parsed)
    }
  }, [])

  // Save templates to localStorage
  const saveTemplates = (updatedTemplates: Template[]) => {
    localStorage.setItem('protouring_templates', JSON.stringify(updatedTemplates))
    setTemplates(updatedTemplates)
  }

  // Open modal for new template
  const openNewTemplateModal = () => {
    setEditingTemplate(null)
    setFormData({
      name: '',
      type: '',
      category: '',
      description: '',
      content: '',
      tags: '',
      language: '',
      version: '',
      lastUpdated: new Date().toISOString().split('T')[0],
      author: '',
      usage: '',
      notes: ''
    })
    setIsModalOpen(true)
  }

  // Open modal for editing template
  const openEditTemplateModal = (template: Template) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      type: template.type,
      category: template.category,
      description: template.description,
      content: template.content,
      tags: template.tags,
      language: template.language,
      version: template.version,
      lastUpdated: template.lastUpdated,
      author: template.author,
      usage: template.usage,
      notes: template.notes
    })
    setIsModalOpen(true)
  }

  // Save template
  const saveTemplate = () => {
    if (!formData.name.trim()) {
      alert('Bitte geben Sie einen Namen ein.')
      return
    }

    const templateData: Template = {
      id: editingTemplate ? editingTemplate.id : `${Date.now()}_${Math.random()}`,
      ...formData
    }

    let updatedTemplates: Template[]
    if (editingTemplate) {
      updatedTemplates = templates.map(t => t.id === editingTemplate.id ? templateData : t)
    } else {
      updatedTemplates = [...templates, templateData]
    }

    saveTemplates(updatedTemplates)
    setIsModalOpen(false)
    setEditingTemplate(null)
  }

  // Delete template
  const deleteTemplate = (templateId: string) => {
    if (confirm('Möchten Sie diese Vorlage wirklich löschen?')) {
      const updatedTemplates = templates.filter(t => t.id !== templateId)
      saveTemplates(updatedTemplates)
    }
  }

  // Duplicate template
  const duplicateTemplate = (template: Template) => {
    const duplicatedTemplate: Template = {
      ...template,
      id: `${Date.now()}_${Math.random()}`,
      name: `${template.name} (Kopie)`,
      lastUpdated: new Date().toISOString().split('T')[0]
    }
    const updatedTemplates = [...templates, duplicatedTemplate]
    saveTemplates(updatedTemplates)
  }

  // CSV Export
  const exportToCSV = () => {
    if (templates.length === 0) {
      alert('Keine Vorlagen zum Exportieren vorhanden.')
      return
    }

    const headers = [
      'Name', 'Typ', 'Kategorie', 'Beschreibung', 'Tags', 'Sprache', 'Version', 'Autor', 'Zuletzt aktualisiert', 'Verwendung', 'Notizen'
    ]

    const csvContent = [
      headers.join(';'),
      ...templates.map(template => [
        `"${template.name}"`,
        `"${template.type}"`,
        `"${template.category}"`,
        `"${template.description}"`,
        `"${template.tags}"`,
        `"${template.language}"`,
        `"${template.version}"`,
        `"${template.author}"`,
        `"${template.lastUpdated}"`,
        `"${template.usage}"`,
        `"${template.notes}"`
      ].join(';'))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `templates_${new Date().toISOString().split('T')[0]}.csv`)
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
        
        const importedTemplates: Template[] = dataLines.map((line, index) => {
          const values = line.split(',').map(v => v.replace(/^"|"$/g, ''))
          
          return {
            id: `${Date.now()}_${index}_${Math.random()}`,
            name: values[0] || '',
            type: values[1] || '',
            category: values[2] || '',
            description: values[3] || '',
            content: '',
            tags: values[4] || '',
            language: values[5] || '',
            version: values[6] || '',
            lastUpdated: values[7] || new Date().toISOString().split('T')[0],
            author: values[8] || '',
            usage: values[9] || '',
            notes: values[10] || ''
          }
        })

        const updatedTemplates = [...templates, ...importedTemplates]
        saveTemplates(updatedTemplates)
        alert(`${importedTemplates.length} Vorlagen erfolgreich importiert.`)
      } catch (error) {
        alert('Fehler beim Importieren der CSV-Datei. Bitte überprüfen Sie das Format.')
      }
    }
    
    reader.readAsText(file)
    // Reset file input
    event.target.value = ''
  }

  // Sort templates by name
  const sortedTemplates = [...templates].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">VORLAGEN</h1>
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
            onClick={openNewTemplateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="h-4 w-4" />
            Neue Vorlage
          </button>
        </div>
      </div>

      {/* Templates List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {templates.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg mb-2">Keine Vorlagen vorhanden</p>
            <p className="text-sm">Klicken Sie auf "Neue Vorlage" um zu beginnen.</p>
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
                    Kategorie
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Beschreibung
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sprache
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Version
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Autor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedTemplates.map((template) => (
                  <tr
                    key={template.id}
                    className={`cursor-pointer transition-colors ${
                      hoveredRow === template.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onMouseEnter={() => setHoveredRow(template.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => openEditTemplateModal(template)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{template.name}</div>
                      {template.tags && (
                        <div className="text-sm text-gray-500 truncate">{template.tags}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{template.type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{template.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 truncate max-w-xs">{template.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{template.language}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{template.version}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{template.author}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditTemplateModal(template)
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="Bearbeiten"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            duplicateTemplate(template)
                          }}
                          className="text-green-600 hover:text-green-800"
                          title="Duplizieren"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteTemplate(template.id)
                          }}
                          className="text-red-600 hover:text-red-800"
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Template Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
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
                          Name der Vorlage
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="Name der Vorlage"
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
                          <option value="Vertrag">Vertrag</option>
                          <option value="Rechnung">Rechnung</option>
                          <option value="Angebot">Angebot</option>
                          <option value="Brief">Brief</option>
                          <option value="E-Mail">E-Mail</option>
                          <option value="Formular">Formular</option>
                          <option value="Checkliste">Checkliste</option>
                          <option value="Sonstiges">Sonstiges</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Kategorie
                        </label>
                        <input
                          type="text"
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="z.B. Rechtlich, Finanzen, Marketing"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Sprache
                        </label>
                        <select
                          value={formData.language}
                          onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Sprache auswählen</option>
                          <option value="Deutsch">Deutsch</option>
                          <option value="Englisch">Englisch</option>
                          <option value="Französisch">Französisch</option>
                          <option value="Spanisch">Spanisch</option>
                          <option value="Sonstiges">Sonstiges</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Version
                        </label>
                        <input
                          type="text"
                          value={formData.version}
                          onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="z.B. 1.0, 2.1"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Autor
                        </label>
                        <input
                          type="text"
                          value={formData.author}
                          onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="Name des Autors"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Beschreibung */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Beschreibung</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Beschreibung
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 resize-none"
                        placeholder="Beschreibung der Vorlage und ihres Verwendungszwecks"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Tags
                      </label>
                      <input
                        type="text"
                        value={formData.tags}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="Tags durch Komma getrennt (z.B. wichtig, rechtlich, standard)"
                      />
                    </div>
                  </div>
                </div>

                {/* Inhalt */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Inhalt</h3>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Vorlageninhalt
                    </label>
                    <textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      rows={10}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 resize-none font-mono"
                      placeholder="Inhalt der Vorlage (Platzhalter können mit [PLATZHALTER] gekennzeichnet werden)"
                    />
                  </div>
                </div>

                {/* Verwendungszweck */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Verwendungszweck</h3>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Verwendung
                    </label>
                    <textarea
                      value={formData.usage}
                      onChange={(e) => setFormData({ ...formData, usage: e.target.value })}
                      rows={3}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 resize-none"
                      placeholder="Wann und wie wird diese Vorlage verwendet?"
                    />
                  </div>
                </div>

                {/* Zusätzliche Informationen */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Zusätzliche Informationen</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Zuletzt aktualisiert
                      </label>
                      <input
                        type="date"
                        value={formData.lastUpdated}
                        onChange={(e) => setFormData({ ...formData, lastUpdated: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      />
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
                      placeholder="Zusätzliche Notizen, Hinweise, etc."
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t">
                <div className="flex items-center gap-3">
                  {editingTemplate && (
                    <button
                      onClick={() => deleteTemplate(editingTemplate.id)}
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
                    onClick={saveTemplate}
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
