'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Music, Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { getInviteToken, acceptInvite, setAuthSession, ROLE_LABELS } from '@/lib/api-client'
import type { InviteToken } from '@/lib/api-client'

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [invite, setInvite] = useState<InviteToken | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) return
    getInviteToken(token)
      .then(data => setInvite(data))
      .catch(err => setLoadError(err?.message ?? 'Einladung nicht gefunden oder abgelaufen'))
      .finally(() => setLoading(false))
  }, [token])

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invite) return

    // Neuer User: Passwort prüfen
    if (!invite.userExists) {
      if (password !== confirmPassword) { setSaveError('Passwörter stimmen nicht überein'); return }
      if (password.length < 6) { setSaveError('Passwort muss mindestens 6 Zeichen lang sein'); return }
    }

    setSaving(true)
    setSaveError('')
    try {
      const res = await acceptInvite(token, invite.userExists ? undefined : password)
      setAuthSession(res.token, res.currentTenant, res.user)
      setDone(true)
      setTimeout(() => router.push('/'), 1500)
    } catch (err: any) {
      setSaveError(err?.message ?? 'Fehler beim Aktivieren')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">ProTouring</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {loading && (
            <div className="flex items-center justify-center gap-2 text-gray-500 py-8">
              <Loader2 className="animate-spin w-5 h-5" />
              Einladung wird geladen…
            </div>
          )}

          {!loading && loadError && (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-gray-700 font-medium">Einladung ungültig</p>
              <p className="text-gray-500 text-sm mt-1">{loadError}</p>
            </div>
          )}

          {!loading && done && (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-700 font-medium text-lg">Willkommen!</p>
              <p className="text-gray-500 text-sm mt-1">Du wirst weitergeleitet…</p>
            </div>
          )}

          {!loading && invite && !done && (
            <form onSubmit={handleAccept} className="space-y-5">
              {/* Einladungs-Info */}
              <div>
                <p className="text-gray-500 text-sm mb-1">Du wurdest eingeladen zu</p>
                <p className="text-gray-900 font-semibold text-lg">{invite.tenantName}</p>
                <p className="text-gray-500 text-sm mt-0.5">
                  Rolle: <span className="font-medium text-gray-700">{ROLE_LABELS[invite.role] ?? invite.role}</span>
                </p>
              </div>

              <hr className="border-gray-100" />

              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {saveError}
                </div>
              )}

              {/* E-Mail (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <input
                  type="email"
                  value={invite.email}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm"
                />
              </div>

              {/* Existierender User: nur Beitreten-Button */}
              {invite.userExists ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
                  Dein Account existiert bereits. Klicke auf „Beitreten" um dem Artist beizutreten.
                </div>
              ) : (
                /* Neuer User: Passwort setzen */
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Passwort festlegen</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="Mindestens 6 Zeichen"
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required
                        placeholder="Passwort wiederholen"
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><Loader2 className="animate-spin w-4 h-4" /> Wird aktiviert…</>
                ) : (
                  'Beitreten'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
