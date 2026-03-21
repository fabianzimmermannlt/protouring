'use client'

import { useState, useEffect } from 'react'
import { X, Save, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignRight, Minus } from 'lucide-react'

interface FreeTextEditorProps {
  isOpen: boolean
  onClose: () => void
  title: string
  content: string
  onSave: (title: string, content: string) => void
}

// File system functions
const saveToFile = async (filename: string, content: string) => {
  try {
    // In a real browser environment, we'll use localStorage as fallback
    // For Node.js environment, we could use fs module
    localStorage.setItem(`protouring_${filename}`, content)
    return true
  } catch (error) {
    console.error('Failed to save:', error)
    return false
  }
}

const loadFromFile = async (filename: string): Promise<string> => {
  try {
    const content = localStorage.getItem(`protouring_${filename}`)
    return content || ''
  } catch (error) {
    console.error('Failed to load:', error)
    return ''
  }
}

export function FreeTextEditor({ isOpen, onClose, title, content, onSave }: FreeTextEditorProps) {
  const [editorTitle, setEditorTitle] = useState(title)
  const [editorContent, setEditorContent] = useState(content)
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  const [isStrikethrough, setIsStrikethrough] = useState(false)
  const [textAlign, setTextAlign] = useState<'left' | 'right'>('left')

  // Update form data when props change
  useEffect(() => {
    if (isOpen) {
      console.log('Editor opened with props:', { title, content }); // Debug log
      setEditorTitle(title)
      setEditorContent(content)
    }
  }, [isOpen, title, content])

  if (!isOpen) return null

  const handleSave = async () => {
    console.log('Editor saving:', { editorTitle, editorContent }); // Debug log
    const success = await saveToFile('buhne_frei', JSON.stringify({ title: editorTitle, content: editorContent }))
    if (success) {
      console.log('Calling onSave with:', { editorTitle, editorContent }); // Debug log
      onSave(editorTitle, editorContent)
      onClose()
    } else {
      alert('Fehler beim Speichern!')
    }
  }

  const applyFormat = (format: string) => {
    const textarea = document.getElementById('content-textarea') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = textarea.value.substring(start, end)
    
    let formattedText = ''
    switch (format) {
      case 'bold':
        formattedText = selectedText ? `**${selectedText}**` : '**'
        break
      case 'italic':
        formattedText = selectedText ? `*${selectedText}*` : '*'
        break
      case 'underline':
        formattedText = selectedText ? `__${selectedText}__` : '__'
        break
      case 'strikethrough':
        formattedText = selectedText ? `~~${selectedText}~~` : '~~'
        break
      case 'hr':
        formattedText = '\n<hr>\n'
        break
      default:
        formattedText = selectedText || ''
    }

    const newContent = editorContent.substring(0, start) + formattedText + editorContent.substring(end)
    setEditorContent(newContent)
    
    // Set cursor position after insertion
    setTimeout(() => {
      textarea.focus()
      const newPosition = start + formattedText.length
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">FREIER TEXT</h2>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Editor Content */}
        <div className="p-6">
          {/* Title Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Titel
            </label>
            <input
              type="text"
              value={editorTitle}
              onChange={(e) => setEditorTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Titel eingeben..."
            />
          </div>

          {/* Formatting Toolbar */}
          <div className="mb-4">
            <div className="flex items-center space-x-2 p-2 border border-gray-300 rounded-t-lg bg-gray-50">
              <button
                onClick={() => applyFormat('bold')}
                className={`p-2 rounded hover:bg-gray-200 ${isBold ? 'bg-gray-300' : ''}`}
                title="Fett"
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                onClick={() => applyFormat('italic')}
                className={`p-2 rounded hover:bg-gray-200 ${isItalic ? 'bg-gray-300' : ''}`}
                title="Kursiv"
              >
                <Italic className="h-4 w-4" />
              </button>
              <button
                onClick={() => applyFormat('underline')}
                className={`p-2 rounded hover:bg-gray-200 ${isUnderline ? 'bg-gray-300' : ''}`}
                title="Unterstrichen"
              >
                <Underline className="h-4 w-4" />
              </button>
              <button
                onClick={() => applyFormat('strikethrough')}
                className={`p-2 rounded hover:bg-gray-200 ${isStrikethrough ? 'bg-gray-300' : ''}`}
                title="Durchgestrichen"
              >
                <Strikethrough className="h-4 w-4" />
              </button>
              <div className="w-px h-6 bg-gray-300"></div>
              <button
                onClick={() => applyFormat('hr')}
                className="p-2 rounded hover:bg-gray-200"
                title="Trennlinie"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="w-px h-6 bg-gray-300"></div>
              <button
                onClick={() => setTextAlign('left')}
                className={`p-2 rounded hover:bg-gray-200 ${textAlign === 'left' ? 'bg-gray-300' : ''}`}
                title="Links ausrichten"
              >
                <AlignLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setTextAlign('right')}
                className={`p-2 rounded hover:bg-gray-200 ${textAlign === 'right' ? 'bg-gray-300' : ''}`}
                title="Rechts ausrichten"
              >
                <AlignRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Text Area */}
          <div className="mb-6">
            <textarea
              id="content-textarea"
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-b-lg border-t-0 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={15}
              placeholder="Text hier eingeben..."
              style={{ textAlign }}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              SPEICHERN
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
