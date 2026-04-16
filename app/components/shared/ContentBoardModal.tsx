'use client'

import { useState, useRef } from 'react'
import { X, Save, Trash2, Loader2 } from 'lucide-react'
import { RichTextEditorField, type RichTextEditorFieldHandle } from '@/app/components/shared/RichTextEditor'
import type { BoardItem, BoardItemFormData } from '@/lib/api-client'

// ============================================================
// ContentBoardModal
// Generisches Modal für ContentBoard-Einträge.
// Wird von ZeitplaeneCard (via TerminSchedule-Adapter) und
// ContentBoard (boards-API) verwendet.
// ============================================================

export interface ContentBoardModalProps {
  item?: BoardItem | null
  sortOrder?: number
  onClose: () => void
  onSave: (data: BoardItemFormData) => Promise<void>
  onDelete?: () => Promise<void>
  /** L-//-R Separator Button im Editor (Zeitplan-spezifisch) */
  showLRSeparator?: boolean
  /** "noch nicht final" Checkbox anzeigen (Zeitplan-spezifisch) */
  showNotFinal?: boolean
  /** Modal-Titel für Neu/Bearbeiten */
  modalTitle?: { new: string; edit: string }
  /** Bezeichnungs-Placeholder */
  titlePlaceholder?: string
  /** Löschen-Bestätigungstext */
  deleteConfirmText?: string
  /** Titelfeld ausblenden (z.B. persönliche Notizen) */
  showTitleField?: boolean
}

export default function ContentBoardModal({
  item,
  onClose,
  onSave,
  onDelete,
  showLRSeparator = false,
  showNotFinal = false,
  modalTitle = { new: 'Neuer Eintrag', edit: 'Eintrag bearbeiten' },
  titlePlaceholder = 'Titel',
  deleteConfirmText,
  showTitleField = true,
}: ContentBoardModalProps) {
  const isEdit = !!item
  const [title, setTitle] = useState(item?.title ?? '')
  const [notFinal, setNotFinal] = useState(item?.notFinal ?? false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editorRef = useRef<RichTextEditorFieldHandle>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave({
        title,
        content: editorRef.current?.getHTML() ?? '',
        notFinal,
        sortOrder: item?.sortOrder ?? 0,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const confirmText = deleteConfirmText ?? `„${title || 'Ohne Titel'}" löschen?`
    if (!confirm(confirmText)) return
    setDeleting(true)
    try {
      await onDelete!()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen')
    } finally {
      setDeleting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave() }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="modal-overlay" onKeyDown={handleKeyDown}>
      <div className="modal-container max-w-3xl">

        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? modalTitle.edit : modalTitle.new}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body space-y-4">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>
          )}

          {showTitleField && (
            <div>
              <label className="form-label">Bezeichnung</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={titlePlaceholder}
                className="form-input"
              />
            </div>
          )}

          <RichTextEditorField
            ref={editorRef}
            initialContent={item?.content ?? ''}
            showLRSeparator={showLRSeparator}
            minHeight="min-h-64"
          />

          {showNotFinal && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={notFinal}
                onChange={e => setNotFinal(e.target.checked)}
                className="rounded border-gray-300 text-orange-500 focus:ring-orange-400"
              />
              <span className="text-sm text-gray-600">noch nicht final</span>
            </label>
          )}
        </div>

        <div className="modal-footer">
          {isEdit && onDelete ? (
            <button onClick={handleDelete} disabled={deleting} className="btn btn-danger disabled:opacity-50">
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Löschen
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Speichern
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
