'use client'

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Bold, Italic, Underline, Strikethrough, Minus } from 'lucide-react'

// ============================================================
// RichTextEditorField
// Wiederverwendbares Toolbar + contenteditable Feld.
// Verwendung: direkt in Modals einbetten (z.B. ZeitplanModal).
// ============================================================

export interface RichTextEditorFieldHandle {
  getHTML: () => string
  focus: () => void
}

interface RichTextEditorFieldProps {
  initialContent?: string
  /** L-//-R Separator Button + Tab-Shortcut – nur für Zeitplan-Ansicht */
  showLRSeparator?: boolean
  minHeight?: string
  className?: string
  /** Callback bei jeder Eingabe (für Autosave) */
  onInput?: () => void
}

// Normalisiert browser-spezifische HTML-Strukturen auf sauberes <br>-basiertes HTML.
// Chrome erstellt bei Enter <div>-Elemente, Firefox <br> — das vereinheitlichen wir.
function normalizeHTML(html: string): string {
  return html
    .replace(/<div><br\s*\/?><\/div>/gi, '<br>')   // leere Chrome-Zeile
    .replace(/<div>([\s\S]*?)<\/div>/gi, '$1<br>') // Chrome-Zeile mit Inhalt
    .replace(/<p><br\s*\/?><\/p>/gi, '<br>')        // leere Firefox-Zeile
    .replace(/<p>([\s\S]*?)<\/p>/gi, '$1<br>')      // Firefox-Zeile mit Inhalt
    .replace(/(<br\s*\/?>){3,}/gi, '<br><br>')      // max. 2 aufeinanderfolgende <br>
    .replace(/<br\s*\/?>$/i, '')                     // trailing <br> am Ende entfernen
}

export const RichTextEditorField = forwardRef<RichTextEditorFieldHandle, RichTextEditorFieldProps>(
  function RichTextEditorField(
    { initialContent = '', showLRSeparator = false, minHeight = 'min-h-48', className = '', onInput },
    ref
  ) {
    const editorRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      getHTML: () => normalizeHTML(editorRef.current?.innerHTML ?? ''),
      focus: () => editorRef.current?.focus(),
    }))

    useEffect(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = initialContent
        editorRef.current.focus()
        // Cursor ans Ende
        const range = document.createRange()
        const sel = window.getSelection()
        range.selectNodeContents(editorRef.current)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    // Nur beim ersten Mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const exec = (cmd: string, value?: string) => {
      editorRef.current?.focus()
      document.execCommand(cmd, false, value)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        document.execCommand('insertLineBreak')
      }
      if (e.key === 'Tab' && showLRSeparator) {
        e.preventDefault()
        exec('insertText', '-//-')
      }
    }

    return (
      <div className={className}>
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 border border-gray-300 rounded-t-lg bg-gray-50 flex-wrap">
          <ToolbarButton onMouseDown={() => exec('bold')} title="Fett (Strg+B)">
            <Bold size={14} />
          </ToolbarButton>
          <ToolbarButton onMouseDown={() => exec('italic')} title="Kursiv (Strg+I)">
            <Italic size={14} />
          </ToolbarButton>
          <ToolbarButton onMouseDown={() => exec('underline')} title="Unterstrichen (Strg+U)">
            <Underline size={14} />
          </ToolbarButton>
          <ToolbarButton onMouseDown={() => exec('strikeThrough')} title="Durchgestrichen">
            <Strikethrough size={14} />
          </ToolbarButton>
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <ToolbarButton onMouseDown={() => exec('insertHTML', '<br>---<br>')} title="Trennlinie">
            <Minus size={14} />
          </ToolbarButton>
          {showLRSeparator && (
            <>
              <div className="w-px h-4 bg-gray-300 mx-1" />
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); exec('insertText', '-//-') }}
                className="px-2 py-1 rounded hover:bg-gray-200 text-gray-600 text-xs font-mono font-semibold"
                title="Links / Rechts (Tab-Taste)"
              >
                L-//-R
              </button>
            </>
          )}
        </div>

        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onKeyDown={handleKeyDown}
          onInput={onInput}
          className={`rich-content w-full ${minHeight} px-3 py-2 border border-gray-300 border-t-0 rounded-b-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500`}
          style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}
        />
      </div>
    )
  }
)

// ============================================================
// Toolbar-Button Helper
// ============================================================

function ToolbarButton({
  children,
  onMouseDown,
  title,
}: {
  children: React.ReactNode
  onMouseDown: () => void
  title: string
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onMouseDown() }}
      title={title}
      className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
    >
      {children}
    </button>
  )
}

// ============================================================
// RichTextEditor — Modal
// Ersetzt FreeTextEditor überall im Projekt.
// Props-Interface ist kompatibel zu FreeTextEditor.
// ============================================================

export interface RichTextEditorProps {
  isOpen: boolean
  onClose: () => void
  /** Wird als Modal-Titel angezeigt */
  title: string
  /** Gespeicherter HTML-Inhalt */
  content: string
  /** Callback mit (title, htmlContent) */
  onSave: (title: string, content: string) => void
  /** Titelfeld anzeigen (default: false — Titel kommt vom aufrufenden Kontext) */
  showTitleField?: boolean
  /** L-//-R Button + Tab-Shortcut anzeigen (default: false) */
  showLRSeparator?: boolean
}

export function RichTextEditor({
  isOpen,
  onClose,
  title,
  content,
  onSave,
  showTitleField = false,
  showLRSeparator = false,
}: RichTextEditorProps) {
  const fieldRef = useRef<RichTextEditorFieldHandle>(null)

  if (!isOpen) return null

  const handleSave = () => {
    const html = fieldRef.current?.getHTML() ?? ''
    onSave(title, html)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="modal-overlay" onKeyDown={handleKeyDown}>
      <div className="modal-container max-w-2xl">
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="modal-body space-y-4">
          {showTitleField && (
            <div>
              <label className="form-label">Titel</label>
              <input
                type="text"
                defaultValue={title}
                className="form-input"
              />
            </div>
          )}

          <RichTextEditorField
            ref={fieldRef}
            initialContent={content}
            showLRSeparator={showLRSeparator}
            minHeight="min-h-64"
          />
        </div>

        {/* Footer */}
        <div className="modal-footer justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost">
            Abbrechen
          </button>
          <button onClick={handleSave} className="btn btn-primary">
            Speichern
          </button>
        </div>
      </div>
    </div>
  )
}
