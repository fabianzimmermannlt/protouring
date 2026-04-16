'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Music, Plus, X, ChevronRight, LogOut } from 'lucide-react'
import {
  getAllTenants,
  setAllTenants,
  getMyTenants,
  createTenant,
  getMyTermine,
  getAuthToken,
  getCurrentUser,
  logout,
  CURRENT_TENANT_KEY,
  type MyTermin,
} from '@/lib/api-client'

interface Tenant {
  id: number
  name: string
  slug: string
  status: string
  trial_ends_at: string | null
  role: string
}

export default function ArtistsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [termine, setTermine] = useState<MyTermin[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getCurrentUser>>(null)

  useEffect(() => {
    setCurrentUser(getCurrentUser())
    if (searchParams.get('new') === '1') setShowCreateModal(true)
  }, [searchParams])

  useEffect(() => {
    // Erst aus localStorage laden (sofort sichtbar), dann aktuell aus DB
    const cached = getAllTenants() as Tenant[]
    if (cached.length > 0) setTenants(cached)

    Promise.all([
      getMyTenants().then(res => { setTenants(res.tenants); setAllTenants(res.tenants) }),
      getMyTermine().then(res => setTermine(res.termine)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const handleSelectTenant = (tenant: Tenant, terminId?: number) => {
    const token = getAuthToken()
    if (!token) return
    // Preview-Rolle immer clearen beim Wechsel
    localStorage.removeItem('protouring_preview_role')
    // Current Tenant setzen und zur App navigieren
    localStorage.setItem(CURRENT_TENANT_KEY, JSON.stringify({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      role: tenant.role,
    }))
    router.push(terminId ? `/?terminId=${terminId}` : '/')
  }

  const handleTenantCreated = (newTenant: Tenant) => {
    const updated = [...tenants, newTenant]
    setTenants(updated)
    setAllTenants(updated)
    setShowCreateModal(false)
    handleSelectTenant(newTenant)
  }

  const trialDaysLeft = (trial_ends_at: string | null) => {
    if (!trial_ends_at) return null
    const diff = Math.ceil((new Date(trial_ends_at).getTime() - Date.now()) / 86400000)
    return diff > 0 ? diff : 0
  }

  const roleLabel: Record<string, string> = {
    admin: 'Admin', agency: 'Agentur', tourmanagement: 'Tourmanagement',
    artist: 'Artist', crew_plus: 'Crew+', crew: 'Crew', guest: 'Gast'
  }

  const roleBadgeColor: Record<string, string> = {
    admin: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    agency: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    tourmanagement: 'bg-green-500/20 text-green-300 border-green-500/30',
    artist: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    crew_plus: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    crew: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    guest: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center py-12 px-4">
      <div className="w-full max-w-xl space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-14 w-14 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg mb-4">
            <Music className="h-7 w-7 text-gray-900" />
          </div>
          <h1 className="text-2xl font-bold text-white">Meine Artists</h1>
          {currentUser && (
            <p className="text-sm text-gray-400 mt-1">
              Eingeloggt als {currentUser.firstName} {currentUser.lastName}
            </p>
          )}
        </div>

        {/* Tenant-Liste */}
        <div className="space-y-2">
          {loading && tenants.length === 0 && (
            <p className="text-center text-gray-500 py-8">Lade...</p>
          )}
          {tenants.map(t => {
            const days = trialDaysLeft(t.trial_ends_at)
            return (
              <button
                key={t.id}
                onClick={() => handleSelectTenant(t)}
                className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded-xl px-5 py-4 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                    <Music className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold">{t.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${roleBadgeColor[t.role] ?? roleBadgeColor.crew}`}>
                        {roleLabel[t.role] ?? t.role}
                      </span>
                      {days !== null && days <= 14 && (
                        <span className={`text-xs ${days <= 3 ? 'text-red-400' : 'text-yellow-400'}`}>
                          Trial: noch {days} {days === 1 ? 'Tag' : 'Tage'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
              </button>
            )
          })}
        </div>

        {/* Neuen Artist anlegen */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-600 hover:border-yellow-400 text-gray-400 hover:text-yellow-400 rounded-xl px-5 py-4 transition-all text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Neuen Artist anlegen
        </button>

        {/* Meine Termine */}
        {termine.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              Meine bestätigten Termine
            </h2>
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Datum</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Titel</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 hidden sm:table-cell">Ort</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 hidden sm:table-cell">Art</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Artist</th>
                  </tr>
                </thead>
                <tbody>
                  {termine.map((t, i) => (
                    <tr
                      key={`${t.tenantSlug}-${t.id}`}
                      onClick={() => handleSelectTenant(
                        tenants.find(tn => tn.slug === t.tenantSlug) ?? { id: t.tenantId, name: t.tenantName, slug: t.tenantSlug, status: 'active', role: 'crew', trial_ends_at: null },
                        t.id
                      )}
                      className={`cursor-pointer hover:bg-gray-700 transition-colors ${i < termine.length - 1 ? 'border-b border-gray-700/50' : ''}`}
                    >
                      <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-2.5 text-white font-medium truncate max-w-[10rem]">{t.title || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-300 hidden sm:table-cell">{t.city || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-400 hidden sm:table-cell">{t.art || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full">
                          {t.tenantName}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="text-center">
          <button
            onClick={() => { logout(); router.push('/login') }}
            className="text-sm text-gray-500 hover:text-gray-300 flex items-center gap-1.5 mx-auto transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Abmelden
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTenantModal
          onCreated={handleTenantCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  )
}

function CreateTenantModal({
  onCreated,
  onClose,
}: {
  onCreated: (t: Tenant) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await createTenant({ name: name.trim(), email: email.trim() || undefined })
      onCreated({ ...res.tenant, trial_ends_at: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Anlegen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Neuen Artist anlegen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-900/50 border border-red-700 rounded-lg p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Name der Band / Organisation *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Beatsteaks"
              required
              autoFocus
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              E-Mail der Organisation <span className="text-gray-600">(optional, für Billing)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="info@band.de"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 py-2 px-4 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Anlegen...' : 'Anlegen & öffnen'}
            </button>
          </div>
        </form>

        <p className="text-xs text-gray-600 mt-4 text-center">
          Du erhältst 14 Tage kostenlos. Danach wird ein Abo benötigt.
        </p>
      </div>
    </div>
  )
}
