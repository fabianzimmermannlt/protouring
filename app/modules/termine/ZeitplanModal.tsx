'use client'

import { useState, useRef } from 'react'
import { X, Save, Trash2, Loader2 } from 'lucide-react'
import { RichTextEditorField, type RichTextEditorFieldHandle } from '@/app/components/shared/RichTextEditor'
import {
  createTerminSchedule,
  updateTerminSchedule,
  deleteTerminSchedule,
  type TerminSchedule,
} from '@/lib/api-client'

interface ZeitplanModalProps {
  terminId: number
  schedule?: TerminSchedule | null
  sortOrder?: number
  onClose: () => void
  onSaved: (s: TerminSchedule) => void
  onDeleted?: () => void
}

export default function ZeitplanModal({
  terminId,
  schedule,
  sortOrder = 0,
  onClose,
  onSaved,
  onDeleted,
}: ZeitplanModalProps) {
  const isEdit = !!schedule
  const [title, setTitle] = useState(schedule?.title ?? '')
  const [notFinal, setNotFinal] = useState(schedule?.notFinal ?? false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editorRef = useRef<RichTextEditorFieldHandle>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const content = editorRef.current?.getHTML() ?? ''
    try {
      const saved = isEdit
        ? await updateTerminSchedule(terminId, schedule!.id, {
            title, content, notFinal, sortOrder: schedule!.sortOrder,
          })
        : await createTerminSchedule(terminId, { title, content, notFinal, sortOrder })
      onSaved(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Zeitplan „${title || 'Ohne Titel'}" löschen?`)) return
    setDeleting(true)
    try {
      await deleteTerminSchedule(terminId, schedule!.id)
      onDeleted?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-3xl">

        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? 'Zeitplan bearbeiten' : 'Neuer Zeitplan'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body space-y-4">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>
          )}

          {/* Bezeichnung */}
          <div>
            <label className="form-label">Bezeichnung</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="z.B. Daysheet, Festival Lineup, Folgetag"
              className="form-input"
            />
          </div>

          {/* Editor */}
          <RichTextEditorField
            ref={editorRef}
            initialContent={schedule?.content ?? ''}
            showLRSeparator
            minHeight="min-h-64"
          />

          {/* noch nicht final */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={notFinal}
              onChange={e => setNotFinal(e.target.checked)}
              className="rounded border-gray-300 text-orange-500 focus:ring-orange-400"
            />
            <span className="text-sm text-gray-600">noch nicht final</span>
          </label>
        </div>

        <div className="modal-footer">
          {isEdit ? (
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
