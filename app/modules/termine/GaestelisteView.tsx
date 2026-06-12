'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useColumnVisibility } from '@/app/components/shared/useColumnVisibility'
import ColumnToggle from '@/app/components/shared/ColumnToggle'
import { usePolling } from '@/app/hooks/usePolling'
import {
  PlusIcon, LockClosedIcon, LockOpenIcon, ArrowDownTrayIcon,
  DocumentTextIcon, Cog6ToothIcon, CheckIcon,
  XMarkIcon, PencilIcon, TrashIcon,
} from '@heroicons/react/24/outline'
import { X } from 'lucide-react'
import { useIsMobile } from '@/app/hooks/useIsMobile'
import {
  getGuestLists, createGuestList, updateGuestList, deleteGuestList,
  getGuestListEntries, createGuestListEntry, updateGuestListEntry, deleteGuestListEntry,
  GuestList, GuestListEntry, GuestListSettings, PassMap,
  getEffectiveRole, isEditorRole, getTravelParty,
  API_BASE, getAuthToken, getCurrentTenant,
} from '@/lib/api-client'

const DEFAULT_PASS_TYPES = ['guestlist', 'backstage', 'aftershow', 'photo']
const PASS_LABELS: Record<string, string> = {
  guestlist: 'Gästeliste', backstage: 'Backstage', aftershow: 'Aftershow', photo: 'Photo',
}
const PASS_ABBREV: Record<string, string> = {
  guestlist: 'GL', backstage: 'BS', aftershow: 'AS', photo: 'PH',
}

const GUEST_COL_DEFS = [
  { id: 'invited_by', label: 'Eingeladen von', defaultVisible: true },
  { id: 'email',      label: 'E-Mail',         defaultVisible: false },
  { id: 'total',      label: '∑ Total',        defaultVisible: true },
]

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
  currentUserName?: string
  isEditor: boolean
  onSave: (data: Partial<GuestListEntry>) => Promise<void>
  onClose: () => void
}

function EntryModal({ listSettings, entry, travelParty, currentUserId, currentUserName, isEditor, onSave, onClose }: EntryModalProps) {
  const passTypes = listSettings.pass_types ?? DEFAULT_PASS_TYPES
  // Eigener Anzeigename (fuer Self-Lock bei Nicht-Editoren)
  const ownName = currentUserName || (travelParty.find(m => m.userId === currentUserId)?.displayName ?? '')

  const [firstName, setFirstName] = useState(entry?.first_name ?? '')
  const [lastName, setLastName] = useState(entry?.last_name ?? '')
  const [company, setCompany] = useState(entry?.company ?? '')
  // Editor: frei waehlbar (Dropdown aller Reisegruppe + Freitext). Nicht-Editor: fest auf eigenen Namen.
  const [invitedByText, setInvitedByText] = useState(isEditor ? (entry?.invited_by_text ?? '') : ownName)
  const [invitedByUserId, setInvitedByUserId] = useState<number | null>(
    isEditor ? (entry?.invited_by_user_id ?? null) : (currentUserId ?? null)
  )
  // Dropdown-Auswahl: 'manual' = Freitext, sonst die travelParty-Member-id
  const [invitedBySel, setInvitedBySel] = useState<string>(() => {
    if (!isEditor) return 'self'
    if (entry?.invited_by_user_id) {
      const m = travelParty.find(t => t.userId === entry.invited_by_user_id)
      if (m) return String(m.id)
    }
    if (entry?.invited_by_text) {
      const m = travelParty.find(t => t.displayName === entry.invited_by_text)
      return m ? String(m.id) : 'manual'
    }
    return 'manual'
  })
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
            {!isEditor ? (
              /* Crew+/Artist/Crew/Guest: fest auf eigenen Namen */
              <input className="form-input bg-gray-100 text-gray-500" value={ownName} readOnly disabled />
            ) : (
              /* Editor: Dropdown aller Reisegruppe (auch ohne Account) + Freitext */
              <>
                <select
                  className="form-input"
                  value={invitedBySel}
                  onChange={e => {
                    const v = e.target.value
                    setInvitedBySel(v)
                    if (v === 'manual') {
                      setInvitedByUserId(null)
                      setInvitedByText('')
                    } else {
                      const m = travelParty.find(t => String(t.id) === v)
                      if (m) { setInvitedByUserId(m.userId ?? null); setInvitedByText(m.displayName) }
                    }
                  }}
                >
                  <option value="manual">Manuell eingeben…</option>
                  {travelParty.map(m => (
                    <option key={m.id} value={String(m.id)}>
                      {m.displayName}{m.userId ? '' : ' (Kontakt)'}
                    </option>
                  ))}
                </select>
                {invitedBySel === 'manual' && (
                  <input
                    className="form-input mt-2"
                    placeholder="Name freitext..."
                    value={invitedByText}
                    onChange={e => setInvitedByText(e.target.value)}
                  />
                )}
              </>
            )}
          </div>

          <div>
            <label className="form-label">
              E-Mail {listSettings.require_email && <span className="text-red-400">*</span>}
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
  const [wishDeadline, setWishDeadline] = useState(s.wish_deadline ?? '')
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
      wish_deadline: wishDeadline || null,
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
            <label className="form-label mb-2">Wunsch-Deadline</label>
            <input
              type="datetime-local"
              className="form-input"
              value={wishDeadline}
              onChange={e => setWishDeadline(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Nach diesem Zeitpunkt können nur noch Admin/Tourmanagement/Agency eintragen.
              {wishDeadline && (
                <button type="button" onClick={() => setWishDeadline('')} className="ml-2 text-gray-400 hover:text-gray-200 underline">
                  entfernen
                </button>
              )}
            </p>
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
  const [currentUserName, setCurrentUserName] = useState('')
  const { isVisible, toggle, columns: colDefs } = useColumnVisibility(`guestlist-${terminId}`, GUEST_COL_DEFS)

  useEffect(() => {
    import('@/lib/api-client').then(({ getCurrentUser }) => {
      const u = getCurrentUser()
      if (u?.id) setCurrentUserId(u.id)
      if (u) setCurrentUserName([u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '')
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

  // Ref damit der Polling-Callback immer den aktuellen activeListId kennt
  const activeListIdRef = useRef(activeListId)
  useEffect(() => { activeListIdRef.current = activeListId }, [activeListId])

  // Stilles Polling alle 30s — nur Einträge der aktiven Liste
  const refreshEntries = useCallback(async () => {
    const id = activeListIdRef.current
    if (!id) return
    try {
      const { list, entries: e } = await getGuestListEntries(id)
      setActiveList(list); setEntries(e)
    } catch {
      // still ignorieren
    }
  }, [])
  usePolling(refreshEntries, 30_000)
  useEffect(() => {
    getTravelParty(terminId).then(tp =>
      setTravelParty(tp.map(m => ({
        id: m.id,
        displayName: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || '',
        userId: m.userId ?? null,
      })))
    ).catch(() => {})
  }, [terminId])

  const [showNewListModal, setShowNewListModal] = useState(false)
  const [newListName, setNewListName] = useState('')
  const handleAddList = async () => {
    setCreatingList(true)
    try {
      const name = newListName.trim() || (lists.length === 0 ? 'Gästeliste' : `Liste ${lists.length + 1}`)
      const l = await createGuestList(terminId, name)
      setLists(prev => [...prev, l]); setActiveListId(l.id)
      setShowNewListModal(false); setNewListName('')
    } finally { setCreatingList(false) }
  }

  const handleDeleteList = async (listId: number) => {
    if (lists.length <= 1) return
    const list = lists.find(l => l.id === listId)
    if (!confirm(`Liste „${list?.name ?? listId}" wirklich löschen? Alle Einträge werden entfernt.`)) return
    await deleteGuestList(listId)
    const remaining = lists.filter(l => l.id !== listId)
    setLists(remaining)
    if (activeListId === listId) setActiveListId(remaining[0]?.id ?? null)
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
  const wishDeadline = listSettings.wish_deadline ?? null
  const deadlinePassed = wishDeadline ? new Date(wishDeadline).getTime() < Date.now() : false
  const addBlockedByDeadline = deadlinePassed && !isEditor
  const pendingCount = entries.filter(e => e.status === 'pending').length
  const approvedCount = entries.filter(e => e.status === 'approved').length
  const activeEntries = entries.filter(e => e.status !== 'rejected')
  const totalTickets = activeEntries.reduce((s, e) => s + passTotal(e.passes), 0)
  const isMobile = useIsMobile()

  // ── Limit-Warnungen ───────────────────────────────────────────
  const totalLimit = listSettings.total_limit ?? null
  const perInviterLimit = listSettings.per_inviter_limit ?? null

  const totalLimitExceeded = totalLimit !== null && totalTickets > totalLimit

  const ticketsByInviter = useMemo(() => {
    const map: Record<string, number> = {}
    activeEntries.forEach(e => {
      const key = e.invited_by_text
        || [e.inviter_first_name, e.inviter_last_name].filter(Boolean).join(' ')
        || '—'
      map[key] = (map[key] ?? 0) + passTotal(e.passes)
    })
    return map
  }, [activeEntries])

  const inviterOverLimit = perInviterLimit
    ? Object.entries(ticketsByInviter).filter(([, count]) => count > perInviterLimit)
    : []

  const limitWarnings = (
    (totalLimitExceeded || inviterOverLimit.length > 0) && (
      <div className="flex flex-col gap-1.5 mb-3">
        {totalLimitExceeded && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <span className="font-semibold">⚠ Gesamtlimit überschritten:</span>
            {totalTickets} / {totalLimit} Tickets vergeben
          </div>
        )}
        {inviterOverLimit.map(([name, count]) => (
          <div key={name} className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            <span className="font-semibold">⚠ Pro-Einlader-Limit überschritten:</span>
            {name} — {count} / {perInviterLimit} Tickets
          </div>
        ))}
      </div>
    )
  )

  if (listsLoading) return <div className="p-8 text-center text-gray-400 text-sm">Laden...</div>

  // ── Shared helpers ────────────────────────────────────────────
  const listTabs = (
    lists.length > 1 ? (
      <select
        className="form-select text-sm py-1.5 w-full"
        value={activeListId ?? ''}
        onChange={e => setActiveListId(Number(e.target.value))}
      >
        {lists.map(l => (
          <option key={l.id} value={l.id}>
            {l.name}{(l.entry_count ?? 0) > 0 ? ` (${l.entry_count})` : ''}{l.status === 'locked' ? ' 🔒' : ''}
          </option>
        ))}
      </select>
    ) : (
      lists[0] ? (
        <span className="text-sm font-medium text-gray-300 inline-flex items-center gap-1">
          {lists[0].name}
          {lists[0].status === 'locked' && <LockClosedIcon className="w-3 h-3 opacity-70" />}
        </span>
      ) : null
    )
  )

  // Blauer Front-Button „Neue Liste" (wie in anderen Bereichen)
  const newListBtn = isEditor && (
    <button onClick={() => { setNewListName(''); setShowNewListModal(true) }} disabled={creatingList} className="btn btn-primary flex-shrink-0" title="Neue Liste">
      <PlusIcon className="w-4 h-4" /><span className="hidden md:inline"> Neue Liste</span>
    </button>
  )

  const statsBar = activeList && (
    <div className="flex gap-x-4 gap-y-1 text-sm text-gray-500 mt-2 px-1 flex-wrap">
      <span>{approvedCount} bestätigt</span>
      {pendingCount > 0 && <span className="text-amber-600 font-medium">{pendingCount} ausstehend</span>}
      {totalLimit !== null ? (
        <span className={totalTickets > totalLimit ? 'text-red-600 font-medium' : ''}>
          {totalTickets} / {totalLimit} Tickets{totalTickets <= totalLimit ? ` · noch ${totalLimit - totalTickets} frei` : ' · überschritten'}
        </span>
      ) : (
        <span>{totalTickets} Tickets gesamt</span>
      )}
      {wishDeadline && (
        <span className={deadlinePassed ? 'text-red-600 font-medium' : ''}>
          Wunsch-Deadline {new Date(wishDeadline).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}{deadlinePassed ? ' (abgelaufen)' : ''}
        </span>
      )}
      {isLocked && <span className="text-red-600 font-medium flex items-center gap-1"><LockClosedIcon className="w-3 h-3" /> Gesperrt</span>}
    </div>
  )

  return (
    <div className="pb-4">

      {isMobile ? (
        /* ══════════════════════ MOBILE LAYOUT ══════════════════════ */
        <>
          {/* Row 1: Action buttons + Icon buttons */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex gap-2">
              {canWrite && !isLocked && !addBlockedByDeadline && (
                <button onClick={() => { setEditEntry(null); setShowAddModal(true) }} className="btn btn-primary flex-shrink-0">
                  <PlusIcon className="w-4 h-4" />
                  {isDirect ? 'Hinzufügen' : 'Wunsch'}
                </button>
              )}
            </div>
            <div className="flex gap-1">
              {isEditor && lists.length > 1 && activeListId && (
                <button onClick={() => handleDeleteList(activeListId)} title="Liste löschen" className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-500">
                  <TrashIcon className="w-5 h-5" />
                </button>
              )}
              {newListBtn}
              {isEditor && (
                <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                  <Cog6ToothIcon className="w-5 h-5" />
                </button>
              )}
              <button onClick={handleCsvExport} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                <ArrowDownTrayIcon className="w-5 h-5" />
              </button>
              <button onClick={handlePdfExport} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                <DocumentTextIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Row 2: Name + Schloss */}
          <div className="mb-3 flex items-center gap-2">
            <div className="flex-1 min-w-0">{listTabs}</div>
            {isEditor && (
              <button onClick={handleLockToggle} title={isLocked ? 'Entsperren' : 'Abschließen'} className={`p-2 rounded-lg flex-shrink-0 ${isLocked ? 'text-green-600 bg-green-50' : 'text-gray-500 hover:bg-gray-100'}`}>
                {isLocked ? <LockClosedIcon className="w-5 h-5" /> : <LockOpenIcon className="w-5 h-5" />}
              </button>
            )}
          </div>

          {/* Limit-Warnungen */}
          {limitWarnings}

          {/* Search */}
          <input
            type="text"
            placeholder="Suchen..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input mb-3"
          />

          {/* Card list */}
          {filteredSortedEntries.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              {searchTerm ? 'Keine Treffer' : 'Noch keine Einträge'}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredSortedEntries.map(entry => {
                const isWish     = entry.is_wish === 1
                const isPending  = isWish && entry.status === 'pending'
                const isRejected = entry.status === 'rejected'
                if (isLocked && (isPending || isRejected)) return null
                const total = passTotal(entry.passes)
                const inviterName = entry.invited_by_text
                  || [entry.inviter_first_name, entry.inviter_last_name].filter(Boolean).join(' ')
                  || null
                const activePasses = passTypes.filter(t => (entry.passes[t] ?? 0) > 0)

                return (
                  <div
                    key={entry.id}
                    className={`bg-white rounded-xl border px-4 py-3 ${
                      isPending ? 'border-amber-200 opacity-70' :
                      isRejected ? 'border-gray-100' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {/* Left: Name + meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold text-sm text-gray-900 ${isRejected ? 'line-through text-gray-400' : ''}`}>
                            {entry.first_name} {entry.last_name}
                          </span>
                          {entry.company && (
                            <span className="text-xs text-gray-400">({entry.company})</span>
                          )}
                          {isPending && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full" style={{ fontStyle: 'normal' }}>
                              ausstehend
                            </span>
                          )}
                          {isRejected && (
                            <span className="text-xs bg-red-50 text-red-400 px-1.5 py-0.5 rounded-full">abgelehnt</span>
                          )}
                        </div>
                        {inviterName && (
                          <div className="text-xs text-gray-400 mt-0.5">von {inviterName}</div>
                        )}
                        {activePasses.length > 0 && (
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {activePasses.map(t => (
                              <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                {PASS_LABELS[t] ?? t} {entry.passes[t]}
                              </span>
                            ))}
                            {activePasses.length > 1 && total > 0 && (
                              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                                ∑ {total}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Approve/Reject + Edit/Delete */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        {isEditor && isWish && !isLocked && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleApprove(entry, 'approved')}
                              className={`w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center transition-colors ${
                                entry.status === 'approved'
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700'
                              }`}
                            >✓</button>
                            <button
                              onClick={() => handleApprove(entry, 'rejected')}
                              className={`w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center transition-colors ${
                                entry.status === 'rejected'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-700'
                              }`}
                            >✗</button>
                          </div>
                        )}
                        {!isLocked && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => { setEditEntry(entry); setShowAddModal(true) }}
                              className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(entry)}
                              className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {statsBar}
        </>
      ) : (
        /* ══════════════════════ DESKTOP LAYOUT ══════════════════════ */
        <div className="px-4">
          {/* Toolbar — Mitte (1fr) füllt, Seiten = Inhaltsbreite. Hinzufügen-Platz wird reserviert,
              damit die Mitte beim Sperren nicht wächst (Button wird unsichtbar statt entfernt) */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 mb-4">
            {/* Links: Hinzufügen + Sperren */}
            <div className="flex items-center gap-2 justify-self-start">
              {canWrite && (
                <button
                  onClick={() => { setEditEntry(null); setShowAddModal(true) }}
                  className={`btn btn-primary flex-shrink-0 ${(isLocked || addBlockedByDeadline) ? 'invisible pointer-events-none' : ''}`}
                  aria-hidden={isLocked || addBlockedByDeadline}
                  tabIndex={(isLocked || addBlockedByDeadline) ? -1 : undefined}
                >
                  <PlusIcon className="w-4 h-4" />
                  {isDirect ? 'Hinzufügen' : 'Wunsch'}
                </button>
              )}
            </div>

            {/* Mitte: Name + Schloss (füllt den Platz) */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex-1 min-w-0">{listTabs}</div>
              {isEditor && (
                <button onClick={handleLockToggle} title={isLocked ? 'Entsperren' : 'Abschließen'} className={`btn flex-shrink-0 ${isLocked ? 'btn-success' : 'btn-ghost'}`}>
                  {isLocked ? <LockClosedIcon className="w-4 h-4" /> : <LockOpenIcon className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* Rechts: Löschen, Neue Liste, Einstellungen, CSV, PDF */}
            <div className="flex items-center gap-2 justify-self-end">
              {isEditor && lists.length > 1 && activeListId && (
                <button onClick={() => handleDeleteList(activeListId)} title="Liste löschen" className="btn btn-ghost flex-shrink-0 text-red-500 hover:text-red-600">
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
              {newListBtn}
              {isEditor && (
                <button onClick={() => setShowSettings(true)} className="btn btn-ghost flex-shrink-0">
                  <Cog6ToothIcon className="w-4 h-4" /> Einstellungen
                </button>
              )}
              <button onClick={handleCsvExport} className="btn btn-ghost flex-shrink-0">
                <ArrowDownTrayIcon className="w-4 h-4" /> CSV
              </button>
              <button onClick={handlePdfExport} className="btn btn-ghost flex-shrink-0">
                <DocumentTextIcon className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>

          {/* Limit-Warnungen */}
          {limitWarnings}

          {/* Suche */}
          <div className="flex items-center gap-4 mb-3 flex-wrap">
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
                  {isVisible('invited_by') && (
                    <th className="sortable text-left" onClick={() => toggleSort('invited_by_text')}>
                      Eingeladen von <span className={`sort-indicator${sortKey === 'invited_by_text' ? ' active' : ''}`}>{sortKey === 'invited_by_text' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                    </th>
                  )}
                  {isVisible('email') && (
                    <th className="sortable text-left" onClick={() => toggleSort('email')}>
                      E-Mail <span className={`sort-indicator${sortKey === 'email' ? ' active' : ''}`}>{sortKey === 'email' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                    </th>
                  )}
                  {passTypes.map(t => (
                    <th key={t} className="text-center w-10" title={PASS_LABELS[t] ?? t}>
                      {PASS_ABBREV[t] ?? t.substring(0, 3).toUpperCase()}
                    </th>
                  ))}
                  {isVisible('total') && <th className="text-center w-10">∑</th>}
                  <th className="w-8 text-right pr-2">
                    <ColumnToggle columns={colDefs} isVisible={isVisible} toggle={toggle} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSortedEntries.length === 0 ? (
                  <tr><td colSpan={99} className="text-center py-10 text-gray-400">{searchTerm ? 'Keine Treffer' : 'Noch keine Einträge'}</td></tr>
                ) : filteredSortedEntries.map(entry => {
                  const isWish    = entry.is_wish === 1
                  const isPending = isWish && entry.status === 'pending'
                  const isRejected = entry.status === 'rejected'
                  if (isLocked && (isPending || isRejected)) return null
                  const total = passTotal(entry.passes)
                  const inviterName = entry.invited_by_text
                    || [entry.inviter_first_name, entry.inviter_last_name].filter(Boolean).join(' ')
                    || null
                  const rowStyle: React.CSSProperties = isPending
                    ? { opacity: 0.5, fontStyle: 'italic' }
                    : isRejected ? { color: '#9ca3af' } : {}
                  return (
                    <tr key={entry.id} style={rowStyle}>
                      {isEditor && (
                        <td className="px-2 py-2.5">
                          {isWish && !isLocked && (
                            <div className="flex gap-1">
                              <button onClick={() => handleApprove(entry, 'approved')} title="Annehmen" style={{ fontStyle: 'normal' }}
                                className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${entry.status === 'approved' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500 hover:bg-green-100 hover:text-green-700'}`}>✓</button>
                              <button onClick={() => handleApprove(entry, 'rejected')} title="Ablehnen" style={{ fontStyle: 'normal' }}
                                className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${entry.status === 'rejected' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-700'}`}>✗</button>
                            </div>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isRejected ? 'line-through' : ''}`}>{entry.last_name}</span>
                          {entry.company && <span className="text-xs ml-1">({entry.company})</span>}
                        </div>
                        {isPending && !isEditor && (
                          <span className="text-xs text-amber-600" style={{ fontStyle: 'normal' }}>Wunsch – ausstehend</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={isRejected ? 'line-through' : ''}>{entry.first_name}</span>
                      </td>
                      {isVisible('invited_by') && <td className="px-4 py-2.5 text-sm">{inviterName || '–'}</td>}
                      {isVisible('email') && <td className="px-4 py-2.5 text-xs">{entry.email || '–'}</td>}
                      {passTypes.map(t => (
                        <td key={t} className="px-1 py-2.5 text-center text-sm w-10">
                          {(entry.passes[t] ?? 0) > 0
                            ? <span className="font-medium">{entry.passes[t]}</span>
                            : <span className="text-gray-300">–</span>}
                        </td>
                      ))}
                      {isVisible('total') && (
                        <td className="px-1 py-2.5 text-center font-semibold text-sm w-10">
                          {total > 0 ? total : <span className="text-gray-300">–</span>}
                        </td>
                      )}
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

          {statsBar}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <EntryModal
          key={`${activeListId}-${JSON.stringify(listSettings.pass_types)}-${editEntry?.id ?? 'new'}`}
          listSettings={listSettings}
          entry={editEntry}
          travelParty={travelParty}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          isEditor={isEditor}
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
      {showNewListModal && (
        <div className="modal-overlay">
          <div className="modal-container max-w-sm">
            <div className="modal-header">
              <h2 className="modal-title">Neue Liste</h2>
              <button onClick={() => setShowNewListModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <label className="form-label">Listenname</label>
              <input
                className="form-input"
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddList(); if (e.key === 'Escape') setShowNewListModal(false) }}
                placeholder={lists.length === 0 ? 'Gästeliste' : `Liste ${lists.length + 1}`}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <div />
              <div className="flex gap-2">
                <button onClick={() => setShowNewListModal(false)} className="btn btn-ghost">Abbrechen</button>
                <button onClick={handleAddList} disabled={creatingList} className="btn btn-primary disabled:opacity-50">
                  {creatingList ? 'Erstellen…' : 'Erstellen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
