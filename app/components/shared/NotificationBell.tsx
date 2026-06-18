'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Bell, Check } from 'lucide-react'
import {
  getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead,
  type AppNotification,
} from '@/lib/api-client'

function relTime(iso: string): string {
  const d = new Date(iso.includes('Z') || iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'gerade eben'
  if (min < 60) return `vor ${min} Min.`
  const h = Math.floor(min / 60)
  if (h < 24) return `vor ${h} Std.`
  const days = Math.floor(h / 24)
  if (days < 7) return `vor ${days} Tg.`
  return d.toLocaleDateString('de-DE')
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const refreshCount = useCallback(async () => {
    try { const { count } = await getUnreadCount(); setCount(count) } catch { /* still */ }
  }, [])

  // Polling des Ungelesen-Zählers
  useEffect(() => {
    refreshCount()
    const t = setInterval(refreshCount, 60000)
    return () => clearInterval(t)
  }, [refreshCount])

  // Outside-Click schließt Dropdown
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    try { const { notifications } = await getNotifications(30); setItems(notifications) }
    catch { /* still */ }
    finally { setLoading(false) }
  }, [])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) loadList()
  }

  const onItemClick = async (n: AppNotification) => {
    if (!n.read_at) {
      try { await markNotificationRead(n.id) } catch { /* still */ }
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
      setCount(c => Math.max(0, c - 1))
    }
    if (n.link) { window.location.href = n.link }
    else setOpen(false)
  }

  const markAll = async () => {
    try { await markAllNotificationsRead() } catch { /* still */ }
    setItems(prev => prev.map(x => ({ ...x, read_at: x.read_at || new Date().toISOString() })))
    setCount(0)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        title="Benachrichtigungen"
        className="relative flex items-center justify-center w-7 h-7 rounded transition-colors"
        style={{ color: open ? '#f5c518' : '#9ca3af' }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.color = '#d1d5db' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.color = '#9ca3af' }}
      >
        <Bell size={16} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-[9999]"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Benachrichtigungen</span>
            {items.some(i => !i.read_at) && (
              <button onClick={markAll} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <Check size={12} /> Alle gelesen
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-6 text-center text-xs text-gray-400">Lädt…</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-gray-400">Keine Benachrichtigungen</p>
            ) : (
              items.map(n => (
                <button
                  key={n.id}
                  onClick={() => onItemClick(n)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition-colors hover:bg-gray-50 ${n.read_at ? '' : 'bg-blue-50/50'}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    <div className={`min-w-0 flex-1 ${n.read_at ? 'pl-3.5' : ''}`}>
                      <p className="text-sm text-gray-800 font-medium truncate">{n.title}</p>
                      {n.body && <p className="text-xs text-gray-500 leading-snug mt-0.5">{n.body}</p>}
                      <p className="text-[11px] text-gray-400 mt-1">{relTime(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
