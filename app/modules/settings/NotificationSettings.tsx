'use client'

import { useEffect, useState } from 'react'
import { BellIcon } from '@heroicons/react/24/outline'
import { getNotificationPrefs, saveNotificationPrefs, type NotificationPrefs } from '@/lib/api-client'

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getNotificationPrefs().then(d => setPrefs(d.prefs)).catch(() => setPrefs({})).finally(() => setLoading(false))
  }, [])

  const persist = async (next: NotificationPrefs) => {
    setPrefs(next)
    const payload: Record<string, { inApp: boolean; email: boolean }> = {}
    for (const [k, v] of Object.entries(next)) payload[k] = { inApp: v.inApp, email: v.email }
    try {
      await saveNotificationPrefs(payload)
      setSaved(true); setTimeout(() => setSaved(false), 1500)
    } catch { /* still */ }
  }

  const toggle = (key: string, channel: 'inApp' | 'email') => {
    if (!prefs) return
    persist({ ...prefs, [key]: { ...prefs[key], [channel]: !prefs[key][channel] } })
  }

  if (loading) return <div className="text-sm text-gray-500 py-6">Lädt…</div>

  const entries = prefs ? Object.entries(prefs) : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <BellIcon className="w-5 h-5" /> Benachrichtigungen
        </h3>
        {saved && <span className="text-xs text-green-600">Gespeichert ✓</span>}
      </div>
      <p className="text-sm text-gray-500">Lege fest, worüber du wie informiert werden möchtest.</p>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_70px_70px_70px] items-center px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
          <span>Ereignis</span>
          <span className="text-center">In-App</span>
          <span className="text-center">E-Mail</span>
          <span className="text-center">Push</span>
        </div>
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">Keine Benachrichtigungs-Typen verfügbar.</p>
        ) : entries.map(([key, v]) => (
          <div key={key} className="grid grid-cols-[1fr_70px_70px_70px] items-center px-4 py-3 border-b border-gray-100 last:border-b-0">
            <span className="text-sm text-gray-800 pr-2">{v.label}</span>
            <div className="flex justify-center">
              <input type="checkbox" checked={v.inApp} onChange={() => toggle(key, 'inApp')} className="w-4 h-4 accent-blue-600 cursor-pointer" />
            </div>
            <div className="flex justify-center">
              <input type="checkbox" checked={v.email} onChange={() => toggle(key, 'email')} className="w-4 h-4 accent-blue-600 cursor-pointer" />
            </div>
            <div className="flex justify-center">
              <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded" title="In Entwicklung">bald</span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400">Push-Benachrichtigungen (Browser/Handy) folgen in einer späteren Version.</p>
    </div>
  )
}
