'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  PlusIcon, LockClosedIcon, LockOpenIcon, ArrowDownTrayIcon,
  ArrowUpTrayIcon, DocumentTextIcon, Cog6ToothIcon, CheckIcon,
  XMarkIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import {
  getGuestLists, createGuestList, updateGuestList, deleteGuestList,
  getGuestListEntries, createGuestListEntry, updateGuestListEntry, deleteGuestListEntry,
  GuestList, GuestListEntry, GuestListSettings, PassMap,
  getEffectiveRole, isEditorRole, canDo, getTravelParty,
  API_BASE, getAuthToken, getCurrentTenant,
} from '@/lib/api-client'

const DEFAULT_PASS_TYPES = ['guestlist', 'backstage', 'aftershow', 'photo']
const PASS_LABELS: Record<string, string> = {
  guestlist: 'Gästeliste', backstage: 'Backstage', aftershow: 'Aftershow', photo: 'Photo',
}

interface Props { terminId: number }

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktion: kann Rolle direkt hinzufügen (nicht nur wünschen)?
function canAddDirect(role: string, settings: GuestListSettings): boolean {
  if (['admin', 'tourmanagement', 'agency'].includes(role)) return true
  if (role === 'artist' && settings.artist_can_add) return true
  if (role === 'crew_plus' && settings.crew_plus_can_add) return true
  return false
}

function passTotal(passes: PassMap): number {
  return Object.values(passes).reduce((s, v) => s + (parseInt(String(v)) || 0), 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Modal
// ─────────────────────────────────────────────────────────────────────────────
interface EntryModalProps {
  listSettings: GuestListSettings
  entry?: GuestListEntry | null
  travelParty: Array<{ id: number; displayName: string; userId?: number | null }>
  currentUserId?: number
  onSave: (data: Partial<GuestListEntry>) => Promise<void>
  onClose: () => void
}

function EntryModal({ listSettings, entry, travelParty, currentUserId, onSave, onClose }: EntryModalProps) {
  const passTypes = listSettings.pass_types ?? DEFAULT_PASS_TYPES
  const [firstName, setFirstName] = useState(entry?.first_name ?? '')
  const [lastName, setLastName] = useState(entry?.last_name ?? '')
  const [company, setCompany] = useState(entry?.company ?? '')
  const [invitedByText, setInvitedByText] = useState(entry?.invited_by_text ?? '')
  const [invitedByUserId, setInvitedByUserId] = useState<number | null>(entry?.invited_by_user_id ?? currentUserId ?? null)
  const [email, setEmail] = useState(entry?.email ?? '')
  const [passes, setPasses] = useState<PassMap>(() => {
    const base: PassMap = {}
    passTypes.forEach(t => base[t] = entry?.passes?.[t] ?? 0)
    return base
  })
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const total = passTotal(passes)

  const setPass = (t: string, v: number) => {
    setPasses(prev => ({ ...prev, [t]: Math.max(0, v) }))
  }

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) { setError('Vor- und Nachname erforderlich'); return }
    if (listSettings.require_email && !email.trim()) { setError('E-Mail ist Pflicht für diese Liste'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({ first_name: firstName, last_name: lastName, company: company || null, invited_by_text: invitedByText || null, invited_by_user_id: invitedByUserId, email: email || null, passes, notes: notes || null })
      onClose()
    } catch (e: any) {
      setError(e.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  // Vorschlag: Reisegruppe als Einladender
  const tpOptions = travelParty.filter(m => m.userId)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">{entry ? 'Eintrag bearbeiten' : 'Person hinzufügen'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Vorname *</label>
              <input className="pt-input w-full" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nachname *</label>
              <input className="pt-input w-full" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Firma</label>
            <input className="pt-input w-full" value={company} onChange={e => setCompany(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Eingeladen von</label>
            <div className="flex gap-2">
              {tpOptions.length > 0 && (
                <select
                  className="pt-input w-40 shrink-0"
                  value={invitedByUserId ?? ''}
                  onChange={e => {
                    const uid = parseInt(e.target.value) || null
                    setInvitedByUserId(uid)
                    if (uid) {
                      const m = tpOptions.find(t => t.userId === uid)
                      if (m) setInvitedByText(m.displayName)
                    }
                  }}
                >
                  <option value="">Manuell</option>
                  {tpOptions.map(m => <option key={m.userId} value={m.userId!}>{m.displayName}</option>)}
                </select>
              )}
              <input
                className="pt-input flex-1"
                placeholder="Name freitext..."
                value={invitedByText}
                onChange={e => setInvitedByText(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              E-Mail {listSettings.require_email && <span className="text-red-500">*</span>}
            </label>
            <input className="pt-input w-full" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          {/* Tickets */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Tickets <span className="text-gray-400 font-normal ml-1">Gesamt: {total}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {passTypes.map(t => (
                <div key={t} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700">{PASS_LABELS[t] ?? t}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPass(t, (passes[t] || 0) - 1)} className="w-6 h-6 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm">−</button>
                    <span className="w-6 text-center text-sm font-medium">{passes[t] || 0}</span>
                    <button onClick={() => setPass(t, (passes[t] || 0) + 1)} className="w-6 h-6 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notiz</label>
            <input className="pt-input w-full" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="pt-btn-secondary">Abbrechen</button>
          <button onClick={handleSave} disabled={saving} className="pt-btn-primary">
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings Modal
// ─────────────────────────────────────────────────────────────────────────────
interface SettingsModalProps {
  list: GuestList
  onSave: (settings: GuestListSettings, name: string) => Promise<void>
  onClose: () => void
}

function SettingsModal({ list, onSave, onClose }: SettingsModalProps) {
  const s = list.settings
  const [name, setName] = useState(list.name)
  const [requireEmail, setRequireEmail] = useState(s.require_email ?? false)
  const [totalLimit, setTotalLimit] = useState(String(s.total_limit ?? ''))
  const [perInviterLimit, setPerInviterLimit] = useState(String(s.per_inviter_limit ?? ''))
  const [passTypes, setPassTypes] = useState<string[]>(s.pass_types ?? DEFAULT_PASS_TYPES)
  const [artistCanAdd, setArtistCanAdd] = useState(s.artist_can_add ?? false)
  const [crewPlusCanAdd, setCrewPlusCanAdd] = useState(s.crew_plus_can_add ?? false)
  const [newPassType, setNewPassType] = useState('')
  const [saving, setSaving] = useState(false)

  const togglePassType = (t: string) => {
    setPassTypes(prev => prev.includes(t) ? prev.filter(p => p !== t) : [...prev, t])
  }
  const addCustomPassType = () => {
    const v = newPassType.trim().toLowerCase()
    if (v && !passTypes.includes(v)) { setPassTypes(prev => [...prev, v]); setNewPassType('') }
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      require_email: requireEmail,
      total_limit: totalLimit ? parseInt(totalLimit) : null,
      per_inviter_limit: perInviterLimit ? parseInt(perInviterLimit) : null,
      pass_types: passTypes,
      artist_can_add: artistCanAdd,
      crew_plus_can_add: crewPlusCanAdd,
    }, name)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">Listen-Einstellungen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Listenname</label>
            <input className="pt-input w-full" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">Pass-Typen</label>
            {DEFAULT_PASS_TYPES.map(t => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={passTypes.includes(t)} onChange={() => togglePassType(t)} className="rounded" />
                <span className="text-sm">{PASS_LABELS[t]}</span>
              </label>
            ))}
            {passTypes.filter(t => !DEFAULT_PASS_TYPES.includes(t)).map(t => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked onChange={() => togglePassType(t)} className="rounded" />
                <span className="text-sm">{t}</span>
                <button onClick={() => setPassTypes(prev => prev.filter(p => p !== t))} className="text-red-400 hover:text-red-600 ml-auto"><XMarkIcon className="w-3 h-3" /></button>
              </label>
            ))}
            <div className="flex gap-2 mt-1">
              <input className="pt-input flex-1 text-sm" placeholder="Eigener Typ..." value={newPassType} onChange={e => setNewPassType(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomPassType()} />
              <button onClick={addCustomPassType} className="pt-btn-secondary text-xs">+</button>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <label className="block text-xs font-medium text-gray-700">Limits</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Gesamt max.</label>
                <input className="pt-input w-full" type="number" min="0" value={totalLimit} onChange={e => setTotalLimit(e.target.value)} placeholder="Unbegrenzt" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Pro Einlader max.</label>
                <input className="pt-input w-full" type="number" min="0" value={perInviterLimit} onChange={e => setPerInviterLimit(e.target.value)} placeholder="Unbegrenzt" />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <label className="block text-xs font-medium text-gray-700 mb-2">Pflichtfelder</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={requireEmail} onChange={e => setRequireEmail(e.target.checked)} className="rounded" />
              <span className="text-sm">E-Mail ist Pflicht</span>
            </label>
          </div>

          <div className="border-t pt-4">
            <label className="block text-xs font-medium text-gray-700 mb-2">Berechtigungen</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={artistCanAdd} onChange={e => setArtistCanAdd(e.target.checked)} className="rounded" />
                <span className="text-sm">Artist darf direkt hinzufügen (sonst nur Wunsch)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={crewPlusCanAdd} onChange={e => setCrewPlusCanAdd(e.target.checked)} className="rounded" />
                <span className="text-sm">Crew+ darf direkt hinzufügen (sonst nur Wunsch)</span>
              </label>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="pt-btn-secondary">Abbrechen</button>
          <button onClick={handleSave} disabled={saving} className="pt-btn-primary">{saving ? '...' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hauptview
// ─────────────────────────────────────────────────────────────────────────────
export default function GaestelisteView({ terminId }: Props) {
  const role = getEffectiveRole()
  const isEditor = isEditorRole(role)
  const canWrite = ['admin', 'tourmanagement', 'agency', 'artist', 'crew_plus', 'crew'].includes(role)

  const [lists, setLists] = useState<GuestList[]>([])
  const [activeListId, setActiveListId] = useState<number | null>(null)
  const [entries, setEntries] = useState<GuestListEntry[]>([])
  const [activeList, setActiveList] = useState<GuestList | null>(null)
  const [travelParty, setTravelParty] = useState<Array<{ id: number; displayName: string; userId?: number | null }>>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editEntry, setEditEntry] = useState<GuestListEntry | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<GuestListEntry | null>(null)
  const [creatingList, setCreatingList] = useState(false)

  // Aktuelle User-ID aus JWT payload (approximiert via API_BASE request oder localStorage)
  const [currentUserId, setCurrentUserId] = useState<number | undefined>(undefined)
  useEffect(() => {
    // Hole user id aus getCurrentUser (falls verfügbar)
    import('@/lib/api-client').then(({ getCurrentUser }) => {
      const u = getCurrentUser()
      if (u?.id) setCurrentUserId(u.id)
    })
  }, [])

  const loadLists = useCallback(async () => {
    try {
      const l = await getGuestLists(terminId)
      setLists(l)
      if (l.length > 0 && !activeListId) setActiveListId(l[0].id)
    } catch {}
  }, [terminId, activeListId])

  const loadEntries = useCallback(async (listId: number) => {
    setLoading(true)
    try {
      const { list, entries: e } = await getGuestListEntries(listId)
      setActiveList(list)
      setEntries(e)
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadLists() }, [terminId])
  useEffect(() => { if (activeListId) loadEntries(activeListId) }, [activeListId])

  useEffect(() => {
    getTravelParty(terminId).then(tp => {
      setTravelParty(tp.map(m => ({
        id: m.id,
        displayName: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || '',
        userId: m.userId ?? null,
      })))
    }).catch(() => {})
  }, [terminId])

  const handleAddList = async () => {
    setCreatingList(true)
    try {
      const name = lists.length === 0 ? 'Gästeliste' : `Liste ${lists.length + 1}`
      const l = await createGuestList(terminId, name)
      setLists(prev => [...prev, l])
      setActiveListId(l.id)
    } finally { setCreatingList(false) }
  }

  const handleLockToggle = async () => {
    if (!activeList) return
    const newStatus = activeList.status === 'locked' ? 'open' : 'locked'
    const updated = await updateGuestList(activeList.id, { status: newStatus })
    setActiveList(updated)
    setLists(prev => prev.map(l => l.id === updated.id ? updated : l))
  }

  const handleSaveEntry = async (data: Partial<GuestListEntry>) => {
    if (editEntry) {
      const updated = await updateGuestListEntry(editEntry.id, data)
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
    } else {
      const created = await createGuestListEntry(activeListId!, data)
      setEntries(prev => [...prev, created])
    }
  }

  const handleApprove = async (entry: GuestListEntry, status: 'approved' | 'rejected') => {
    const updated = await updateGuestListEntry(entry.id, { status })
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    await deleteGuestListEntry(confirmDelete.id)
    setEntries(prev => prev.filter(e => e.id !== confirmDelete.id))
    setConfirmDelete(null)
  }

  const handleSaveSettings = async (settings: GuestListSettings, name: string) => {
    if (!activeList) return
    const updated = await updateGuestList(activeList.id, { settings, name })
    setActiveList(updated)
    setLists(prev => prev.map(l => l.id === updated.id ? updated : l))
  }

  const handleCsvExport = () => {
    if (!activeListId) return
    const token = getAuthToken()
    const slug = getCurrentTenant()?.slug
    const url = `${API_BASE}/api/guest-lists/${activeListId}/export/csv`
    const a = document.createElement('a')
    a.href = url
    a.setAttribute('download', '')
    // Fetch with auth
    fetch(url, { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug ?? '' } })
      .then(r => r.blob())
      .then(blob => {
        const burl = URL.createObjectURL(blob)
        a.href = burl; a.click(); URL.revokeObjectURL(burl)
      })
  }

  const handlePdfExport = () => {
    if (!activeListId) return
    const token = getAuthToken()
    const slug = getCurrentTenant()?.slug
    const url = `${API_BASE}/api/guest-lists/${activeListId}/export/pdf`
    fetch(url, { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug ?? '' } })
      .then(r => r.blob())
      .then(blob => {
        const burl = URL.createObjectURL(blob)
        window.open(burl, '_blank')
      })
  }

  const listSettings = activeList?.settings ?? {}
  const passTypes = listSettings.pass_types ?? DEFAULT_PASS_TYPES
  const isLocked = activeList?.status === 'locked'
  const isDirect = canAddDirect(role, listSettings)

  const pendingCount = entries.filter(e => e.status === 'pending').length
  const approvedCount = entries.filter(e => e.status === 'approved').length
  const totalTickets = entries.filter(e => e.status !== 'rejected').reduce((s, e) => s + passTotal(e.passes), 0)

  if (lists.length === 0 && !loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400 mb-4">Noch keine Gästeliste für diesen Termin.</p>
        {isEditor && (
          <button onClick={handleAddList} className="pt-btn-primary">
            <PlusIcon className="w-4 h-4 mr-1 inline" /> Erste Liste erstellen
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {lists.map(l => (
          <button
            key={l.id}
            onClick={() => setActiveListId(l.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              l.id === activeListId
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            {l.name}
            {l.status === 'locked' && <LockClosedIcon className="w-3 h-3 inline ml-1 opacity-70" />}
            {(l.entry_count ?? 0) > 0 && (
              <span className={`ml-1.5 text-xs ${l.id === activeListId ? 'opacity-80' : 'text-gray-400'}`}>
                {l.entry_count}
              </span>
            )}
          </button>
        ))}
        {isEditor && (
          <button onClick={handleAddList} disabled={creatingList} className="px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
            + Weitere Liste
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Hinzufügen / Wunsch */}
        {canWrite && !isLocked && (
          <button
            onClick={() => { setEditEntry(null); setShowAddModal(true) }}
            className="pt-btn-primary flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" />
            {isDirect ? 'Hinzufügen' : '+ Wunsch'}
          </button>
        )}

        {/* Lock/Unlock */}
        {isEditor && (
          <button onClick={handleLockToggle} className={`pt-btn-secondary flex items-center gap-1 ${isLocked ? 'text-green-700' : ''}`}>
            {isLocked ? <LockOpenIcon className="w-4 h-4" /> : <LockClosedIcon className="w-4 h-4" />}
            {isLocked ? 'Entsperren' : 'Abschließen'}
          </button>
        )}

        <div className="flex-1" />

        {/* Settings */}
        {isEditor && (
          <button onClick={() => setShowSettings(true)} className="pt-btn-secondary flex items-center gap-1">
            <Cog6ToothIcon className="w-4 h-4" /> Einstellungen
          </button>
        )}

        {/* CSV Export */}
        <button onClick={handleCsvExport} className="pt-btn-secondary flex items-center gap-1">
          <ArrowDownTrayIcon className="w-4 h-4" /> CSV
        </button>

        {/* PDF Export */}
        <button onClick={handlePdfExport} className="pt-btn-secondary flex items-center gap-1">
          <DocumentTextIcon className="w-4 h-4" /> PDF
        </button>
      </div>

      {/* Stats */}
      {activeList && (
        <div className="flex gap-4 mb-3 text-sm text-gray-500">
          <span>{approvedCount} bestätigt</span>
          {pendingCount > 0 && <span className="text-amber-600 font-medium">{pendingCount} ausstehend</span>}
          <span>{totalTickets} Tickets gesamt</span>
          {isLocked && <span className="text-red-600 font-medium flex items-center gap-1"><LockClosedIcon className="w-3 h-3" /> Gesperrt</span>}
        </div>
      )}

      {/* Tabelle */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Eingeladen von</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">E-Mail</th>
              {passTypes.map(t => (
                <th key={t} className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {(PASS_LABELS[t] ?? t).substring(0, 3).toUpperCase()}
                </th>
              ))}
              <th className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">∑</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.length === 0 ? (
              <tr><td colSpan={99} className="text-center py-10 text-gray-400">Noch keine Einträge</td></tr>
            ) : entries.map(entry => {
              const isPending = entry.is_wish && entry.status === 'pending'
              const isRejected = entry.status === 'rejected'
              const total = passTotal(entry.passes)
              return (
                <tr key={entry.id} className={`${isRejected ? 'opacity-50' : ''} ${isPending ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {entry.is_wish && (
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          entry.status === 'approved' ? 'bg-green-500' :
                          entry.status === 'rejected' ? 'bg-red-400' : 'bg-amber-400'
                        }`} />
                      )}
                      <span className={`font-medium ${isRejected ? 'line-through' : ''}`}>
                        {entry.first_name} {entry.last_name}
                      </span>
                      {entry.company && <span className="text-gray-400 text-xs">({entry.company})</span>}
                    </div>
                    {isPending && isEditor && (
                      <div className="flex gap-1 mt-1">
                        <button onClick={() => handleApprove(entry, 'approved')} className="text-xs text-green-700 bg-green-50 hover:bg-green-100 px-2 py-0.5 rounded flex items-center gap-0.5">
                          <CheckIcon className="w-3 h-3" /> Annehmen
                        </button>
                        <button onClick={() => handleApprove(entry, 'rejected')} className="text-xs text-red-700 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded flex items-center gap-0.5">
                          <XMarkIcon className="w-3 h-3" /> Ablehnen
                        </button>
                      </div>
                    )}
                    {isPending && !isEditor && (
                      <span className="text-xs text-amber-600">Wunsch – ausstehend</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{entry.invited_by_text || '–'}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{entry.email || '–'}</td>
                  {passTypes.map(t => (
                    <td key={t} className="px-2 py-2.5 text-center text-gray-700">
                      {entry.passes[t] > 0 ? entry.passes[t] : <span className="text-gray-300">–</span>}
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-center font-semibold text-gray-900">{total > 0 ? total : '–'}</td>
                  <td className="px-4 py-2.5">
                    {!isLocked && (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setEditEntry(entry); setShowAddModal(true) }} className="text-gray-400 hover:text-blue-600 p-1 rounded">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setConfirmDelete(entry)} className="text-gray-400 hover:text-red-600 p-1 rounded">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showAddModal && (
        <EntryModal
          listSettings={listSettings}
          entry={editEntry}
          travelParty={travelParty}
          currentUserId={currentUserId}
          onSave={handleSaveEntry}
          onClose={() => { setShowAddModal(false); setEditEntry(null) }}
        />
      )}
      {showSettings && activeList && (
        <SettingsModal
          list={activeList}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-500 shrink-0" />
              <p className="text-sm text-gray-700">
                <strong>{confirmDelete.first_name} {confirmDelete.last_name}</strong> aus der Gästeliste entfernen?
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="pt-btn-secondary">Abbrechen</button>
              <button onClick={handleDelete} className="pt-btn-danger">Entfernen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
