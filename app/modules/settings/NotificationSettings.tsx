'use client'

import { useEffect, useState } from 'react'
import { BellIcon } from '@heroicons/react/24/outline'
import { getNotificationPrefs, saveNotificationPrefs, type NotificationPrefs } from '@/lib/api-client'
import { getPushState, enablePush, disablePush, type PushState } from '@/lib/push'

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  const [pushState, setPushState] = useState<PushState>('default')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushErr, setPushErr] = useState('')

  useEffect(() => {
    getNotificationPrefs().then(d => setPrefs(d.prefs)).catch(() => setPrefs({})).finally(() => setLoading(false))
    getPushState().then(setPushState).catch(() => setPushState('unsupported'))
  }, [])

  const persist = async (next: NotificationPrefs) => {
    setPrefs(next)
    const payload: Record<string, { inApp: boolean; email: boolean; push: boolean }> = {}
    for (const [k, v] of Object.entries(next)) payload[k] = { inApp: v.inApp, email: v.email, push: v.push }
    try {
      await saveNotificationPrefs(payload)
      setSaved(true); setTimeout(() => setSaved(false), 1500)
    } catch { /* still */ }
  }

  const toggle = (key: string, channel: 'inApp' | 'email' | 'push') => {
    if (!prefs) return
    persist({ ...prefs, [key]: { ...prefs[key], [channel]: !prefs[key][channel] } })
  }

  const doEnablePush = async () => {
    setPushBusy(true); setPushErr('')
    try { setPushState(await enablePush()) }
    catch (e: any) { setPushErr(e?.message ?? 'Aktivierung fehlgeschlagen') }
    finally { setPushBusy(false) }
  }
  const doDisablePush = async () => {
    setPushBusy(true); setPushErr('')
    try { setPushState(await disablePush()) }
    catch { /* ignore */ }
    finally { setPushBusy(false) }
  }

  if (loading) return <div className="text-sm text-gray-400 py-6">Lädt…</div>

  const entries = prefs ? Object.entries(prefs) : []
  const pushActive = pushState === 'subscribed'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
          <BellIcon className="w-5 h-5" /> Benachrichtigungen
        </h3>
        {saved && <span className="text-xs text-green-400">Gespeichert ✓</span>}
      </div>
      <p className="text-sm text-gray-400">Lege fest, worüber du wie informiert werden möchtest.</p>

      {/* Push auf diesem Gerät */}
      <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--surface-2)]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-medium text-gray-100">Push auf diesem Gerät</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {pushState === 'subscribed' && '✓ Aktiv – dieses Gerät erhält Push-Benachrichtigungen.'}
              {(pushState === 'unsubscribed' || pushState === 'default') && 'Noch nicht aktiviert.'}
              {pushState === 'denied' && 'In den Browser-/Systemeinstellungen blockiert – dort erlauben.'}
              {pushState === 'unsupported' && 'Nicht verfügbar. Auf dem iPhone: App zuerst „Zum Home-Bildschirm" hinzufügen, dann hier aktivieren.'}
            </div>
          </div>
          {pushActive ? (
            <button onClick={doDisablePush} disabled={pushBusy}
              className="text-xs px-3 py-1.5 rounded border border-[var(--border-strong)] text-gray-200 hover:bg-[var(--surface)]">
              {pushBusy ? '…' : 'Deaktivieren'}
            </button>
          ) : (
            <button onClick={doEnablePush} disabled={pushBusy || pushState === 'unsupported' || pushState === 'denied'}
              className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50">
              {pushBusy ? 'Aktiviere…' : 'Auf diesem Gerät aktivieren'}
            </button>
          )}
        </div>
        {pushErr && <p className="text-xs text-red-400 mt-2">{pushErr}</p>}
      </div>

      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_70px_70px_70px] items-center px-4 py-2 bg-[var(--surface)] border-b border-[var(--border)] text-xs font-medium text-gray-400">
          <span>Ereignis</span>
          <span className="text-center">In-App</span>
          <span className="text-center">E-Mail</span>
          <span className="text-center">Push</span>
        </div>
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500 text-center">Keine Benachrichtigungs-Typen verfügbar.</p>
        ) : entries.map(([key, v]) => (
          <div key={key} className="grid grid-cols-[1fr_70px_70px_70px] items-center px-4 py-3 border-b border-[var(--surface)] last:border-b-0">
            <span className="text-sm text-gray-200 pr-2">{v.label}</span>
            <div className="flex justify-center">
              <input type="checkbox" checked={v.inApp} onChange={() => toggle(key, 'inApp')} className="w-4 h-4 accent-blue-500 cursor-pointer" />
            </div>
            <div className="flex justify-center">
              <input type="checkbox" checked={v.email} onChange={() => toggle(key, 'email')} className="w-4 h-4 accent-blue-500 cursor-pointer" />
            </div>
            <div className="flex justify-center">
              <input type="checkbox" checked={v.push} onChange={() => toggle(key, 'push')} className="w-4 h-4 accent-blue-500 cursor-pointer"
                title={pushActive ? undefined : 'Erst „Auf diesem Gerät aktivieren", damit Push ankommt'} />
            </div>
          </div>
        ))}
      </div>
      {!pushActive && (
        <p className="text-xs text-gray-500">Hinweis: Push-Häkchen legen nur fest, <em>wofür</em> Push gilt. Damit es auf diesem Gerät ankommt, oben „Auf diesem Gerät aktivieren".</p>
      )}
    </div>
  )
}
