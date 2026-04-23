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
  superadminGetUsers, superadminSetPassword, superadminDeleteUser,
  superadminGetTenants, superadminExtendTrial,
  CURRENT_TENANT_KEY,
  type MyTermin, type SuperadminUser, type SuperadminTenant,
} from '@/lib/api-client'
import { Shield, Loader2 } from 'lucide-react'

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
    // window.location.href statt router.push: Router-Cache würde useEffect in page.tsx nicht neu triggern
    window.location.href = terminId ? `/?terminId=${terminId}` : '/'
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

        {/* Neuen Artist anlegen – nur für Admins (oder neue User ohne Tenants) */}
        {(tenants.length === 0 || tenants.some(t => t.role === 'admin')) && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-600 hover:border-yellow-400 text-gray-400 hover:text-yellow-400 rounded-xl px-5 py-4 transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Neuen Artist anlegen
          </button>
        )}

        {/* Superadmin-Konsole */}
        {!!(currentUser as any)?.isSuperadmin && (
          <SuperadminConsole />
        )}

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

// ============================================================
// SuperadminConsole
// ============================================================

function SuperadminConsole() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'users' | 'tenants'>('users')

  // Users
  const [users, setUsers] = useState<SuperadminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  // Tenants
  const [tenants, setTenants] = useState<SuperadminTenant[]>([])
  const [tenantsLoading, setTenantsLoading] = useState(false)
  const [extendTarget, setExtendTarget] = useState<SuperadminTenant | null>(null)
  const [extendDays, setExtendDays] = useState('30')
  const [extending, setExtending] = useState(false)
  const [extendError, setExtendError] = useState('')

  // PW-Modal
  const [pwTarget, setPwTarget] = useState<SuperadminUser | null>(null)
  const [pwValue, setPwValue] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSuccess, setPwSuccess] = useState('')

  // Delete-Modal
  const [delTarget, setDelTarget] = useState<SuperadminUser | null>(null)
  const [delConfirm, setDelConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [delError, setDelError] = useState('')

  const loadTenants = () => {
    setTenantsLoading(true)
    superadminGetTenants()
      .then(t => setTenants(t))
      .catch(e => setError(e.message))
      .finally(() => setTenantsLoading(false))
  }

  const handleExtendTrial = async () => {
    if (!extendTarget) return
    const d = parseInt(extendDays)
    if (isNaN(d) || d < 1) { setExtendError('Ungültige Anzahl Tage'); return }
    setExtending(true); setExtendError('')
    try {
      const newDate = await superadminExtendTrial(extendTarget.id, d)
      setTenants(prev => prev.map(t => t.id === extendTarget.id ? { ...t, trialEndsAt: newDate, status: 'trial' } : t))
      setExtendTarget(null)
    } catch (e: any) { setExtendError(e.message) }
    finally { setExtending(false) }
  }

  const load = () => {
    setLoading(true); setError('')
    superadminGetUsers()
      .then(u => setUsers(u))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  const handleOpen = () => { setOpen(true); load(); loadTenants() }

  const filtered = users.filter(u =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  )

  const handlePwSave = async () => {
    if (!pwTarget) return
    if (pwValue.length < 6) { setPwError('Mindestens 6 Zeichen'); return }
    setPwSaving(true); setPwError(''); setPwSuccess('')
    try {
      await superadminSetPassword(pwTarget.id, pwValue)
      setPwSuccess('Passwort gesetzt.')
      setTimeout(() => setPwTarget(null), 1200)
    } catch (e: any) { setPwError(e.message) }
    finally { setPwSaving(false) }
  }

  const handleDelete = async () => {
    if (!delTarget || delConfirm !== delTarget.email) { setDelError('E-Mail stimmt nicht'); return }
    setDeleting(true); setDelError('')
    try {
      await superadminDeleteUser(delTarget.id)
      setUsers(prev => prev.filter(u => u.id !== delTarget.id))
      setDelTarget(null); setDelConfirm('')
    } catch (e: any) { setDelError(e.message) }
    finally { setDeleting(false) }
  }

  return (
    <div className="mt-2">
      <button
        onClick={handleOpen}
        className="w-full flex items-center justify-center gap-2 border border-dashed border-red-800 hover:border-red-500 text-red-500 hover:text-red-400 rounded-xl px-5 py-3 transition-all text-sm font-medium"
      >
        <Shield className="w-4 h-4" />
        Superadmin — User-Verwaltung
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90dvh] sm:max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-400" />
                <h2 className="text-white font-semibold text-sm">Superadmin</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800 px-4">
              {(['users', 'tenants'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-red-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                  {t === 'users' ? 'User' : 'Artists / Trial'}
                </button>
              ))}
            </div>

            {/* Search (nur bei Users) */}
            {tab === 'users' && (
              <div className="px-4 py-2.5 border-b border-gray-800">
                <input type="text" placeholder="Suchen …" value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto">

              {/* ── Tenants Tab ── */}
              {tab === 'tenants' && (
                <>
                  {tenantsLoading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-500" size={20} /></div>}
                  {!tenantsLoading && (
                    <div className="divide-y divide-gray-800">
                      {tenants.map(t => {
                        const endsAt = t.trialEndsAt ? new Date(t.trialEndsAt) : null
                        const daysLeft = endsAt ? Math.ceil((endsAt.getTime() - Date.now()) / 86400000) : null
                        const expired = daysLeft !== null && daysLeft <= 0
                        return (
                          <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{t.name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {t.userCount} User · {t.status === 'trial' ? (
                                  expired
                                    ? <span className="text-red-400 font-medium">Trial abgelaufen</span>
                                    : <span className="text-yellow-400">Trial: noch {daysLeft} {daysLeft === 1 ? 'Tag' : 'Tage'}</span>
                                ) : (
                                  <span className="text-green-400">{t.status}</span>
                                )}
                              </p>
                            </div>
                            <button
                              onClick={() => { setExtendTarget(t); setExtendDays('30'); setExtendError('') }}
                              className="text-xs px-2.5 py-1.5 bg-yellow-600/30 hover:bg-yellow-600/50 text-yellow-300 rounded-lg flex-shrink-0"
                            >
                              Trial verlängern
                            </button>
                          </div>
                        )
                      })}
                      {tenants.length === 0 && <p className="text-center py-8 text-gray-600 text-sm">Keine Artists</p>}
                    </div>
                  )}
                </>
              )}

              {/* ── Users Tab ── */}
              {tab === 'users' && loading && (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-500" size={20} /></div>
              )}
              {tab === 'users' && error && <p className="text-red-400 text-sm px-4 py-4">{error}</p>}
              {tab === 'users' && !loading && !error && (
                <>
                  {/* Mobile: Cards */}
                  <div className="sm:hidden divide-y divide-gray-800">
                    {filtered.map(u => (
                      <div key={u.id} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {u.firstName} {u.lastName}
                            {u.isSuperadmin && <span className="ml-1.5 text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded">SA</span>}
                          </p>
                          <p className="text-gray-400 text-xs truncate mt-0.5">{u.email}</p>
                          <p className="text-xs mt-1">
                            {u.tenantCount === 0
                              ? <span className="text-orange-400">Kein Tenant</span>
                              : <span className="text-gray-500" title={u.tenantNames}>{u.tenantCount} Tenant{u.tenantCount !== 1 ? 's' : ''}</span>
                            }
                          </p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0 pt-0.5">
                          <button
                            onClick={() => { setPwTarget(u); setPwValue(''); setPwError(''); setPwSuccess('') }}
                            className="text-xs px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg"
                          >
                            PW
                          </button>
                          {!u.isSuperadmin && (
                            <button
                              onClick={() => { setDelTarget(u); setDelConfirm(''); setDelError('') }}
                              className="text-xs px-2.5 py-1.5 bg-red-900/40 hover:bg-red-900/70 text-red-400 rounded-lg"
                            >
                              Löschen
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {filtered.length === 0 && (
                      <p className="text-center py-8 text-gray-600 text-sm">Keine User</p>
                    )}
                  </div>

                  {/* Desktop: Tabelle */}
                  <table className="hidden sm:table w-full text-sm">
                    <thead className="sticky top-0 bg-gray-900 border-b border-gray-700">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs text-gray-400 font-medium">Name</th>
                        <th className="text-left px-4 py-2.5 text-xs text-gray-400 font-medium">E-Mail</th>
                        <th className="text-left px-4 py-2.5 text-xs text-gray-400 font-medium">Tenants</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {filtered.map(u => (
                        <tr key={u.id} className="hover:bg-gray-800/50">
                          <td className="px-4 py-2.5 text-white">
                            {u.firstName} {u.lastName}
                            {u.isSuperadmin && <span className="ml-1.5 text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded">SA</span>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-400">{u.email}</td>
                          <td className="px-4 py-2.5 text-xs">
                            {u.tenantCount === 0
                              ? <span className="text-orange-400 font-medium">Kein Tenant</span>
                              : <span className="text-gray-400" title={u.tenantNames}>{u.tenantCount}×</span>
                            }
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1.5 justify-end">
                              <button onClick={() => { setPwTarget(u); setPwValue(''); setPwError(''); setPwSuccess('') }} className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded">PW</button>
                              {!u.isSuperadmin && (
                                <button onClick={() => { setDelTarget(u); setDelConfirm(''); setDelError('') }} className="text-xs px-2 py-1 bg-red-900/40 hover:bg-red-900/70 text-red-400 rounded">Löschen</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-6 text-gray-600">Keine User</td></tr>
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trial-Verlängern-Modal */}
      {extendTarget && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setExtendTarget(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-semibold">Trial verlängern</h3>
            <p className="text-sm text-gray-400">
              Artist: <span className="text-white">{extendTarget.name}</span>
              {extendTarget.trialEndsAt && (
                <span className="block mt-0.5 text-xs">Aktuell bis: {new Date(extendTarget.trialEndsAt).toLocaleDateString('de-DE')}</span>
              )}
            </p>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Verlängern um … Tage</label>
              <div className="flex gap-2">
                {[14, 30, 60, 90].map(d => (
                  <button key={d} onClick={() => setExtendDays(String(d))}
                    className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${extendDays === String(d) ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                    {d}
                  </button>
                ))}
              </div>
              <input type="number" value={extendDays} onChange={e => setExtendDays(e.target.value)} min="1"
                className="mt-2 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            </div>
            {extendError && <p className="text-xs text-red-400">{extendError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setExtendTarget(null)} className="text-sm px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg">Abbrechen</button>
              <button onClick={handleExtendTrial} disabled={extending}
                className="text-sm px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-1">
                {extending && <Loader2 size={12} className="animate-spin" />}
                Verlängern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PW-Modal */}
      {pwTarget && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setPwTarget(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-semibold">Passwort setzen</h3>
            <p className="text-sm text-gray-400">{pwTarget.firstName} {pwTarget.lastName} ({pwTarget.email})</p>
            <input
              type="password"
              autoFocus
              value={pwValue}
              onChange={e => setPwValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePwSave()}
              placeholder="Neues Passwort (min. 6 Zeichen)"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {pwError && <p className="text-xs text-red-400">{pwError}</p>}
            {pwSuccess && <p className="text-xs text-green-400">{pwSuccess}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPwTarget(null)} className="text-sm px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg">Abbrechen</button>
              <button
                onClick={handlePwSave}
                disabled={pwSaving}
                className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-1"
              >
                {pwSaving && <Loader2 size={12} className="animate-spin" />}
                Setzen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete-Modal */}
      {delTarget && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setDelTarget(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-semibold">User löschen</h3>
            <p className="text-sm text-gray-400">
              <span className="text-white">{delTarget.firstName} {delTarget.lastName}</span> wird global gelöscht.
              Kontaktdaten bleiben erhalten, werden aber vom Account getrennt.
            </p>
            <div className="p-3 bg-red-950/50 border border-red-900 rounded-lg text-xs text-red-400">
              Nicht rückgängig machbar.
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">E-Mail zur Bestätigung: <span className="font-mono text-gray-300">{delTarget.email}</span></label>
              <input
                type="text"
                autoFocus
                value={delConfirm}
                onChange={e => setDelConfirm(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            {delError && <p className="text-xs text-red-400">{delError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDelTarget(null)} className="text-sm px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg">Abbrechen</button>
              <button
                onClick={handleDelete}
                disabled={deleting || delConfirm !== delTarget.email}
                className="text-sm px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-1"
              >
                {deleting && <Loader2 size={12} className="animate-spin" />}
                Löschen
              </button>
            </div>
          </div>
        </div>
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
