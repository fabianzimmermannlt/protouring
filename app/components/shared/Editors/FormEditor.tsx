'use client'

import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'

export interface FormField {
  key: string
  label: string
  type: 'text' | 'email' | 'tel' | 'date' | 'select' | 'textarea' | 'checkbox' | 'number'
  required?: boolean
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  validation?: (value: any) => string | null
  defaultValue?: any
  className?: string
  gridCols?: number
  maxLength?: number
  disabled?: boolean
}

export interface FormSection {
  title: string
  fields: FormField[]
  gridCols?: number
}

export interface FormEditorProps {
  title: string
  sections: FormSection[]
  data: Record<string, any>
  onSave: (data: Record<string, any>) => void
  onCancel: () => void
  isOpen: boolean
  loading?: boolean
  className?: string
  maxWidth?: string
}

export function FormEditor({
  title,
  sections,
  data,
  onSave,
  onCancel,
  isOpen,
  loading = false,
  className = '',
  maxWidth = 'max-w-4xl'
}: FormEditorProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Update form data when props change
  useEffect(() => {
    if (isOpen) {
      setFormData(data)
      setErrors({})
    }
  }, [isOpen, data])

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error for this field if it exists
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateField = (field: FormField, value: any): string | null => {
    if (field.required && (!value || value === '')) {
      return `${field.label} ist erforderlich`
    }
    
    if (field.validation) {
      return field.validation(value)
    }
    
    return null
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    let isValid = true

    sections.forEach(section => {
      section.fields.forEach(field => {
        const error = validateField(field, formData[field.key])
        if (error) {
          newErrors[field.key] = error
          isValid = false
        }
      })
    })

    setErrors(newErrors)
    return isValid
  }

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData)
    }
  }

  const renderField = (field: FormField) => {
    const value = formData[field.key] ?? field.defaultValue ?? ''
    const error = errors[field.key]
    const baseClassName = `w-full px-2 py-1 border text-sm focus:ring-1 focus:ring-blue-500 ${
      error ? 'border-red-300' : 'border-gray-300'
    } rounded ${field.className || ''}`

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
        return (
          <input
            type={field.type}
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
            disabled={field.disabled}
            className={baseClassName}
          />
        )

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            disabled={field.disabled}
            className={baseClassName}
          />
        )

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            disabled={field.disabled}
            className={baseClassName}
          >
            <option value="">{field.placeholder || 'Bitte wählen...'}</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            disabled={field.disabled}
            rows={3}
            className={baseClassName}
          />
        )

      case 'checkbox':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => handleChange(field.key, e.target.checked)}
              disabled={field.disabled}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">{field.label}</span>
          </div>
        )

      default:
        return null
    }
  }

  const renderSection = (section: FormSection, sectionIndex: number) => {
    const gridClass = section.gridCols ? `grid grid-cols-1 md:grid-cols-${section.gridCols} gap-4` : 'space-y-3'

    return (
      <div key={sectionIndex} className={gridClass}>
        {section.gridCols ? (
          // Grid Layout für mehrere Spalten
          section.fields.map(field => (
            <div key={field.key} className="space-y-2">
              {field.type !== 'checkbox' && (
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
              )}
              {renderField(field)}
              {errors[field.key] && (
                <p className="text-xs text-red-600">{errors[field.key]}</p>
              )}
            </div>
          ))
        ) : (
          // Vertikales Layout für einzelne Spalte
          <>
            <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">
              {section.title}
            </h3>
            {section.fields.map(field => (
              <div key={field.key} className="space-y-1">
                {field.type !== 'checkbox' && (
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                )}
                {renderField(field)}
                {errors[field.key] && (
                  <p className="text-xs text-red-600">{errors[field.key]}</p>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-lg shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-hidden ${className}`}>
        {/* Header */}
        <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onCancel}
            className="text-gray-300 hover:text-white p-1 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="space-y-6">
            {sections.map((section, index) => renderSection(section, index))}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Wird gespeichert...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
