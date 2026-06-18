'use client'

import { useState, useEffect } from 'react'
import { getMailSettings, saveMailSettings, sendTestMail, type MailSettings } from '@/lib/api-client'

// SMTP/E-Mail-Konfiguration (nur Superadmin). Passwort/API-Key wird serverseitig
// verschlüsselt gespeichert und nie an den Client zurückgegeben.
export function MailSettingsSection() {
  const [s, setS] = useState<MailSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [testTo, setTestTo] = useState('')
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState('')

  useEffect(() => {
    getMailSettings().then(d => { setS(d); setLoading(false) }).catch(e => { setErr(e.message); setLoading(false) })
  }, [])

  const upd = (patch: Partial<MailSettings>) => setS(prev => (prev ? { ...prev, ...patch } : prev))

  const save = async () => {
    if (!s) return
    setSaving(true); setMsg(''); setErr('')
    try {
      await saveMailSettings({
        host: s.host, port: Number(s.port) || 587, secure: s.secure, username: s.username,
        password: password || undefined, fromEmail: s.fromEmail, fromName: s.fromName,
        replyTo: s.replyTo, enabled: s.enabled,
      })
      setPassword('')
      const fresh = await getMailSettings(); setS(fresh)
      setMsg('Gespeichert.'); setTimeout(() => setMsg(''), 2000)
    } catch (e: any) { setErr(e.message || 'Fehler beim Speichern') }
    finally { setSaving(false) }
  }

  const test = async () => {
    if (!testTo.trim()) return
    setTesting(true); setTestMsg('')
    try {
      await sendTestMail(testTo.trim())
      setTestMsg('✓ Test-Mail verschickt – ins Postfach bzw. Resend-Dashboard schauen.')
    } catch (e: any) { setTestMsg('✗ ' + (e.message || 'Fehler')) }
    finally { setTesting(false) }
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Lädt…</div>
  if (!s) return <div className="text-sm text-red-400 py-4">{err || 'Konnte nicht laden.'}</div>

  const input = 'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500'
  const lbl = 'block text-xs font-medium text-gray-400 mb-1'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">E-Mail / SMTP</h3>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={s.enabled} onChange={e => upd({ enabled: e.target.checked })} /> aktiv
        </label>
      </div>
      <p className="text-xs text-gray-500">Globaler Mailversand (Login, Einladungen, Benachrichtigungen). Passwort/API-Key wird verschlüsselt gespeichert.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={lbl}>SMTP-Host</label><input className={input} value={s.host} onChange={e => upd({ host: e.target.value })} placeholder="smtp.resend.com" /></div>
        <div className="flex gap-3 items-end">
          <div className="flex-1"><label className={lbl}>Port</label><input className={input} type="number" value={s.port} onChange={e => upd({ port: Number(e.target.value) })} placeholder="587" /></div>
          <label className="flex items-center gap-2 text-sm text-gray-300 pb-2 whitespace-nowrap"><input type="checkbox" checked={s.secure} onChange={e => upd({ secure: e.target.checked })} /> TLS (465)</label>
        </div>
        <div><label className={lbl}>Benutzer</label><input className={input} value={s.username} onChange={e => upd({ username: e.target.value })} placeholder="resend" /></div>
        <div><label className={lbl}>Passwort / API-Key</label><input className={input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={s.hasPassword ? '•••••••• (gesetzt – leer = behalten)' : 'eingeben'} /></div>
        <div><label className={lbl}>Absender (From)</label><input className={input} value={s.fromEmail} onChange={e => upd({ fromEmail: e.target.value })} placeholder="noreply@protouring.de" /></div>
        <div><label className={lbl}>Absender-Name</label><input className={input} value={s.fromName} onChange={e => upd({ fromName: e.target.value })} placeholder="ProTouring" /></div>
        <div className="sm:col-span-2"><label className={lbl}>Reply-To</label><input className={input} value={s.replyTo} onChange={e => upd({ replyTo: e.target.value })} placeholder="info@protouring.de" /></div>
      </div>

      {err && <div className="text-sm text-red-400">{err}</div>}
      {msg && <div className="text-sm text-green-400">{msg}</div>}

      <div>
        <button onClick={save} disabled={saving} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
      </div>

      <div className="border-t border-gray-700 pt-3">
        <label className={lbl}>Test-Mail an</label>
        <div className="flex gap-2">
          <input className={input} value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="deine@adresse.de" />
          <button onClick={test} disabled={testing || !testTo.trim()} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm whitespace-nowrap disabled:opacity-50">
            {testing ? 'Sende…' : 'Test senden'}
          </button>
        </div>
        {testMsg && <div className="text-sm mt-1 text-gray-300">{testMsg}</div>}
      </div>
    </div>
  )
}
