'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Loader2, Copy, BookTemplate, X, Save, Trash2, AlertCircle } from 'lucide-react'
import {
  getTerminSchedules, createTerminSchedule, updateTerminSchedule, deleteTerminSchedule, type TerminSchedule,
  getScheduleTemplates, createScheduleTemplate, type ScheduleTemplate,
  API_BASE, getAuthToken, getCurrentTenant,
} from '@/lib/api-client'
import { renderBoardContent } from '@/app/components/shared/ContentBoard'
import { RichTextEditorField, type RichTextEditorFieldHandle } from '@/app/components/shared/RichTextEditor'
import { useEscapeKey } from '@/app/hooks/useEscapeKey'

function openSchedulePdf(terminId: number, scheduleId: number) {
  const token = getAuthToken()
  const tenant = getCurrentTenant()
  const params = new URLSearchParams()
  if (token) params.set('token', token)
  if (tenant?.slug) params.set('tenant', tenant.slug)
  const url = `${API_BASE}/api/termine/${terminId}/schedules/${scheduleId}/pdf?${params}`
  window.open(url, '_blank')
}

// ── Template-Picker Modal ──────────────────────────────────────────────────────
function TemplatePickerModal({
  templates, loading, onSelect, onClose,
}: {
  templates: ScheduleTemplate[]
  loading: boolean
  onSelect: (t: ScheduleTemplate) => void
  onClose: () => void
}) {
  useEscapeKey(onClose)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div ref={ref} className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Vorlage auswählen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
              <Loader2 size={16} className="animate-spin" /><span className="text-sm">Wird geladen…</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-gray-500">Noch keine Vorlagen vorhanden.</p>
              <p className="text-xs text-gray-400 mt-1">Speichere einen Zeitplan als Vorlage über das Buch-Symbol.</p>
            </div>
          ) : (
            <div className="py-1">
              {templates.map(t => (
                <button key={t.id} onClick={() => onSelect(t)}
                  className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3 group">
                  <BookTemplate size={14} className="text-gray-400 flex-shrink-0 group-hover:text-blue-500 transition-colors" />
                  <p className="text-sm text-gray-800 font-medium truncate">{t.name || 'Ohne Namen'}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── "Als Vorlage speichern"-Modal ─────────────────────────────────────────────
function SaveAsTemplateModal({
  schedule, onSave, onClose,
}: {
  schedule: TerminSchedule
  onSave: (name: string) => Promise<void>
  onClose: () => void
}) {
  useEscapeKey(onClose)
  const [name, setName] = useState(schedule.title || '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try { await onSave(name.trim()) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Als Vorlage speichern</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Name der Vorlage</label>
            <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
              placeholder="z.B. Festival Daysheet, Konzert Standard…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              Abbrechen
            </button>
            <button type="submit" disabled={!name.trim() || saving}
              className="flex-1 px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-1.5">
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Inline Edit-Karte ─────────────────────────────────────────────────────────
function ScheduleEditCard({
  terminId, schedule, sortOrder, onSaved, onDeleted, onCancel,
}: {
  terminId: number
  schedule?: TerminSchedule | null
  sortOrder: number
  onSaved: (s: TerminSchedule) => void
  onDeleted?: () => void
  onCancel: () => void
}) {
  useEscapeKey(onCancel)
  const isNew = !schedule
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
      const saved = isNew
        ? await createTerminSchedule(terminId, { title, content, notFinal, sortOrder })
        : await updateTerminSchedule(terminId, schedule!.id, { title, content, notFinal, sortOrder: schedule!.sortOrder })
      onSaved(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!schedule || !onDeleted) return
    if (!confirm('Zeitplan löschen?')) return
    setDeleting(true)
    try {
      await deleteTerminSchedule(terminId, schedule.id)
      onDeleted()
    } catch {
      setError('Fehler beim Löschen')
      setDeleting(false)
    }
  }

  return (
    <div className="pt-card" style={{ outline: '2px solid #3b82f6', outlineOffset: '-1px' }}>
      <div className="pt-card-header">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Titel (z.B. Daysheet, Folgetag…)"
          className="detail-input flex-1 min-w-0"
          style={{ fontSize: '0.8125rem', fontWeight: 600 }}
          autoFocus={isNew}
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setNotFinal(v => !v)}
            className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide transition-colors flex-shrink-0 ${
              notFinal ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-orange-500'
            }`}
            title="Noch nicht final">
            {notFinal ? 'Nicht final' : 'final'}
          </button>
          {!isNew && onDeleted && (
            <button onClick={handleDelete} disabled={deleting}
              className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0" title="Löschen">
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          )}
          <button onClick={onCancel} disabled={saving}
            className="text-xs transition-colors" style={{ color: '#888' }}>
            Abbrechen
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded font-medium disabled:opacity-50 transition-colors"
            style={{ background: '#2563eb', color: '#fff' }}>
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            Speichern
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-xs flex items-center gap-2">
          <AlertCircle size={12} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={12} /></button>
        </div>
      )}

      <div className="pt-card-body">
        <RichTextEditorField
          ref={editorRef}
          initialContent={schedule?.content ?? ''}
          showLRSeparator
          minHeight="min-h-32"
        />
      </div>
    </div>
  )
}

// ── Haupt-Komponente ───────────────────────────────────────────────────────────
export default function ZeitplaeneCard({
  terminId, isAdmin, layout = 'stack',
}: {
  terminId: number
  isAdmin: boolean
  layout?: 'stack' | 'grid-2'
}) {
  const [schedules, setSchedules] = useState<TerminSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [saveAsTemplate, setSaveAsTemplate] = useState<TerminSchedule | null>(null)

  useEffect(() => {
    getTerminSchedules(terminId)
      .then(setSchedules)
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false))
  }, [terminId])

  const openTemplatePicker = async () => {
    setPickerOpen(true)
    setTemplatesLoading(true)
    try { setTemplates(await getScheduleTemplates()) }
    catch { setTemplates([]) }
    finally { setTemplatesLoading(false) }
  }

  const handleSelectTemplate = async (t: ScheduleTemplate) => {
    setPickerOpen(false)
    const created = await createTerminSchedule(terminId, {
      title: t.name, content: t.content, notFinal: t.notFinal, sortOrder: schedules.length,
    })
    setSchedules(prev => [...prev, created])
  }

  const handleSaveAsTemplate = async (name: string) => {
    const s = saveAsTemplate!
    await createScheduleTemplate({ name, content: s.content, notFinal: s.notFinal, sortOrder: 0 })
    setSaveAsTemplate(null)
  }

  const handleSaved = (saved: TerminSchedule) => {
    setSchedules(prev => {
      const exists = prev.find(s => s.id === saved.id)
      return exists ? prev.map(s => s.id === saved.id ? saved : s) : [...prev, saved]
    })
    setEditingId(null)
  }

  const handleDeleted = (id: number) => {
    setSchedules(prev => prev.filter(s => s.id !== id))
    setEditingId(null)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
  }

  const scheduleCards = schedules.map(s =>
    editingId === s.id ? (
      <ScheduleEditCard
        key={s.id}
        terminId={terminId}
        schedule={s}
        sortOrder={s.sortOrder}
        onSaved={handleSaved}
        onDeleted={() => handleDeleted(s.id)}
        onCancel={() => setEditingId(null)}
      />
    ) : (
      <div key={s.id} className="pt-card">
        <div className="pt-card-header">
          <span className="pt-card-title">
            {s.title || <span className="normal-case font-normal tracking-normal text-gray-400 italic">Ohne Titel</span>}
          </span>
          {s.notFinal && (
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-500 text-white uppercase tracking-wide flex-shrink-0">
              Noch nicht final
            </span>
          )}
          <button onClick={() => openSchedulePdf(s.terminId, s.id)}
            className="text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0" title="Als PDF öffnen">
            <svg width="13" height="16" viewBox="0 0 26 32" fill="none" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
              <path d="M0 0H18L26 8V32H0V0Z" fill="none" stroke="currentColor" strokeWidth="2"/>
              <path d="M18 0V8H26" fill="none" stroke="currentColor" strokeWidth="2"/>
              <rect x="0" y="20" width="26" height="12" fill="currentColor"/>
              <text x="3" y="29" fontSize="9" fontWeight="800" fill="white" fontFamily="Helvetica,Arial,sans-serif" letterSpacing="0.5">PDF</text>
            </svg>
          </button>
          {isAdmin && (
            <>
              <button onClick={() => setSaveAsTemplate(s)}
                className="text-gray-400 hover:text-amber-500 transition-colors flex-shrink-0" title="Als Vorlage speichern">
                <BookTemplate size={12} />
              </button>
              <button onClick={() => setEditingId(s.id)}
                className="text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0" title="Bearbeiten">
                <Pencil size={12} />
              </button>
            </>
          )}
        </div>
        {s.content && (
          <div className="rich-content pt-card-body text-sm text-gray-700 space-y-0.5">
            {renderBoardContent(s.content)}
          </div>
        )}
      </div>
    )
  )

  const newCard = editingId === 'new' ? (
    <ScheduleEditCard
      key="new"
      terminId={terminId}
      schedule={null}
      sortOrder={schedules.length}
      onSaved={handleSaved}
      onCancel={() => setEditingId(null)}
    />
  ) : null

  const AddButton = () => (
    <div className="pt-card-new overflow-hidden">
      <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-dashed divide-gray-200">
        <button onClick={() => setEditingId('new')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-4 text-gray-300 hover:text-gray-500 transition-colors">
          <Plus size={14} /><span className="text-xs font-medium">Neuer Zeitplan</span>
        </button>
        <button onClick={openTemplatePicker}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-4 text-gray-300 hover:text-gray-500 transition-colors">
          <Copy size={14} /><span className="text-xs font-medium">Aus Vorlage</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {layout === 'grid-2' ? (
        <div className="grid grid-cols-2 gap-4">
          {scheduleCards}
          {newCard}
          {isAdmin && editingId !== 'new' && <AddButton />}
        </div>
      ) : (
        <>
          {scheduleCards}
          {newCard}
          {isAdmin && editingId !== 'new' && <AddButton />}
        </>
      )}

      {pickerOpen && (
        <TemplatePickerModal
          templates={templates}
          loading={templatesLoading}
          onSelect={handleSelectTemplate}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {saveAsTemplate && (
        <SaveAsTemplateModal
          schedule={saveAsTemplate}
          onSave={handleSaveAsTemplate}
          onClose={() => setSaveAsTemplate(null)}
        />
      )}
    </>
  )
}
