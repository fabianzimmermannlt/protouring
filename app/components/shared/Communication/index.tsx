'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, MessageCircle, User, Trash2, Pencil, X, Check } from 'lucide-react'
import { getAuthToken, getCurrentTenant, getCurrentUser, getEffectiveRole } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

export interface Message {
  id: number
  userId: number
  userName: string
  text: string
  createdAt: string
}

export interface CommunicationProps {
  title?: string
  placeholder?: string
  /** @deprecated – wird ignoriert, nur noch für Abwärtskompatibilität */
  storageKey?: string
  entityType?: string
  entityId?: string
  maxHeight?: string
  showHeader?: boolean
  enableInput?: boolean
  className?: string
  /** @deprecated – wird vom Backend bestimmt */
  userName?: string
  userRole?: string
}

// ============================================================
// API helpers
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || (
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3002`
    : 'http://localhost:3002'
)

function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  const tenant = getCurrentTenant()
  const h: Record<string, string> = {}
  if (token) h['Authorization'] = `Bearer ${token}`
  if (tenant) h['X-Tenant-Slug'] = tenant.slug
  return h
}

async function apiLoad(entityType: string, entityId: string, since = 0): Promise<Message[]> {
  const res = await fetch(
    `${API_BASE}/api/chat/${entityType}/${entityId}?since=${since}`,
    { headers: authHeaders() }
  )
  if (!res.ok) throw new Error('Load failed')
  return (await res.json()).messages ?? []
}

async function apiSend(entityType: string, entityId: string, text: string): Promise<Message> {
  const res = await fetch(`${API_BASE}/api/chat/${entityType}/${entityId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error('Send failed')
  return (await res.json()).message
}

async function apiClear(entityType: string, entityId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat/${entityType}/${entityId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Clear failed')
}

async function apiEditMessage(messageId: number, text: string): Promise<Message> {
  const res = await fetch(`${API_BASE}/api/chat/message/${messageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error('Edit failed')
  return (await res.json()).message
}

async function apiDeleteMessage(messageId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat/message/${messageId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Delete failed')
}

// ============================================================
// Component
// ============================================================

const POLL_INTERVAL = 5000 // ms

export function Communication({
  title = 'Kommunikation',
  placeholder = 'Nachricht eingeben...',
  entityType = 'desk',
  entityId = 'general',
  maxHeight = 'h-[400px]',
  showHeader = true,
  enableInput = true,
  className = '',
}: CommunicationProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastIdRef = useRef(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentUser = getCurrentUser()
  const currentUserId = currentUser?.id
  const isAdmin = getEffectiveRole() === 'admin'

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')

  // Initiales Laden + Polling starten
  const loadAll = useCallback(async () => {
    try {
      const msgs = await apiLoad(entityType, entityId, 0)
      setMessages(msgs)
      if (msgs.length > 0) lastIdRef.current = msgs[msgs.length - 1].id
    } catch {
      setError('Chat konnte nicht geladen werden')
    }
  }, [entityType, entityId])

  const pollNew = useCallback(async () => {
    try {
      const newMsgs = await apiLoad(entityType, entityId, lastIdRef.current)
      if (newMsgs.length > 0) {
        setMessages(prev => [...prev, ...newMsgs])
        lastIdRef.current = newMsgs[newMsgs.length - 1].id
      }
    } catch {
      // Polling-Fehler still ignorieren
    }
  }, [entityType, entityId])

  useEffect(() => {
    loadAll()
    pollRef.current = setInterval(pollNew, POLL_INTERVAL)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadAll, pollNew])

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current?.parentElement) {
      messagesEndRef.current.parentElement.scrollTop =
        messagesEndRef.current.parentElement.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!inputText.trim() || sending) return
    setSending(true)
    setError('')
    try {
      const msg = await apiSend(entityType, entityId, inputText.trim())
      setMessages(prev => [...prev, msg])
      lastIdRef.current = msg.id
      setInputText('')
      if (textareaRef.current) { textareaRef.current.style.height = '38px' }
    } catch {
      setError('Nachricht konnte nicht gesendet werden')
    } finally {
      setSending(false)
    }
  }

  const handleEditSave = async (msgId: number) => {
    if (!editingText.trim()) return
    try {
      const updated = await apiEditMessage(msgId, editingText)
      setMessages(prev => prev.map(m => m.id === updated.id ? updated : m))
      setEditingId(null)
    } catch { setError('Bearbeiten fehlgeschlagen') }
  }

  const handleDeleteMessage = async (msgId: number) => {
    try {
      await apiDeleteMessage(msgId)
      setMessages(prev => prev.filter(m => m.id !== msgId))
    } catch { setError('Löschen fehlgeschlagen') }
  }

  const handleClear = async () => {
    try {
      await apiClear(entityType, entityId)
      setMessages([])
      lastIdRef.current = 0
      setShowDeleteConfirm(false)
    } catch {
      setError('Löschen fehlgeschlagen')
    }
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className={`bg-white flex flex-col ${maxHeight} ${className}`}>
      {showHeader && (
        <div className="pt-card-header">
          <span className="pt-card-title">{title}</span>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-gray-400 hover:text-red-500 transition-colors"
            title="Chat löschen"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Nachrichten */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && (
          <div className="text-center text-xs text-red-400 py-2">{error}</div>
        )}

        {messages.length === 0 && !error ? (
          <div className="text-center text-gray-400 py-8">
            <MessageCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <div className="text-sm">Noch keine Nachrichten</div>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.userId === currentUserId
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                {!isOwn && (
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                    <User className="w-3 h-3" />
                  </div>
                )}

                <div className={`max-w-[75%] flex flex-col ${isOwn ? 'items-end' : 'items-start'} group`}>
                  {editingId === msg.id ? (
                    /* Edit-Modus */
                    <div className="flex flex-col gap-1 w-full">
                      <textarea
                        value={editingText}
                        onChange={e => setEditingText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave(msg.id) }
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="text-xs border border-blue-400 rounded-lg px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[160px]"
                        rows={2}
                        autoFocus
                      />
                      <div className={`flex gap-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <button onClick={() => handleEditSave(msg.id)} className="text-green-600 hover:text-green-700 p-0.5" title="Speichern"><Check size={13} /></button>
                        <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-0.5" title="Abbrechen"><X size={13} /></button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <div className={`pt-chat-bubble ${isOwn ? 'pt-chat-bubble-own' : 'pt-chat-bubble-other'}`}>
                          {msg.text}
                        </div>
                        {/* Admin-Aktionen — erscheinen beim Hover */}
                        {isAdmin && (
                          <div className={`absolute top-0 ${isOwn ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'} flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity`}>
                            <button
                              onClick={() => { setEditingId(msg.id); setEditingText(msg.text) }}
                              className="p-1 rounded bg-white shadow-sm border border-gray-200 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Bearbeiten"
                            >
                              <Pencil size={10} />
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="p-1 rounded bg-white shadow-sm border border-gray-200 text-gray-400 hover:text-red-600 transition-colors"
                              title="Löschen"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="pt-chat-meta">
                        <span className="pt-chat-meta-name">{msg.userName}</span>
                        <span className="mx-1">·</span>
                        {formatTime(msg.createdAt)}
                      </div>
                    </>
                  )}
                </div>

                {isOwn && (
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                    <User className="w-3 h-3" />
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {enableInput && (
        <div className="border-t p-3">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={e => {
                setInputText(e.target.value)
                // Auto-resize
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={placeholder}
              rows={1}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-green-500 focus:border-transparent resize-none overflow-hidden leading-5"
              style={{ minHeight: '38px' }}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || sending}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Löschen-Bestätigung */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-3 rounded-lg z-10">
          <p className="text-sm font-medium text-gray-800">Chat wirklich löschen?</p>
          <div className="flex gap-2">
            <button onClick={handleClear} className="btn btn-danger text-xs px-3 py-1.5">Löschen</button>
            <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-secondary text-xs px-3 py-1.5">Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Communication
