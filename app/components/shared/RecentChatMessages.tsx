'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Loader2, ExternalLink } from 'lucide-react'
import { getAuthToken, getCurrentTenant } from '@/lib/api-client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || (
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3002`
    : 'http://localhost:3002'
)

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  const token = getAuthToken()
  const tenant = getCurrentTenant()
  if (token) h['Authorization'] = `Bearer ${token}`
  if (tenant?.slug) h['X-Tenant-Slug'] = tenant.slug
  return h
}

interface RecentMessage {
  id: number
  entity_id: string
  user_id: number
  user_name: string
  text: string
  created_at: string
  termin_title: string | null
  termin_date: string | null
  termin_city: string | null
}

function fmtDateTime(dt: string): string {
  try {
    const d = new Date(dt)
    const now = new Date()
    const diffH = (now.getTime() - d.getTime()) / 3600_000
    if (diffH < 1) return 'Gerade eben'
    if (diffH < 24) return `vor ${Math.floor(diffH)} Std.`
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
      + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  } catch { return dt }
}

function terminLabel(msg: RecentMessage): string {
  if (msg.termin_title) return msg.termin_title
  if (msg.termin_city) return msg.termin_city
  return `Termin #${msg.entity_id}`
}

interface Props {
  currentUserId?: number
  hideHeader?: boolean
}

export default function RecentChatMessages({ currentUserId, hideHeader }: Props) {
  const [messages, setMessages] = useState<RecentMessage[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/recent?hours=48`, { headers: authHeaders() })
      if (!res.ok) return
      const data = await res.json()
      setMessages(data.messages ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openTermin = (entityId: string) => {
    window.location.href = `/appointments/${entityId}/details`
  }

  return (
    <div className="pt-card">
      {!hideHeader && (
        <div className="pt-card-header">
          <span className="pt-card-title">
            <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
            Letzte Nachrichten
          </span>
          <button onClick={load} className="text-gray-400 hover:text-blue-600 transition-colors" title="Aktualisieren">
            <Loader2 className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}
      <div className="pt-card-body">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-sm">Lade…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-gray-400">
            <MessageSquare className="w-5 h-5 mb-1" />
            <span className="text-xs">Keine Nachrichten in den letzten 48h</span>
          </div>
        ) : (
          <div className="space-y-0.5">
            {messages.map(msg => (
              <div
                key={msg.id}
                onClick={() => openTermin(msg.entity_id)}
                className="group flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                {/* Avatar */}
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {msg.user_name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-gray-800">
                      {msg.user_name}
                      {currentUserId && msg.user_id === currentUserId && (
                        <span className="text-gray-400 font-normal"> (ich)</span>
                      )}
                    </span>
                    <span className="text-gray-300 text-xs">·</span>
                    <span className="text-xs text-blue-600 font-medium truncate">{terminLabel(msg)}</span>
                    <span className="text-gray-300 text-xs">·</span>
                    <span className="text-xs text-gray-400">{fmtDateTime(msg.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-2 leading-relaxed">{msg.text}</p>
                </div>
                {/* Arrow */}
                <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-blue-500 shrink-0 mt-1 transition-colors" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
