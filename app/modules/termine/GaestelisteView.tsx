'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  PlusIcon, LockClosedIcon, LockOpenIcon, ArrowDownTrayIcon,
  DocumentTextIcon, Cog6ToothIcon, CheckIcon,
  XMarkIcon, PencilIcon, TrashIcon,
} from '@heroicons/react/24/outline'
import { X } from 'lucide-react'
import {
  getGuestLists, createGuestList, updateGuestList,
  getGuestListEntries, createGuestListEntry, updateGuestListEntry, deleteGuestListEntry,
  GuestList, GuestListEntry, GuestListSettings, PassMap,
  getEffectiveRole, isEditorRole, getTravelParty,
  API_BASE, getAuthToken, getCurrentTenant,
} from '@/lib/api-client'

const DEFAULT_PASS_TYPES = ['guestlist', 'backstage', 'aftershow', 'photo']
const PASS_LABELS: Record<string, string> = {
  guestlist: 'Gästeliste', backstage: 'Backstage', aftershow: 'Aftershow', photo: 'Photo',
}

interface Props { terminId: number }

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
  const tpOptions = travelParty.filter(m => m.userId)

  const setPass = (t: string, v: number) => setPasses(prev => ({ ...prev, [t]: Math.max(0, v) }))

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) { setError('Vor- und Nachname erforderlich'); return }
    if (listSettings.require_email && !email.trim()) { setError('E-Mail ist Pflicht für diese Liste'); return }
    setSaving(true); setError('')
    try {
      await onSave({ first_name: firstName, last_name: lastName, company: company || null, invited_by_text: invitedByText || null, invited_by_user_id: invitedByUserId, email: email || null, passes, notes: notes || null })
      onClose()
    } catch (e: any) {
      setError(e.message || 'Fehler beim Speichern')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-lg">
        <div className="modal-header">
          <h2 className="modal-title">{entry ? 'Eintrag bearbeiten' : 'Person hinzufügen'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="modal-body space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Vorname *</label>
              <input className="form-input" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Nachname *</label>
              <input className="form-input" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="form-label">Firma</label>
            <input className="form-input" value={company} onChange={e => setCompany(e.target.value)} />
          </div>

          <div>
            <label className="form-label">Eingeladen von</label>
            {tpOptions.length > 0 ? (
              <>
                <select
                  className="form-input"
                  value={invitedByUserId ?? ''}
                  onChange={e => {
                    const uid = parseInt(e.target.value) || null
                    setInvitedByUserId(uid)
                    if (uid) {
                      const m = tpOptions.find(t => t.userId === uid)
                      if (m) setInvitedByText(m.displayName)
                    } else {
                      setInvitedByText('')
                    }
                  }}
                >
                  <option value="">Manuell eingeben…</option>
                  {tpOptions.map(m => <option key={m.userId} value={m.userId!}>{m.displayName}</option>)}
                </select>
                {invitedByUserId === null && (
                  <input
                    className="form-input mt-2"
                    placeholder="Name freitext..."
                    value={invitedByText}
                    onChange={e => setInvitedByText(e.target.value)}
                  />
                )}
              </>
            ) : (
              <input
                className="form-input"
                placeholder="Name freitext..."
                value={invitedByText}
                onChange={e => setInvitedByText(e.target.value)}
              />
            )}
          </div>

          <div>
            <label className="form-label">
              E-Mail {listSettings.require_email && <span className="text-red-500">*</span>}
            </label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          <div>
            <label className="form-label">
              Tickets <span className="text-gray-400 font-normal ml-1">Gesamt: {total}</span>
            </label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {passTypes.map(t => (
                <div key={t} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2">
                  <span className="text-sm text-gray-700">{PASS_LABELS[t] ?? t}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setPass(t, (passes[t] || 0) - 1)} className="w-6 h-6 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm leading-none">−</button>
                    <span className="w-6 text-center text-sm font-medium">{passes[t] || 0}</span>
                    <button type="button" onClick={() => setPass(t, (passes[t] || 0) + 1)} className="w-6 h-6 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm leading-none">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">Notiz</label>
            <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="modal-footer">
          <div />
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary disabled:opacity-50">
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
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
  const [customTypes, setCustomTypes] = useState<string[]>(
    s.custom_pass_types ?? (s.pass_types ?? []).filter(t => !DEFAULT_PASS_TYPES.includes(t))
  )
  const [artistCanAdd, setArtistCanAdd] = useState(s.artist_can_add ?? false)
  const [crewPlusCanAdd, setCrewPlusCanAdd] = useState(s.crew_plus_can_add ?? false)
  const [exportShowInviter, setExportShowInviter] = useState(s.export_show_inviter ?? true)
  const [exportShowEmail, setExportShowEmail] = useState(s.export_show_email ?? true)
  const [newPassType, setNewPassType] = useState('')
  const [saving, setSaving] = useState(false)

  const togglePassType = (t: string) =>
    setPassTypes(prev => prev.includes(t) ? prev.filter(p => p !== t) : [...prev, t])

  const deleteCustomType = (t: string) => {
    setCustomTypes(prev => prev.filter(p => p !== t))
    setPassTypes(prev => prev.filter(p => p !== t))
  }

  const addCustomPassType = () => {
    const v = newPassType.trim()
    const allTypes = [...DEFAULT_PASS_TYPES, ...customTypes]
    if (v && !allTypes.map(t => t.toLowerCase()).includes(v.toLowerCase())) {
      setCustomTypes(prev => [...prev, v])
      setPassTypes(prev => [...prev, v])
      setNewPassType('')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      require_email: requireEmail,
      total_limit: totalLimit ? parseInt(totalLimit) : null,
      per_inviter_limit: perInviterLimit ? parseInt(perInviterLimit) : null,
      pass_types: passTypes,
      custom_pass_types: customTypes,
      artist_can_add: artistCanAdd,
      crew_plus_can_add: crewPlusCanAdd,
      export_show_inviter: exportShowInviter,
      export_show_email: exportShowEmail,
    }, name)
    setSaving(false)
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container max-w-md">
        <div className="modal-header">
          <h2 className="modal-title">Listen-Einstellungen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="modal-body space-y-5">
          <div>
            <label className="form-label">Listenname</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div>
            <label className="form-label mb-2">Pass-Typen</label>
            <div className="space-y-1.5">
              {DEFAULT_PASS_TYPES.map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={passTypes.includes(t)} onChange={() => togglePassType(t)} className="rounded border-gray-300" />
                  {PASS_LABELS[t]}
                </label>
              ))}
              {customTypes.map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={passTypes.includes(t)} onChange={() => togglePassType(t)} className="rounded border-gray-300" />
                  {t}
                  <button type="button" onClick={() => deleteCustomType(t)} className="ml-auto text-red-400 hover:text-red-600">
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </label>
              ))}
              <div className="flex gap-2 pt-1">
                <input
                  className="form-input flex-1 text-sm"
                  placeholder="Eigener Typ..."
                  value={newPassType}
                  onChange={e => setNewPassType(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomPassType()}
                />
                <button type="button" onClick={addCustomPassType} className="btn btn-ghost text-xs px-3">+</button>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <label className="form-label mb-2">Limits</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label text-gray-500">Gesamt max.</label>
                <input className="form-input" type="number" min="0" value={totalLimit} onChange={e => setTotalLimit(e.target.value)} placeholder="Unbegrenzt" />
              </div>
              <div>
                <label className="form-label text-gray-500">Pro Einlader max.</label>
                <input className="form-input" type="number" min="0" value={perInviterLimit} onChange={e => setPerInviterLimit(e.target.value)} placeholder="Unbegrenzt" />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <label className="form-label mb-2">Pflichtfelder</label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={requireEmail} onChange={e => setRequireEmail(e.target.checked)} className="rounded border-gray-300" />
              E-Mail ist Pflicht
            </label>
          </div>

          <div className="border-t pt-4">
            <label className="form-label mb-2">Berechtigungen</label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={artistCanAdd} onChange={e => setArtistCanAdd(e.target.checked)} className="rounded border-gray-300" />
                Artist darf direkt hinzufügen (sonst nur Wunsch)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={crewPlusCanAdd} onChange={e => setCrewPlusCanAdd(e.target.checked)} className="rounded border-gray-300" />
                Crew+ darf direkt hinzufügen (sonst nur Wunsch)
              </label>
            </div>
          </div>

          <div className="border-t pt-4">
            <label className="form-label mb-2">Export (PDF &amp; CSV)</label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={exportShowInviter} onChange={e => setExportShowInviter(e.target.checked)} className="rounded border-gray-300" />
                „Eingeladen von" ausgeben
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={exportShowEmail} onChange={e => setExportShowEmail(e.target.checked)} className="rounded border-gray-300" />
                E-Mail-Adresse ausgeben
              </label>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div />
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary disabled:opacity-50">
              {saving ? '...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hauptview
// ─────────────────────────────────────────────────────────────────────────────
export default function GaestelisteView({ terminId }: Props) {
  const [role, setRole] = useState('')
  useEffect(() => { setRole(getEffectiveRole()) }, [])
  const isEditor = isEditorRole(role)
  const canWrite = role !== ''

  const [lists, setLists] = useState<GuestList[]>([])
  const [activeListId, setActiveListId] = useState<number | null>(null)
  const [entries, setEntries] = useState<GuestListEntry[]>([])
  const [activeList, setActiveList] = useState<GuestList | null>(null)
  const [travelParty, setTravelParty] = useState<Array<{ id: number; displayName: string; userId?: number | null }>>([])
  const [listsLoading, setListsLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortKey, setSortKey] = useState<'last_name' | 'first_name' | 'invited_by_text' | 'email'>('last_name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editEntry, setEditEntry] = useState<GuestListEntry | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<GuestListEntry | null>(null)
  const [creatingList, setCreatingList] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<number | undefined>(undefined)

  useEffect(() => {
    import('@/lib/api-client').then(({ getCurrentUser }) => {
      const u = getCurrentUser(); if (u?.id) setCurrentUserId(u.id)
    })
  }, [])

  const loadLists = useCallback(async () => {
    setListsLoading(true)
    try {
      let l = await getGuestLists(terminId)
      if (l.length === 0) {
        const created = await createGuestList(terminId, 'Gästeliste')
        l = [created]
      }
      setLists(l)
      if (!activeListId) setActiveListId(l[0].id)
    } catch {} finally { setListsLoading(false) }
  }, [terminId, activeListId])

  const loadEntries = useCallback(async (listId: number) => {
    setLoading(true)
    try {
      const { list, entries: e } = await getGuestListEntries(listId)
      setActiveList(list); setEntries(e)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { loadLists() }, [terminId])
  useEffect(() => { if (activeListId) loadEntries(activeListId) }, [activeListId])
  useEffect(() => {
    getTravelParty(terminId).then(tp =>
      setTravelParty(tp.map(m => ({
        id: m.id,
        displayName: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || '',
        userId: m.userId ?? null,
      })))
    ).catch(() => {})
  }, [terminId])

  const handleAddList = async () => {
    setCreatingList(true)
    try {
      const name = lists.length === 0 ? 'Gästeliste' : `Liste ${lists.length + 1}`
      const l = await createGuestList(terminId, name)
      setLists(prev => [...prev, l]); setActiveListId(l.id)
    } finally { setCreatingList(false) }
  }

  const handleLockToggle = async () => {
    if (!activeList) return
    const updated = await updateGuestList(activeList.id, { status: activeList.status === 'locked' ? 'open' : 'locked' })
    setActiveList(updated); setLists(prev => prev.map(l => l.id === updated.id ? updated : l))
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
    setActiveList(updated); setLists(prev => prev.map(l => l.id === updated.id ? updated : l))
  }

  const fetchWithAuth = (url: string) => {
    const token = getAuthToken()
    const slug = getCurrentTenant()?.slug ?? ''
    return fetch(url, { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug } })
  }

  const handleCsvExport = () => {
    if (!activeListId) return
    fetchWithAuth(`${API_BASE}/api/guest-lists/${activeListId}/export/csv`)
      .then(r => r.blob()).then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob); a.download = `gaesteliste-${activeListId}.csv`; a.click()
      })
  }

  const handlePdfExport = () => {
    if (!activeListId) return
    fetchWithAuth(`${API_BASE}/api/guest-lists/${activeListId}/export/pdf`)
      .then(r => r.blob()).then(blob => window.open(URL.createObjectURL(blob), '_blank'))
  }

  const listSettings = activeList?.settings ?? {}
  const passTypes = listSettings.pass_types ?? DEFAULT_PASS_TYPES
  const isLocked = activeList?.status === 'locked'

  const toggleSort = (key: typeof sortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filteredSortedEntries = useMemo(() => {
    const q = searchTerm.toLowerCase()
    const filtered = q
      ? entries.filter(e =>
          [e.first_name, e.last_name, e.company, e.invited_by_text,
           e.inviter_first_name, e.inviter_last_name, e.email]
            .some(v => v?.toLowerCase().includes(q))
        )
      : entries
    return [...filtered].sort((a, b) => {
      const av = (a[sortKey] ?? '').toLowerCase()
      const bv = (b[sortKey] ?? '').toLowerCase()
      const cmp = av.localeCompare(bv, 'de')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [entries, searchTerm, sortKey, sortDir])
  const isDirect = canAddDirect(role, listSettings)
  const pendingCount = entries.filter(e => e.status === 'pending').length
  const approvedCount = entries.filter(e => e.status === 'approved').length
  const totalTickets = entries.filter(e => e.status !== 'rejected').reduce((s, e) => s + passTotal(e.passes), 0)

  if (listsLoading) return <div className="p-8 text-center text-gray-400 text-sm">Laden...</div>

  return (
    <div className="p-4">
      {/* Toolbar + Tabs in einer Zeile */}
      <div className="flex items-center gap-2 mb-4">
        {/* Links: Hinzufügen / Abschließen */}
        <div className="flex items-center gap-2 shrink-0">
          {canWrite && !isLocked && (
            <button onClick={() => { setEditEntry(null); setShowAddModal(true) }} className="btn btn-primary">
              <PlusIcon className="w-4 h-4" />
              {isDirect ? 'Hinzufügen' : 'Wunsch'}
            </button>
          )}
          {isEditor && (
            <button onClick={handleLockToggle} className={`btn ${isLocked ? 'btn-success' : 'btn-ghost'}`}>
              {isLocked ? <LockOpenIcon className="w-4 h-4" /> : <LockClosedIcon className="w-4 h-4" />}
              {isLocked ? 'Entsperren' : 'Abschließen'}
            </button>
          )}
        </div>

        {/* Mitte: Tabs zentriert */}
        <div className="flex-1 flex items-center justify-center gap-2 flex-wrap">
          {lists.map(l => (
            <button
              key={l.id}
              onClick={() => setActiveListId(l.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                l.id === activeListId
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
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
            <button
              onClick={handleAddList}
              disabled={creatingList}
              className="px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              + Weitere Liste
            </button>
          )}
        </div>

        {/* Rechts: Einstellungen, CSV, PDF */}
        <div className="flex items-center gap-2 shrink-0">
          {isEditor && (
            <button onClick={() => setShowSettings(true)} className="btn btn-ghost">
              <Cog6ToothIcon className="w-4 h-4" /> Einstellungen
            </button>
          )}
          <button onClick={handleCsvExport} className="btn btn-ghost">
            <ArrowDownTrayIcon className="w-4 h-4" /> CSV
          </button>
          <button onClick={handlePdfExport} className="btn btn-ghost">
            <DocumentTextIcon className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Stats + Suche */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        {activeList && (
          <div className="flex gap-4 text-sm text-gray-500">
            <span>{approvedCount} bestätigt</span>
            {pendingCount > 0 && <span className="text-amber-600 font-medium">{pendingCount} ausstehend</span>}
            <span>{totalTickets} Tickets gesamt</span>
            {isLocked && <span className="text-red-600 font-medium flex items-center gap-1"><LockClosedIcon className="w-3 h-3" /> Gesperrt</span>}
          </div>
        )}
        <div className="flex-1" />
        <input
          type="text"
          placeholder="Gästeliste durchsuchen..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Tabelle */}
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {isEditor && <th className="w-14" />}
              <th className="sortable text-left" onClick={() => toggleSort('last_name')}>
                Nachname <span className={`sort-indicator${sortKey === 'last_name' ? ' active' : ''}`}>{sortKey === 'last_name' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
              </th>
              <th className="sortable text-left" onClick={() => toggleSort('first_name')}>
                Vorname <span className={`sort-indicator${sortKey === 'first_name' ? ' active' : ''}`}>{sortKey === 'first_name' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
              </th>
              <th className="sortable text-left" onClick={() => toggleSort('invited_by_text')}>
                Eingeladen von <span className={`sort-indicator${sortKey === 'invited_by_text' ? ' active' : ''}`}>{sortKey === 'invited_by_text' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
              </th>
              <th className="sortable text-left" onClick={() => toggleSort('email')}>
                E-Mail <span className={`sort-indicator${sortKey === 'email' ? ' active' : ''}`}>{sortKey === 'email' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
              </th>
              {passTypes.map(t => (
                <th key={t} className="text-center whitespace-nowrap">
                  {PASS_LABELS[t] ?? t}
                </th>
              ))}
              <th className="text-center">∑</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredSortedEntries.length === 0 ? (
              <tr><td colSpan={99} className="text-center py-10 text-gray-400">{searchTerm ? 'Keine Treffer' : 'Noch keine Einträge'}</td></tr>
            ) : filteredSortedEntries.map(entry => {
              const isWish    = entry.is_wish === 1
              const isPending = isWish && entry.status === 'pending'
              const isRejected = entry.status === 'rejected'

              // Pending + abgelehnte ausblenden wenn Liste gesperrt
              if (isLocked && (isPending || isRejected)) return null

              const total = passTotal(entry.passes)
              const inviterName = entry.invited_by_text
                || [entry.inviter_first_name, entry.inviter_last_name].filter(Boolean).join(' ')
                || null

              // Pending-Wünsche: halbtransparent + kursiv (gilt für gesamte Zeile inkl. Kinder)
              const rowStyle: React.CSSProperties = isPending
                ? { opacity: 0.5, fontStyle: 'italic' }
                : isRejected ? { color: '#9ca3af' } : {}

              return (
                <tr key={entry.id} style={rowStyle}>
                  {/* Approve/Reject für Editoren (erste Spalte) */}
                  {isEditor && (
                    <td className="px-2 py-2.5">
                      {isWish && !isLocked && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleApprove(entry, 'approved')}
                            title="Annehmen"
                            style={{ fontStyle: 'normal' }}
                            className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                              entry.status === 'approved'
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-200 text-gray-500 hover:bg-green-100 hover:text-green-700'
                            }`}
                          >✓</button>
                          <button
                            onClick={() => handleApprove(entry, 'rejected')}
                            title="Ablehnen"
                            style={{ fontStyle: 'normal' }}
                            className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                              entry.status === 'rejected'
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-700'
                            }`}
                          >✗</button>
                        </div>
                      )}
                    </td>
                  )}
                  {/* Nachname */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${isRejected ? 'line-through' : ''}`}>
                        {entry.last_name}
                      </span>
                      {entry.company && <span className="text-xs ml-1">({entry.company})</span>}
                    </div>
                    {isPending && !isEditor && (
                      <span className="text-xs text-amber-600" style={{ fontStyle: 'normal' }}>Wunsch – ausstehend</span>
                    )}
                  </td>
                  {/* Vorname */}
                  <td className="px-4 py-2.5">
                    <span className={isRejected ? 'line-through' : ''}>{entry.first_name}</span>
                  </td>
                  <td className="px-4 py-2.5 text-sm">{inviterName || '–'}</td>
                  <td className="px-4 py-2.5 text-xs">{entry.email || '–'}</td>
                  {passTypes.map(t => (
                    <td key={t} className="px-2 py-2.5 text-center text-sm">
                      {(entry.passes[t] ?? 0) > 0
                        ? <span className="font-medium">{entry.passes[t]}</span>
                        : <span className="text-gray-300">–</span>}
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-center font-semibold text-sm">
                    {total > 0 ? total : <span className="text-gray-300">–</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {!isLocked && (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setEditEntry(entry); setShowAddModal(true) }} className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition-colors">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setConfirmDelete(entry)} className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors">
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
          key={`${activeListId}-${JSON.stringify(listSettings.pass_types)}-${editEntry?.id ?? 'new'}`}
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
        <div className="modal-overlay">
          <div className="modal-container max-w-sm">
            <div className="modal-header">
              <h2 className="modal-title">Eintrag entfernen</h2>
              <button onClick={() => setConfirmDelete(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-gray-700">
                <strong>{confirmDelete.first_name} {confirmDelete.last_name}</strong> aus der Gästeliste entfernen?
              </p>
            </div>
            <div className="modal-footer">
              <div />
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost">Abbrechen</button>
                <button onClick={handleDelete} className="btn btn-danger">Entfernen</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
