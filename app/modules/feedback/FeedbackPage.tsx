'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Trash2, ChevronDown, Check, Clock, Circle, MessageSquare } from 'lucide-react'
import {
  getFeedback, updateFeedbackStatus, updateFeedbackNote, deleteFeedback,
  type FeedbackItem,
} from '@/lib/api-client'

// ─── Konstanten ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  open: 'Offen',
  in_progress: 'In Arbeit',
  done: 'Erledigt',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  done: 'bg-green-100 text-green-800 border-green-200',
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'done') return <Check className="w-3 h-3" />
  if (status === 'in_progress') return <Clock className="w-3 h-3" />
  return <Circle className="w-3 h-3" />
}

type FilterType = 'all' | 'open' | 'in_progress' | 'done'

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('open')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getFeedback()
      setItems(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleStatusChange = async (id: number, status: 'open' | 'in_progress' | 'done') => {
    try {
      const updated = await updateFeedbackStatus(id, status)
      setItems(prev => prev.map(i => i.id === id ? updated : i))
    } catch { /* ignore */ }
  }

  const handleNoteChange = async (id: number, bemerkung: string | null) => {
    try {
      const updated = await updateFeedbackNote(id, bemerkung)
      setItems(prev => prev.map(i => i.id === id ? updated : i))
    } catch { /* ignore */ }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Eintrag wirklich löschen?')) return
    try {
      await deleteFeedback(id)
      setItems(prev => prev.filter(i => i.id !== id))
    } catch { /* ignore */ }
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter)

  const counts = {
    all: items.length,
    open: items.filter(i => i.status === 'open').length,
    in_progress: items.filter(i => i.status === 'in_progress').length,
    done: items.filter(i => i.status === 'done').length,
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Feedback</h1>
            <p className="text-sm text-gray-500">
              {counts.open > 0
                ? `${counts.open} offene Meldung${counts.open !== 1 ? 'en' : ''}`
                : 'Alles erledigt'}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
        >
          Aktualisieren
        </button>
      </div>

      {/* Filter-Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {(['open', 'in_progress', 'done', 'all'] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
              filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'all' ? 'Alle' : STATUS_LABELS[f]}
            <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
              filter === f ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-500'
            }`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Inhalt */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 text-gray-400 py-16">
          <Loader2 className="animate-spin w-5 h-5" />
          <span className="text-sm">Wird geladen…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Keine Einträge vorhanden</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <FeedbackCard
              key={item.id}
              item={item}
              onStatusChange={handleStatusChange}
              onNoteChange={handleNoteChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Einzelne Karte ───────────────────────────────────────────────────────────

function FeedbackCard({
  item,
  onStatusChange,
  onNoteChange,
  onDelete,
}: {
  item: FeedbackItem
  onStatusChange: (id: number, status: 'open' | 'in_progress' | 'done') => void
  onNoteChange: (id: number, bemerkung: string | null) => void
  onDelete: (id: number) => void
}) {
  const [editingNote, setEditingNote] = useState(false)
  const [noteValue, setNoteValue] = useState(item.bemerkung ?? '')
  const [savingNote, setSavingNote] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setNoteValue(item.bemerkung ?? '')
  }, [item.bemerkung])

  useEffect(() => {
    if (editingNote) noteRef.current?.focus()
  }, [editingNote])

  const saveNote = async () => {
    setSavingNote(true)
    try {
      await onNoteChange(item.id, noteValue.trim() || null)
    } finally {
      setSavingNote(false)
      setEditingNote(false)
    }
  }

  const cancelNote = () => {
    setNoteValue(item.bemerkung ?? '')
    setEditingNote(false)
  }

  const date = new Date(item.createdAt).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className={`bg-white border rounded-xl p-4 shadow-sm transition-opacity ${item.status === 'done' ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-4">
        {/* Status */}
        <div className="flex-shrink-0 pt-0.5">
          <StatusDropdown status={item.status} onChange={s => onStatusChange(item.id, s)} />
        </div>

        {/* Inhalt */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className={`font-medium text-gray-900 leading-snug ${item.status === 'done' ? 'line-through text-gray-400' : ''}`}>
                {item.topic}
                {item.private && (
                  <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded align-middle" title="Nur für Entwickler">🔒</span>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {item.userName}
                {item.tenantName && <span> · {item.tenantName}</span>}
                <span> · {date}</span>
              </p>
            </div>
            <button
              onClick={() => onDelete(item.id)}
              className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 transition-colors rounded"
              title="Löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Beschreibung */}
          {item.description && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 whitespace-pre-wrap leading-relaxed border border-gray-100">
              {item.description}
            </div>
          )}

          {/* Bemerkung */}
          <div className="mt-3">
            {editingNote ? (
              <div className="space-y-2">
                <textarea
                  ref={noteRef}
                  value={noteValue}
                  onChange={e => setNoteValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') cancelNote() }}
                  placeholder="Interne Bemerkung…"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-blue-50"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveNote}
                    disabled={savingNote}
                    className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {savingNote && <Loader2 className="w-3 h-3 animate-spin" />}
                    Speichern
                  </button>
                  <button
                    onClick={cancelNote}
                    className="px-3 py-1 text-gray-500 text-xs rounded-md hover:bg-gray-100"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : item.bemerkung ? (
              <div
                className="group flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors"
                onClick={() => setEditingNote(true)}
                title="Klicken zum Bearbeiten"
              >
                <span className="text-amber-500 text-xs font-bold mt-0.5 shrink-0">Notiz</span>
                <span className="text-sm text-amber-900 flex-1 leading-relaxed whitespace-pre-wrap">{item.bemerkung}</span>
                <span className="text-xs text-amber-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">bearbeiten</span>
              </div>
            ) : (
              <button
                onClick={() => setEditingNote(true)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 py-1 px-1.5 rounded hover:bg-gray-50 transition-colors"
              >
                <span>+ Notiz hinzufügen</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Status-Dropdown ─────────────────────────────────────────────────────────

function StatusDropdown({ status, onChange }: {
  status: string
  onChange: (s: 'open' | 'in_progress' | 'done') => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border transition-opacity hover:opacity-80 ${STATUS_COLORS[status]}`}
      >
        <StatusIcon status={status} />
        {STATUS_LABELS[status]}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden min-w-[140px]">
          {(['open', 'in_progress', 'done'] as const).map(s => (
            <button
              key={s}
              onClick={() => { onChange(s); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 hover:bg-gray-50 transition-colors ${status === s ? 'font-semibold bg-gray-50' : ''}`}
            >
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border ${STATUS_COLORS[s]}`}>
                <StatusIcon status={s} />
              </span>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
