'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Music, Lock, Mail, User, Building } from 'lucide-react'
import { login, register, setAuthSession } from '@/lib/api-client'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [regData, setRegData] = useState({
    tenantName: '',
    tenantEmail: '',
    userFirstName: '',
    userLastName: '',
    userEmail: '',
    password: '',
    passwordConfirm: '',
  })

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await login(loginData.email, loginData.password)
      setAuthSession(res.token, res.currentTenant, res.user, res.tenants)
      if (res.tenants.length > 1) {
        router.push('/artists')
      } else {
        router.push('/')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  // Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (regData.password !== regData.passwordConfirm) {
      setError('Passwörter stimmen nicht überein')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await register({
        tenantName: regData.tenantName,
        tenantEmail: regData.tenantEmail,
        userFirstName: regData.userFirstName,
        userLastName: regData.userLastName,
        userEmail: regData.userEmail,
        password: regData.password,
      }) as { token: string; tenant: object; user: object }
      setAuthSession(res.token, res.tenant, res.user)
      router.push('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md space-y-8">

        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto h-14 w-14 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
            <Music className="h-7 w-7 text-gray-900" />
          </div>
          <h1 className="mt-5 text-3xl font-bold text-white tracking-tight">ProTouring</h1>
          <p className="mt-1 text-sm text-gray-400">Tour Management für Artists & Crews</p>
        </div>

        {/* Tab Switch */}
        <div className="flex rounded-lg bg-gray-800 p-1">
          <button
            onClick={() => { setMode('login'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'login' ? 'bg-yellow-400 text-gray-900' : 'text-gray-400 hover:text-white'
            }`}
          >
            Anmelden
          </button>
          <button
            onClick={() => { setMode('register'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'register' ? 'bg-yellow-400 text-gray-900' : 'text-gray-400 hover:text-white'
            }`}
          >
            Registrieren
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <InputField
              label="E-Mail"
              type="email"
              icon={<Mail className="h-4 w-4" />}
              value={loginData.email}
              onChange={v => setLoginData(d => ({ ...d, email: v }))}
              placeholder="deine@email.de"
              required
            />
            <InputField
              label="Passwort"
              type="password"
              icon={<Lock className="h-4 w-4" />}
              value={loginData.password}
              onChange={v => setLoginData(d => ({ ...d, password: v }))}
              placeholder="••••••••"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Anmelden...' : 'Anmelden'}
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider">Artist / Organisation</p>
              <div className="space-y-3">
                <InputField
                  label="Name der Band / Organisation *"
                  type="text"
                  icon={<Building className="h-4 w-4" />}
                  value={regData.tenantName}
                  onChange={v => setRegData(d => ({ ...d, tenantName: v }))}
                  placeholder="z.B. Betontod"
                  required
                />
                <InputField
                  label="E-Mail der Organisation *"
                  type="email"
                  icon={<Mail className="h-4 w-4" />}
                  value={regData.tenantEmail}
                  onChange={v => setRegData(d => ({ ...d, tenantEmail: v }))}
                  placeholder="info@band.de"
                  required
                />
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider">Dein Account</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <InputField
                    label="Vorname *"
                    type="text"
                    icon={<User className="h-4 w-4" />}
                    value={regData.userFirstName}
                    onChange={v => setRegData(d => ({ ...d, userFirstName: v }))}
                    placeholder="Max"
                    required
                  />
                  <InputField
                    label="Nachname *"
                    type="text"
                    icon={<User className="h-4 w-4" />}
                    value={regData.userLastName}
                    onChange={v => setRegData(d => ({ ...d, userLastName: v }))}
                    placeholder="Mustermann"
                    required
                  />
                </div>
                <InputField
                  label="Deine E-Mail *"
                  type="email"
                  icon={<Mail className="h-4 w-4" />}
                  value={regData.userEmail}
                  onChange={v => setRegData(d => ({ ...d, userEmail: v }))}
                  placeholder="deine@email.de"
                  required
                />
                <InputField
                  label="Passwort *"
                  type="password"
                  icon={<Lock className="h-4 w-4" />}
                  value={regData.password}
                  onChange={v => setRegData(d => ({ ...d, password: v }))}
                  placeholder="Mindestens 8 Zeichen"
                  required
                />
                <InputField
                  label="Passwort wiederholen *"
                  type="password"
                  icon={<Lock className="h-4 w-4" />}
                  value={regData.passwordConfirm}
                  onChange={v => setRegData(d => ({ ...d, passwordConfirm: v }))}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Konto wird erstellt...' : 'Konto erstellen'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function InputField({
  label, type, icon, value, onChange, placeholder, required
}: {
  label: string
  type: string
  icon: React.ReactNode
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
          {icon}
        </div>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400"
        />
      </div>
    </div>
  )
}
