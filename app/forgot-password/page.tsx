'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Music, Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { forgotPassword } from '@/lib/api-client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      await forgotPassword(email.trim())
      setDone(true)
    } catch {
      // Auch bei Fehler neutral bleiben (kein Leak), aber Hinweis geben
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto h-14 w-14 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
            <Music className="h-7 w-7 text-gray-900" />
          </div>
          <h1 className="mt-5 text-3xl font-bold text-white tracking-tight">Passwort vergessen</h1>
          <p className="mt-1 text-sm text-gray-400">Wir schicken dir einen Link zum Zurücksetzen.</p>
        </div>

        {done ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-white font-medium">Prüfe dein Postfach</p>
            <p className="text-gray-400 text-sm">
              Falls ein Konto mit dieser Adresse existiert, haben wir eine E-Mail mit einem Link zum Zurücksetzen verschickt. Der Link ist 1 Stunde gültig.
            </p>
            <Link href="/login" className="inline-flex items-center gap-1 text-sm text-yellow-400 hover:text-yellow-300 mt-2">
              <ArrowLeft className="w-4 h-4" /> Zurück zum Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-sm text-red-300">{error}</div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">E-Mail</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="deine@email.de"
                  required
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Wird gesendet…' : 'Link anfordern'}
            </button>
            <div className="text-center">
              <Link href="/login" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4" /> Zurück zum Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
