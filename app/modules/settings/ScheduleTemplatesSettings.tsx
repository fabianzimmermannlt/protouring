'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, X, Loader2, ChevronDown, ChevronRight, BookTemplate } from 'lucide-react'
import {
  getScheduleTemplates,
  updateScheduleTemplate,
  deleteScheduleTemplate,
  type ScheduleTemplate,
  API_BASE, getAuthToken, getCurrentTenant,
} from '@/lib/api-client'
import { renderBoardContent } from '@/app/components/shared/ContentBoard'
import ContentBoardModal from '@/app/components/shared/ContentBoardModal'
import type { BoardItemFormData } from '@/lib/api-client'

// Adapter: ScheduleTemplate → BoardItem für ContentBoardModal
function templateToBoardItem(t: ScheduleTemplate) {
  return {
    id: t.id,
    tenantId: t.tenantId,
    entityType: 'template' as const,
    entityId: String(t.id),
    title: t.name,
    content: t.content,
    notFinal: t.notFinal,
    sortOrder: t.sortOrder,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

// ── Name-Inline-Edit ──────────────────────────────────────────────────────────
function InlineNameEdit({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(name.trim() || value) }} className="flex items-center gap-1 flex-1 min-w-0">
      <input
        ref={ref}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Escape' && onCancel()}
        className="flex-1 min-w-0 border border-blue-400 rounded px-2 py-0.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-500"
      />
      <button type="submit" className="text-xs text-blue-600 hover:text-blue-800 font-medium px-1">OK</button>
      <button type="button" onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 px-1">✕</button>
    </form>
  )
}

// ── Einzelne Vorlage als Akkordeon-Zeile ──────────────────────────────────────
function TemplateRow({
  template,
  onUpdate,
  onDelete,
}: {
  template: ScheduleTemplate
  onUpdate: (updated: ScheduleTemplate) => void
  onDelete: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editingContent, setEditingContent] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleRename = async (name: string) => {
    setEditingName(false)
    if (name === template.name) return
    const updated = await updateScheduleTemplate(template.id, { name })
    onUpdate(updated)
  }

  const handleSaveContent = async (data: BoardItemFormData) => {
    const updated = await updateScheduleTemplate(template.id, {
      name: data.title,
      content: data.content,
      notFinal: data.notFinal,
    })
    onUpdate(updated)
    setEditingContent(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Vorlage „${template.name}" wirklich löschen?`)) return
    setDeleting(true)
    try {
      await deleteScheduleTemplate(template.id)
      onDelete(template.id)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <>
      <div
        className={`flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 ${open ? 'rounded-t-lg border-b-0' : 'rounded-lg'} group cursor-pointer select-none`}
        onClick={() => !editingName && setOpen(v => !v)}
      >
        {/* Collapse toggle */}
        <span className="text-gray-400 flex-shrink-0">
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>

        <BookTemplate size={14} className="text-gray-400 flex-shrink-0" />

        {/* Name */}
        {editingName ? (
          <InlineNameEdit
            value={template.name}
            onSave={handleRename}
            onCancel={() => setEditingName(false)}
          />
        ) : (
          <span
            className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate"
            onDoubleClick={e => { e.stopPropagation(); setEditingName(true) }}
          >
            {template.name || <span className="italic text-gray-400 font-normal">Ohne Namen</span>}
          </span>
        )}

        {/* Aktionen */}
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => setEditingName(true)}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            title="Umbenennen"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => setEditingContent(true)}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors text-xs font-medium"
            title="Inhalt bearbeiten"
          >
            Inhalt
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            title="Löschen"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>

      {/* Inhalt (aufgeklappt) */}
      {open && (
        <div className="border border-gray-200 border-t-0 rounded-b-lg bg-gray-50 px-4 py-3">
          {template.content ? (
            <div className="rich-content text-sm text-gray-700 space-y-0.5">
              {renderBoardContent(template.content)}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">Kein Inhalt</p>
          )}
          <button
            onClick={() => setEditingContent(true)}
            className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            Inhalt bearbeiten
          </button>
        </div>
      )}

      {/* Inhalt-Bearbeitung via ContentBoardModal */}
      {editingContent && (
        <ContentBoardModal
          item={templateToBoardItem(template)}
          sortOrder={template.sortOrder}
          onClose={() => setEditingContent(false)}
          onSave={handleSaveContent}
          showLRSeparator
          showNotFinal
          modalTitle={{ new: 'Vorlage bearbeiten', edit: 'Vorlage bearbeiten' }}
          titlePlaceholder="Name der Vorlage"
        />
      )}
    </>
  )
}

// ── Hauptkomponente ────────────────────────────────────────────────────────────
export default function ScheduleTemplatesSettings() {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getScheduleTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [])

  const handleUpdate = (updated: ScheduleTemplate) => {
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  const handleDelete = (id: number) => {
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Wird geladen…</span>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Zeitplan-Vorlagen</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Vorlagen können im Events-Bereich unter Schedule gespeichert und wiederverwendet werden.
          </p>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-lg">
          <BookTemplate size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">Noch keine Vorlagen vorhanden.</p>
          <p className="text-xs text-gray-400 mt-1">
            Öffne einen Zeitplan im Events-Bereich und klicke auf das Buch-Symbol, um ihn als Vorlage zu speichern.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <TemplateRow
              key={t.id}
              template={t}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
