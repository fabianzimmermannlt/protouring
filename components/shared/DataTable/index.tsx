'use client'

import { useState, useEffect } from 'react'
import { Plus, Download, Upload, Edit, Trash2, Save, X } from 'lucide-react'

export interface DataTableItem {
  id: string
  [key: string]: any
}

export interface DataTableColumn {
  key: string
  label: string
  sortable?: boolean
  render?: (value: any, item: DataTableItem) => React.ReactNode
}

export interface DataTableProps {
  title?: string
  className?: string
  maxHeight?: string
  enableExport?: boolean
  enableImport?: boolean
  enableEdit?: boolean
  enableDelete?: boolean
  storageKey?: string
  columns: DataTableColumn[]
  data: DataTableItem[]
  onItemSelect?: (item: DataTableItem) => void
  onDataChange?: (data: DataTableItem[]) => void
  renderActions?: (item: DataTableItem) => React.ReactNode
}

export function DataTable({
  title = 'Daten',
  className = '',
  maxHeight = 'h-[600px]',
  enableExport = true,
  enableImport = true,
  enableEdit = true,
  enableDelete = true,
  storageKey,
  columns,
  data,
  onItemSelect,
  onDataChange,
  renderActions
}: DataTableProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<DataTableItem | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [formData, setFormData] = useState<DataTableItem>({ id: '' })

  // Load data from localStorage on mount
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      const savedData = localStorage.getItem(storageKey)
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData)
          onDataChange?.(parsedData)
        } catch (error) {
          console.error('Error loading data:', error)
        }
      }
    }
  }, [storageKey, onDataChange])

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(data))
    }
  }, [data, storageKey])

  // Delete item
  const deleteItem = (itemId: string) => {
    const updatedData = data.filter(item => item.id !== itemId)
    onDataChange?.(updatedData)
  }

  // Open modal for new item
  const openNewItemModal = () => {
    setEditingItem(null)
    const newItem: DataTableItem = { id: '' }
    columns.forEach(column => {
      newItem[column.key] = ''
    })
    setFormData(newItem)
    setIsModalOpen(true)
  }

  // Open modal for editing item
  const openEditItemModal = (item: DataTableItem) => {
    setEditingItem(item)
    setFormData({ ...item })
    setIsModalOpen(true)
  }

  // Save item
  const saveItem = () => {
    if (!editingItem) {
      // Add new item
      const newItem: DataTableItem = {
        ...formData,
        id: `${Date.now()}_${Math.random()}`
      }
      onDataChange?.([...data, newItem])
    } else {
      // Update existing item
      const updatedData = data.map(item =>
        item.id === editingItem.id ? { ...formData, id: editingItem.id } : item
      )
      onDataChange?.(updatedData)
    }

    setIsModalOpen(false)
    setEditingItem(null)
  }

  // CSV Export
  const exportToCSV = () => {
    if (data.length === 0) {
      alert('Keine Daten zum Exportieren vorhanden.')
      return
    }

    const headers = columns.map(col => col.label)
    const csvContent = [
      headers.join(';'),
      ...data.map(item => 
        columns.map(col => {
          const value = item[col.key] || ''
          return `"${value}"`
        }).join(';')
      )
    ].join('\n')

    // Add BOM for proper UTF-8 encoding in Excel
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${title}_${new Date().toISOString().split('T')[0]}.csv`)
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
        
        const importedData: DataTableItem[] = dataLines.map((line, index) => {
          const values = line.split(';').map(v => v.replace(/^"|"$/g, ''))
          const newItem: DataTableItem = {
            id: `${Date.now()}_${index}_${Math.random()}`
          }
          
          columns.forEach((column, colIndex) => {
            newItem[column.key] = values[colIndex] || ''
          })
          
          return newItem
        })

        onDataChange?.([...data, ...importedData])
        alert(`${importedData.length} Einträge erfolgreich importiert.`)
      } catch (error) {
        alert('Fehler beim Importieren der CSV-Datei. Bitte überprüfen Sie das Format.')
      }
    }
    
    reader.readAsText(file)
    // Reset file input
    event.target.value = ''
  }

  return (
    <div className={`bg-white rounded-lg border overflow-hidden ${maxHeight} ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex gap-3">
          <button
            onClick={openNewItemModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="h-4 w-4" />
            Neu
          </button>
          {enableExport && (
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              <Download className="h-4 w-4" />
              CSV-Export
            </button>
          )}
          {enableImport && (
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
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-y-auto">
        {data.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">Keine Daten vorhanden</p>
            <p className="text-sm">Klicken Sie auf "Neu" um zu beginnen.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {column.label}
                    </th>
                  ))}
                  {(enableEdit || enableDelete || renderActions) && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aktionen
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((item) => (
                  <tr
                    key={item.id}
                    className={`cursor-pointer transition-colors ${
                      hoveredRow === item.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onMouseEnter={() => setHoveredRow(item.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => onItemSelect?.(item)}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className="px-6 py-2 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {column.render ? column.render(item[column.key], item) : item[column.key]}
                        </div>
                      </td>
                    ))}
                    {(enableEdit || enableDelete || renderActions) && (
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {renderActions ? (
                            renderActions(item)
                          ) : (
                            <>
                              {enableEdit && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openEditItemModal(item)
                                  }}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              )}
                              {enableDelete && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteItem(item.id)
                                  }}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                {editingItem ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-300 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-3">
                {columns.map((column) => (
                  <div key={column.key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {column.label}
                    </label>
                    <input
                      type="text"
                      value={formData[column.key] || ''}
                      onChange={(e) => setFormData({ ...formData, [column.key]: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      placeholder={column.label}
                    />
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <div className="flex items-center gap-3">
                  {editingItem && enableDelete && (
                    <button
                      onClick={() => deleteItem(editingItem.id)}
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
                    onClick={saveItem}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Save className="h-4 w-4 inline mr-2" />
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

export default DataTable
