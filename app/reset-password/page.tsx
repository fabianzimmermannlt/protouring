'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Music, Lock, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import { validateResetToken, resetPassword } from '@/lib/api-client'

function ResetPasswordInner() {
  const params = useSearchParams()
  const token = params.get('token') || ''

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [email, setEmail] = useState('')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) { setLoadError('Kein Token angegeben'); setLoading(false); return }
    validateResetToken(token)
      .then(d => setEmail(d.email))
      .catch(err => setLoadError(err?.message ?? 'Link ungültig oder abgelaufen'))
      .finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setSaveError('Passwörter stimmen nicht überein'); return }
    if (password.length < 6) { setSaveError('Passwort muss mindestens 6 Zeichen lang sein'); return }
    setSaving(true)
    setSaveError('')
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err: any) {
      setSaveError(err?.message ?? 'Fehler beim Zurücksetzen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto h-14 w-14 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
            <Music className="h-7 w-7 text-gray-900" />
          </div>
          <h1 className="mt-5 text-3xl font-bold text-white tracking-tight">Neues Passwort</h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          {loading && (
            <div className="flex items-center justify-center gap-2 text-gray-400 py-6">
              <Loader2 className="animate-spin w-5 h-5" /> Link wird geprüft…
            </div>
          )}

          {!loading && loadError && (
            <div className="text-center py-6 space-y-3">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
              <p className="text-white font-medium">Link ungültig</p>
              <p className="text-gray-400 text-sm">{loadError}</p>
              <Link href="/forgot-password" className="inline-block text-sm text-yellow-400 hover:text-yellow-300 mt-1">
                Neuen Link anfordern
              </Link>
            </div>
          )}

          {!loading && done && (
            <div className="text-center py-6 space-y-3">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <p className="text-white font-medium">Passwort geändert</p>
              <p className="text-gray-400 text-sm">Du kannst dich jetzt mit deinem neuen Passwort anmelden.</p>
              <Link href="/login" className="inline-flex items-center gap-1 text-sm text-yellow-400 hover:text-yellow-300 mt-1">
                <ArrowLeft className="w-4 h-4" /> Zum Login
              </Link>
            </div>
          )}

          {!loading && !loadError && !done && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-gray-400 text-sm">Für <span className="text-gray-200 font-medium">{email}</span></p>

              {saveError && (
                <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-sm text-red-300">{saveError}</div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Neues Passwort</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                    placeholder="Mindestens 6 Zeichen"
                    className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Passwort bestätigen</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    placeholder="Passwort wiederholen"
                    className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Wird gespeichert…' : 'Passwort speichern'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <ResetPasswordInner />
    </Suspense>
  )
}
