'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, X, ChevronDown, Check, Clock, Circle } from 'lucide-react'
import {
  createFeedback, getFeedback, updateFeedbackStatus, deleteFeedback,
  getCurrentUser, type FeedbackItem,
} from '@/lib/api-client'

const STATUS_LABELS: Record<string, string> = {
  open: 'Offen',
  in_progress: 'In Arbeit',
  done: 'Erledigt',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'done') return <Check className="w-3.5 h-3.5" />
  if (status === 'in_progress') return <Clock className="w-3.5 h-3.5" />
  return <Circle className="w-3.5 h-3.5" />
}

export function FeedbackButton() {
  const currentUser = getCurrentUser()
  const isSuperadmin = Boolean((currentUser as any)?.isSuperadmin)

  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'form' | 'list'>('form')
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Form state
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)

  // Liste laden wenn geöffnet oder bei View-Wechsel zu 'list'
  useEffect(() => {
    if (isOpen && view === 'list') {
      loadItems()
    }
  }, [isOpen, view])

  // Klick außerhalb schließt Panel
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const loadItems = async () => {
    setLoadingList(true)
    try {
      const data = await getFeedback()
      setItems(data)
      // Ungelesene offene Items zählen (nur für Superadmin sinnvoll)
      if (isSuperadmin) {
        setUnreadCount(data.filter(i => i.status === 'open').length)
      }
    } catch { /* ignore */ }
    finally { setLoadingList(false) }
  }

  const handleOpen = () => {
    setIsOpen(true)
    setView(isSuperadmin ? 'list' : 'form')
    setSubmitted(false)
    setSubmitError('')
    if (isSuperadmin) loadItems()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) { setSubmitError('Thema ist erforderlich'); return }
    setSubmitting(true)
    setSubmitError('')
    try {
      await createFeedback(topic.trim(), description.trim(), isPrivate)
      setSubmitted(true)
      setTopic('')
      setDescription('')
      setIsPrivate(false)
    } catch (err: any) {
      setSubmitError(err?.message ?? 'Fehler beim Senden')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (id: number, status: 'open' | 'in_progress' | 'done') => {
    try {
      const updated = await updateFeedbackStatus(id, status)
      setItems(prev => prev.map(i => i.id === id ? updated : i))
      setUnreadCount(prev => status === 'done' ? Math.max(0, prev - 1) : prev)
    } catch { /* ignore */ }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteFeedback(id)
      setItems(prev => prev.filter(i => i.id !== id))
    } catch { /* ignore */ }
  }

  // Für Superadmin: offene Items zählen beim Laden
  useEffect(() => {
    if (isSuperadmin) {
      getFeedback()
        .then(data => setUnreadCount(data.filter(i => i.status === 'open').length))
        .catch(() => {})
    }
  }, [isSuperadmin])

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-105 active:scale-95"
        title="Feedback senden"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <span className="text-sm font-medium">Feedback</span>
        {isSuperadmin && unreadCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none">
          <div
            ref={panelRef}
            className="pointer-events-auto bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden border border-gray-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900">Feedback</h3>
                {/* Tab-Switch */}
                <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setView('form')}
                    className={`px-3 py-1 rounded-md transition-colors ${view === 'form' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Neu
                  </button>
                  <button
                    onClick={() => { setView('list'); loadItems() }}
                    className={`px-3 py-1 rounded-md transition-colors ${view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {isSuperadmin ? 'Alle Meldungen' : 'Meine Meldungen'}
                    {isSuperadmin && unreadCount > 0 && (
                      <span className="ml-1.5 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-xs font-bold">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {view === 'form' && (
                <div className="p-5">
                  {submitted ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Check className="w-6 h-6 text-green-600" />
                      </div>
                      <p className="font-medium text-gray-900">Danke!</p>
                      <p className="text-sm text-gray-500 mt-1">Dein Feedback wurde übermittelt.</p>
                      <button
                        onClick={() => setSubmitted(false)}
                        className="mt-4 text-sm text-blue-600 hover:underline"
                      >
                        Weiteres Feedback senden
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {submitError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{submitError}</div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Thema <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={topic}
                          onChange={e => setTopic(e.target.value)}
                          placeholder="z.B. Kalender zeigt falsches Datum"
                          autoFocus
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Beschreibung <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <textarea
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          placeholder="Was genau ist passiert? Wie kann man es reproduzieren?"
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isPrivate}
                          onChange={e => setIsPrivate(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600">
                          Nur für den Entwickler sichtbar
                        </span>
                      </label>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {submitting && <Loader2 className="animate-spin w-4 h-4" />}
                        Absenden
                      </button>
                    </form>
                  )}
                </div>
              )}

              {view === 'list' && (
                <div>
                  {loadingList ? (
                    <div className="flex items-center justify-center gap-2 text-gray-500 text-sm py-10">
                      <Loader2 className="animate-spin w-4 h-4" /> Wird geladen…
                    </div>
                  ) : items.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-10">
                      Noch kein Feedback vorhanden
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {items.map(item => (
                        <FeedbackItemRow
                          key={item.id}
                          item={item}
                          isSuperadmin={isSuperadmin}
                          currentUserId={currentUser?.id}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Einzelne Feedback-Zeile ─────────────────────────────────────────────────

function FeedbackItemRow({
  item,
  isSuperadmin,
  currentUserId,
  onStatusChange,
  onDelete,
}: {
  item: FeedbackItem
  isSuperadmin: boolean
  currentUserId?: number
  onStatusChange: (id: number, status: 'open' | 'in_progress' | 'done') => void
  onDelete: (id: number) => void
}) {
  const [showDesc, setShowDesc] = useState(false)
  const canDelete = isSuperadmin

  const date = new Date(item.createdAt).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <div className={`px-5 py-4 ${item.status === 'done' ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Status-Badge (Superadmin: klickbar) */}
        <div className="flex-shrink-0 pt-0.5">
          {isSuperadmin ? (
            <StatusDropdown
              status={item.status}
              onChange={s => onStatusChange(item.id, s)}
            />
          ) : (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status]}`}>
              <StatusIcon status={item.status} />
              {STATUS_LABELS[item.status]}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium text-gray-900 leading-snug ${item.status === 'done' ? 'line-through text-gray-400' : ''}`}>
              {item.topic}
            </p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {item.private && (
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded" title="Nur für Entwickler">🔒</span>
              )}
              {item.description && (
                <button
                  onClick={() => setShowDesc(v => !v)}
                  className="p-0.5 text-gray-400 hover:text-gray-600"
                  title="Details"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showDesc ? 'rotate-180' : ''}`} />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => onDelete(item.id)}
                  className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                  title="Löschen"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-0.5">
            {item.userName}
            {item.tenantName && <span className="text-gray-300"> · {item.tenantName}</span>}
            <span className="text-gray-300"> · {date}</span>
          </p>

          {showDesc && item.description && (
            <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
              {item.description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Status-Dropdown (nur Superadmin) ────────────────────────────────────────

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
        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status]} hover:opacity-80 transition-opacity`}
      >
        <StatusIcon status={status} />
        {STATUS_LABELS[status]}
        <ChevronDown className="w-3 h-3 ml-0.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden min-w-[130px]">
          {(['open', 'in_progress', 'done'] as const).map(s => (
            <button
              key={s}
              onClick={() => { onChange(s); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${status === s ? 'font-semibold' : ''}`}
            >
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${STATUS_COLORS[s]}`}>
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
